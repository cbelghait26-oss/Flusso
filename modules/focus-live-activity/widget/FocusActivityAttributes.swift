// FocusActivityAttributes.swift  (Widget Extension copy)
// This file is intentionally identical to the one in the main app target.
// Both targets compile their own copy so there is no cross-target dependency.

import ActivityKit
import Foundation

struct FocusActivityAttributes: ActivityAttributes {

    var sessionId: String

    public struct ContentState: Codable, Hashable {
        var sessionName: String
        var taskName: String
        /// "Focus" | "Break" | "Done"
        var mode: String
        /// Absolute end time of the current interval — drives Text(timerInterval:).
        var endTime: Date
        var isPaused: Bool
        /// Seconds remaining at the moment of pause; nil when running.
        var pausedTimeRemaining: Int?
    }
}
