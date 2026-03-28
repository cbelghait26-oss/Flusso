// FocusLiveActivityModule.swift
// Expo native module — bridges React Native JS calls to FocusLiveActivityManager.
// The timer countdown is handled by the widget's SwiftUI Text(timerInterval:);
// JS only needs to call these methods on session lifecycle events.

import ExpoModulesCore
import ActivityKit

public class FocusLiveActivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("FocusLiveActivity")

        // MARK: isAvailable
        // Returns true if the device supports Live Activities and they are enabled.
        Function("isAvailable") { () -> Bool in
            if #available(iOS 16.1, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

        // MARK: startActivity
        // Called when the user enters Focus Zone. Starts a new Live Activity.
        //
        // Param order: sessionId, sessionName, taskName, mode, durationSeconds
        AsyncFunction("startActivity") { (
            sessionId: String,
            sessionName: String,
            taskName: String,
            mode: String,
            durationSeconds: Int
        ) in
            if #available(iOS 16.1, *) {
                FocusLiveActivityManager.shared.startActivity(
                    sessionId: sessionId,
                    sessionName: sessionName,
                    taskName: taskName,
                    mode: mode,
                    durationSeconds: durationSeconds
                )
            }
        }

        // MARK: updateActivity
        // Called on phase transitions (focus → break) or pause/resume events.
        // Do NOT call every second — the widget renders its own countdown.
        //
        // Param order: sessionName, taskName, mode, timeRemaining, isPaused
        AsyncFunction("updateActivity") { (
            sessionName: String,
            taskName: String,
            mode: String,
            timeRemaining: Int,
            isPaused: Bool
        ) in
            if #available(iOS 16.1, *) {
                FocusLiveActivityManager.shared.updateActivity(
                    sessionName: sessionName,
                    taskName: taskName,
                    mode: mode,
                    timeRemaining: timeRemaining,
                    isPaused: isPaused
                )
            }
        }

        // MARK: endActivity
        // Called when the session completes or the user manually exits Focus Zone.
        //
        // Param order: sessionName, taskName
        AsyncFunction("endActivity") { (
            sessionName: String,
            taskName: String
        ) in
            if #available(iOS 16.1, *) {
                FocusLiveActivityManager.shared.endActivity(
                    sessionName: sessionName,
                    taskName: taskName
                )
            }
        }
    }
}
