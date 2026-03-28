// FocusActivityAttributes.swift
// Shared between the main app target and the FocusLiveActivity widget extension target.
// Both targets must include this file in their "Compile Sources" build phase.

import ActivityKit
import Foundation

// MARK: - Activity Attributes

struct FocusActivityAttributes: ActivityAttributes {

    // MARK: Static (set at start, never changes)

    /// Unique identifier for this Pomodoro session.
    var sessionId: String

    // MARK: ContentState (live-updated values)

    public struct ContentState: Codable, Hashable {
        /// Human-readable session label, e.g. "Morning Focus".
        var sessionName: String

        /// Current task being worked on, e.g. "Math".
        var taskName: String

        /// "Focus" | "Break" | "Done"
        var mode: String

        /// Absolute point in time when the current interval ends.
        /// The widget uses this as the upper bound of a SwiftUI countdown
        /// Text so it updates automatically every second without a push update.
        var endTime: Date

        /// Whether the timer is currently paused.
        var isPaused: Bool

        /// Seconds left at the moment of pause (used when isPaused == true).
        /// Nil when the timer is running.
        var pausedTimeRemaining: Int?
    }
}
