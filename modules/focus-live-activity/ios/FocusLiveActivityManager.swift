// FocusLiveActivityManager.swift
// Manages the lifecycle of the focus-session Live Activity.
// Runs entirely in native Swift — JS only calls start / update / end via the
// Expo module; all subsequent timer math lives here.

import ActivityKit
import Foundation

@available(iOS 16.1, *)
final class FocusLiveActivityManager {

    // MARK: Singleton

    static let shared = FocusLiveActivityManager()
    private init() {}

    // MARK: Private State

    private var currentActivity: Activity<FocusActivityAttributes>?

    // MARK: - Public API

    /// Requests a new Live Activity for a Focus session.
    ///
    /// - Parameters:
    ///   - sessionId:       Stable identifier (e.g. UUID string) for this session.
    ///   - sessionName:     Human-readable session label shown on the lock screen.
    ///   - taskName:        The task currently being worked on.
    ///   - mode:            "Focus" or "Break".
    ///   - durationSeconds: How many seconds remain in the current interval.
    func startActivity(
        sessionId: String,
        sessionName: String,
        taskName: String,
        mode: String,
        durationSeconds: Int
    ) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            print("[FocusLiveActivity] Live Activities are disabled on this device.")
            return
        }

        // Clean up any stale activity from a previous session.
        terminateCurrentActivity()

        let endTime = Date().addingTimeInterval(TimeInterval(durationSeconds))

        let attributes = FocusActivityAttributes(sessionId: sessionId)

        let contentState = FocusActivityAttributes.ContentState(
            sessionName: sessionName,
            taskName: taskName,
            mode: mode,
            endTime: endTime,
            isPaused: false,
            pausedTimeRemaining: nil
        )

        do {
            currentActivity = try Activity.request(
                attributes: attributes,
                content: ActivityContent(state: contentState, staleDate: nil),
                pushType: nil
            )
        } catch {
            print("[FocusLiveActivity] Failed to start activity: \(error.localizedDescription)")
        }
    }

    /// Pushes an updated state to the running Live Activity.
    /// Call this on phase changes (focus → break) or when the user pauses/resumes.
    /// The widget's Text(timerInterval:) will handle per-second rendering;
    /// you only need to call this every 10–15 s or on meaningful state changes.
    ///
    /// - Parameters:
    ///   - sessionName:     Updated session label (usually unchanged).
    ///   - taskName:        Current task name.
    ///   - mode:            "Focus" or "Break".
    ///   - timeRemaining:   Seconds left at this moment.
    ///   - isPaused:        Whether the timer is currently paused.
    func updateActivity(
        sessionName: String,
        taskName: String,
        mode: String,
        timeRemaining: Int,
        isPaused: Bool
    ) {
        guard let activity = currentActivity else { return }

        // When running: endTime = now + timeRemaining so the widget countdown is accurate.
        // When paused: we still store endTime but the widget will display pausedTimeRemaining
        // instead of counting down.
        let endTime = Date().addingTimeInterval(TimeInterval(timeRemaining))

        let newState = FocusActivityAttributes.ContentState(
            sessionName: sessionName,
            taskName: taskName,
            mode: mode,
            endTime: endTime,
            isPaused: isPaused,
            pausedTimeRemaining: isPaused ? timeRemaining : nil
        )

        Task {
            await activity.update(
                ActivityContent(state: newState, staleDate: nil)
            )
        }
    }

    /// Ends the Live Activity, briefly showing a "Done" state before dismissal.
    ///
    /// - Parameters:
    ///   - sessionName: Session label for the final snapshot.
    ///   - taskName:    Task name for the final snapshot.
    func endActivity(sessionName: String, taskName: String) {
        guard let activity = currentActivity else { return }

        let dismissDate = Date().addingTimeInterval(4)

        let finalState = FocusActivityAttributes.ContentState(
            sessionName: sessionName,
            taskName: taskName,
            mode: "Done",
            endTime: Date(),
            isPaused: false,
            pausedTimeRemaining: nil
        )

        Task {
            await activity.end(
                ActivityContent(state: finalState, staleDate: dismissDate),
                dismissalPolicy: .after(dismissDate)
            )
            self.currentActivity = nil
        }
    }

    // MARK: - Private Helpers

    private func terminateCurrentActivity() {
        guard let activity = currentActivity else { return }
        Task {
            await activity.end(nil, dismissalPolicy: .immediate)
            self.currentActivity = nil
        }
    }
}
