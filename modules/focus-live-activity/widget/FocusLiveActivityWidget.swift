// FocusLiveActivityWidget.swift
// Widget Extension target entry point.
// Implements the full ActivityConfiguration with:
//   • Lock-screen / banner view
//   • Dynamic Island — Expanded, Compact, Minimal

import ActivityKit
import SwiftUI
import WidgetKit

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - iOS 17 compatibility
// ─────────────────────────────────────────────────────────────────────────────

// Two-function pattern: .symbolEffect is quarantined inside an @available(iOS 17)
// function. The builder never directly references the symbol, so Swift will not
// type-check _pulse at all when the deployment target is < iOS 17.
@ViewBuilder
private func pulseIfAvailable<V: View>(_ view: V, isActive: Bool) -> some View {
    if #available(iOS 17.0, *) {
        _pulse(view: view, isActive: isActive)
    } else {
        view
    }
}

@available(iOS 17.0, *)
private func _pulse<V: View>(view: V, isActive: Bool) -> some View {
    view.symbolEffect(.pulse, options: .repeating, isActive: isActive)
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Design tokens
// ─────────────────────────────────────────────────────────────────────────────

private enum Flusso {
    // Palette
    static let background   = Color(red: 0.043, green: 0.043, blue: 0.059)  // #0B0B0F
    static let surface      = Color(red: 0.10,  green: 0.10,  blue: 0.13)
    static let orange       = Color(red: 1.000, green: 0.478, blue: 0.000)  // #FF7A00
    static let breakCyan    = Color(red: 0.380, green: 0.750, blue: 1.000)
    static let dimText      = Color(red: 0.55,  green: 0.55,  blue: 0.60)

    // Per-mode helpers
    static func accent(for mode: String) -> Color {
        mode == "Break" ? breakCyan : orange
    }

    static func icon(for mode: String) -> String {
        switch mode {
        case "Focus": return "flame.fill"
        case "Break": return "leaf.fill"
        case "Done":  return "checkmark.circle.fill"
        default:      return "circle.fill"
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Reusable sub-views
// ─────────────────────────────────────────────────────────────────────────────

/// Renders "MM:SS" — a live countdown when running, a static label when paused.
private struct TimerLabel: View {
    let state: FocusActivityAttributes.ContentState
    let size: CGFloat

    var body: some View {
        Group {
            if state.isPaused, let remaining = state.pausedTimeRemaining {
                Text(staticTime(remaining))
            } else if state.endTime > .now {
                Text(timerInterval: .now ... state.endTime, countsDown: true)
                    .frame(minWidth: size * 2.8)
            } else {
                Text("00:00")
            }
        }
        .font(.system(size: size, weight: .bold, design: .rounded))
        .foregroundColor(.white)
        .monospacedDigit()
    }

    private func staticTime(_ s: Int) -> String {
        String(format: "%02d:%02d", max(0, s) / 60, max(0, s) % 60)
    }
}

/// Compact trailing timer — narrower variant for the Dynamic Island pill.
private struct CompactTimerLabel: View {
    let state: FocusActivityAttributes.ContentState
    let size: CGFloat
    let color: Color

    var body: some View {
        Group {
            if state.isPaused, let remaining = state.pausedTimeRemaining {
                Text(staticTime(remaining))
            } else if state.endTime > .now {
                Text(timerInterval: .now ... state.endTime, countsDown: true)
                    .frame(maxWidth: 54)
            } else {
                Text("0:00")
            }
        }
        .font(.system(size: size, weight: .bold, design: .rounded))
        .foregroundColor(color)
        .monospacedDigit()
    }

    private func staticTime(_ s: Int) -> String {
        let m = max(0, s) / 60
        let sec = max(0, s) % 60
        return m > 0 ? String(format: "%d:%02d", m, sec) : String(format: "0:%02d", sec)
    }
}

/// Pill-shaped mode badge — "FOCUS" or "BREAK" with colour accent.
private struct ModeBadge: View {
    let mode: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: Flusso.icon(for: mode))
                .font(.system(size: 9, weight: .semibold))
            Text(mode.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.7)
        }
        .foregroundColor(Flusso.accent(for: mode))
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Flusso.accent(for: mode).opacity(0.14), in: Capsule())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Lock Screen / Notification Banner view
// ─────────────────────────────────────────────────────────────────────────────

private struct LockScreenView: View {
    let context: ActivityViewContext<FocusActivityAttributes>

    var body: some View {
        let s = context.state

        HStack(alignment: .center, spacing: 14) {

            // ── Left column: mode icon ──
            ZStack {
                Circle()
                    .fill(Flusso.accent(for: s.mode).opacity(0.14))
                    .frame(width: 48, height: 48)
                pulseIfAvailable(
                    Image(systemName: Flusso.icon(for: s.mode))
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundColor(Flusso.accent(for: s.mode)),
                    isActive: !s.isPaused && s.mode == "Focus"
                )
            }

            // ── Center: task name + large timer ──
            VStack(alignment: .leading, spacing: 1) {
                Text(s.taskName.isEmpty ? s.sessionName : s.taskName)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Flusso.dimText)
                    .lineLimit(1)

                TimerLabel(state: s, size: 38)

                if s.isPaused {
                    Text("Paused")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Flusso.dimText)
                }
            }

            Spacer(minLength: 0)

            // ── Right column: mode badge + live indicator ──
            VStack(alignment: .trailing, spacing: 8) {
                ModeBadge(mode: s.mode)

                HStack(spacing: 4) {
                    Circle()
                        .fill(s.isPaused ? Flusso.dimText : Flusso.accent(for: s.mode))
                        .frame(width: 6, height: 6)
                    Text(s.isPaused ? "Paused" : "Live")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(Flusso.dimText)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Flusso.background)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Dynamic Island: Expanded (center region)
// ─────────────────────────────────────────────────────────────────────────────

private struct ExpandedCenterView: View {
    let context: ActivityViewContext<FocusActivityAttributes>

    var body: some View {
        let s = context.state

        VStack(spacing: 4) {
            // Top row: icon + task name / session name + mode badge
            HStack(spacing: 6) {
                Image(systemName: Flusso.icon(for: s.mode))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Flusso.accent(for: s.mode))

                Text(s.taskName.isEmpty ? s.sessionName : s.taskName)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Flusso.dimText)
                    .lineLimit(1)

                Spacer(minLength: 0)

                ModeBadge(mode: s.mode)
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)

            // Giant centred timer
            TimerLabel(state: s, size: 48)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.bottom, 10)
        }
        .background(Flusso.background)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Widget configuration
// ─────────────────────────────────────────────────────────────────────────────

struct FocusLiveActivityWidget: Widget {

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FocusActivityAttributes.self) { context in

            // ── Lock screen / notification banner ──
            LockScreenView(context: context)

        } dynamicIsland: { context in

            DynamicIsland {

                // ── Expanded ──
                DynamicIslandExpandedRegion(.center) {
                    ExpandedCenterView(context: context)
                }

            } compactLeading: {

                // Mode icon in the leading compact slot
                Image(systemName: Flusso.icon(for: context.state.mode))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Flusso.accent(for: context.state.mode))
                    .padding(.leading, 4)

            } compactTrailing: {

                // Countdown in the trailing compact slot
                CompactTimerLabel(
                    state: context.state,
                    size: 13,
                    color: Flusso.accent(for: context.state.mode)
                )
                .padding(.trailing, 4)

            } minimal: {

                // Single mode icon for the minimal pill
                Image(systemName: Flusso.icon(for: context.state.mode))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(Flusso.accent(for: context.state.mode))
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Widget bundle entry point
// ─────────────────────────────────────────────────────────────────────────────

@main
struct FocusLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        FocusLiveActivityWidget()
    }
}
