// index.ts
// Public TypeScript API for the focus-live-activity module.
// Only resolves the native module on iOS; all calls are no-ops on Android/web.

import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StartActivityParams {
  /** Stable unique ID for the session (e.g. UUID). */
  sessionId: string;
  /** Human-readable session label, e.g. "Morning Focus". */
  sessionName: string;
  /** The task currently being worked on, e.g. "Math". */
  taskName: string;
  /** "Focus" | "Break" */
  mode: "Focus" | "Break";
  /** Total seconds in the current interval. */
  durationSeconds: number;
}

export interface UpdateActivityParams {
  sessionName: string;
  taskName: string;
  mode: "Focus" | "Break";
  /** Seconds left at the moment of this update. */
  timeRemaining: number;
  isPaused: boolean;
}

export interface EndActivityParams {
  sessionName: string;
  taskName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module resolution (lazy, iOS only)
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _native: any = null;

function native() {
  if (Platform.OS !== "ios") return null;
  if (!_native) {
    try {
      // expo-modules-core is already a peer dep of Expo — no extra install needed.
      const { requireNativeModule } = require("expo-modules-core");
      _native = requireNativeModule("FocusLiveActivity");
    } catch {
      // Module not linked (e.g. Expo Go without prebuild) — degrade silently.
    }
  }
  return _native;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when Live Activities are available and enabled by the user.
 * Always false on non-iOS platforms.
 */
export function isLiveActivityAvailable(): boolean {
  return native()?.isAvailable() ?? false;
}

/**
 * Starts a Live Activity for a new Focus Zone session.
 * Safe to call even if Live Activities are not supported — the call is a no-op.
 */
export async function startFocusActivity(
  params: StartActivityParams
): Promise<void> {
  const mod = native();
  if (!mod?.isAvailable()) return;
  await mod.startActivity(
    params.sessionId,
    params.sessionName,
    params.taskName,
    params.mode,
    params.durationSeconds
  );
}

/**
 * Pushes updated state to an active Live Activity.
 * Call this on phase transitions or pause/resume — NOT every second.
 * The widget renders its own live countdown via Text(timerInterval:).
 */
export async function updateFocusActivity(
  params: UpdateActivityParams
): Promise<void> {
  const mod = native();
  if (!mod) return;
  await mod.updateActivity(
    params.sessionName,
    params.taskName,
    params.mode,
    params.timeRemaining,
    params.isPaused
  );
}

/**
 * Ends the Live Activity, briefly showing a "Done" state before it dismisses.
 */
export async function endFocusActivity(
  params: EndActivityParams
): Promise<void> {
  const mod = native();
  if (!mod) return;
  await mod.endActivity(params.sessionName, params.taskName);
}
