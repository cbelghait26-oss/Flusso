import ExpoModulesCore
import MapKit

// MARK: - Completer request helper

/// One-shot wrapper that bridges MKLocalSearchCompleter's delegate callbacks
/// into the promise-based API expected by expo-modules-core.
private class CompleterRequest: NSObject, MKLocalSearchCompleterDelegate {
  private var completer: MKLocalSearchCompleter
  private var resolve: (([[String: String]]) -> Void)?

  init(query: String, resolve: @escaping ([[String: String]]) -> Void) {
    self.resolve = resolve
    self.completer = MKLocalSearchCompleter()
    super.init()
    completer.delegate = self
    completer.resultTypes = [.address, .pointOfInterest]

    // Safety timeout — resolve with empty list after 3 s if MapKit never responds
    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
      self?.finish([])
    }

    // Setting queryFragment AFTER the delegate is assigned triggers the search
    completer.queryFragment = query
  }

  /// Resolves the promise exactly once; subsequent calls are no-ops.
  private func finish(_ results: [[String: String]]) {
    guard let resolve = self.resolve else { return }
    self.resolve = nil
    resolve(results)
  }

  // MARK: MKLocalSearchCompleterDelegate

  func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
    let mapped: [[String: String]] = completer.results.prefix(5).map { c in
      ["title": c.title, "subtitle": c.subtitle]
    }
    finish(mapped)
  }

  func completer(
    _ completer: MKLocalSearchCompleter,
    didFailWithError error: Error
  ) {
    finish([])
  }
}

// MARK: - Expo Module

public class SmartLocationModule: Module {
  /// Strong references keep in-flight CompleterRequests alive until they resolve.
  private var pendingRequests: [UUID: CompleterRequest] = [:]

  public func definition() -> ModuleDefinition {
    Name("SmartLocation")

    // ── getSuggestions ──────────────────────────────────────────────────────
    /// Returns up to 5 Apple Maps suggestions for a query string.
    /// Resolves with [] if the query is too short, MapKit fails, or 3 s elapse.
    AsyncFunction("getSuggestions") { (query: String, promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self = self else {
          promise.resolve([])
          return
        }

        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 2 else {
          promise.resolve([])
          return
        }

        let id = UUID()
        let request = CompleterRequest(query: trimmed) { [weak self] results in
          self?.pendingRequests.removeValue(forKey: id)
          promise.resolve(results)
        }
        self.pendingRequests[id] = request
      }
    }

    // ── resolvePlace ────────────────────────────────────────────────────────
    /// Resolves a completer suggestion (title + subtitle) into a full place
    /// record containing address and coordinates.
    /// On failure, returns a minimal object with just the text fields.
    AsyncFunction("resolvePlace") { (title: String, subtitle: String, promise: Promise) in
      DispatchQueue.main.async {
        let searchQuery = subtitle.isEmpty ? title : "\(title), \(subtitle)"
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = searchQuery

        let search = MKLocalSearch(request: request)
        search.start { response, _ in
          guard let item = response?.mapItems.first else {
            // Nothing found — still return the raw text so the caller can use it
            promise.resolve([
              "name": title,
              "title": title,
              "subtitle": subtitle,
            ] as [String: Any])
            return
          }

          let placemark = item.placemark
          var result: [String: Any] = [
            "name": item.name ?? title,
            "title": title,
            "subtitle": subtitle,
            "latitude": placemark.coordinate.latitude,
            "longitude": placemark.coordinate.longitude,
          ]

          var addrParts: [String] = []
          if let street = placemark.thoroughfare    { addrParts.append(street) }
          if let city   = placemark.locality         { addrParts.append(city) }
          if let region = placemark.administrativeArea { addrParts.append(region) }
          if let country = placemark.country         { addrParts.append(country) }
          if !addrParts.isEmpty {
            result["address"] = addrParts.joined(separator: ", ")
          }

          promise.resolve(result)
        }
      }
    }
  }
}
