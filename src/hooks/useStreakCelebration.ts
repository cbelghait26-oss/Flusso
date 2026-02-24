// src/hooks/useStreakCelebration.ts
import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateLoginStreak, todayKey } from "../data/storage";

// Key to track the last date we showed the celebration
const STREAK_SHOWN_KEY = (uid: string) => `${uid}:streak:celebrationShownDate`;
// Key to persist this week's activity array
const WEEK_ACTIVITY_KEY = (uid: string) => `${uid}:streak:weekActivity`;

export type StreakCelebrationState = {
  visible: boolean;
  streakCount: number;
  previousStreak: number;
  /** 7 booleans Mon(0)→Sun(6) */
  weekActivity: boolean[];
};

const DEFAULT_STATE: StreakCelebrationState = {
  visible: false,
  streakCount: 0,
  previousStreak: 0,
  weekActivity: Array(7).fill(false),
};

/**
 * Returns { state, checkAndShowStreak, dismissStreak }
 *
 * Call `checkAndShowStreak(uid)` once after auth + data hydration.
 * It will show the modal at most once per calendar day.
 */
export function useStreakCelebration() {
  const [state, setState] = useState<StreakCelebrationState>(DEFAULT_STATE);

  const checkAndShowStreak = useCallback(async (uid: string) => {
    try {
      const today = todayKey();

      // ── Gate: only show once per day ─────────────────────────────────
      const lastShown = await AsyncStorage.getItem(STREAK_SHOWN_KEY(uid));
      if (lastShown === today) return; // already shown today, do nothing

      // ── Update streak (this is the source of truth) ───────────────────
      // updateLoginStreak returns the NEW streak count and saves internally
      const newStreak = await updateLoginStreak();

      // ── Load week activity from storage ───────────────────────────────
      // weekActivity is a 7-element boolean array [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
      // We store it as JSON and update today's slot
      let weekActivity: boolean[] = Array(7).fill(false);
      try {
        const raw = await AsyncStorage.getItem(WEEK_ACTIVITY_KEY(uid));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length === 7) {
            weekActivity = parsed;
          }
        }
      } catch {
        // corrupted data, use fresh array
      }

      // ── Check if we crossed a new ISO week; if so, reset the array ────
      // ISO weekday: getDay() returns 0=Sun…6=Sat, we want 0=Mon…6=Sun
      const todayDate = new Date();
      const jsDay = todayDate.getDay(); // 0=Sun, 1=Mon…6=Sat
      const isoDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon…6=Sun

      // If Monday (isoDay === 0), reset the array for the new week
      if (isoDay === 0) {
        weekActivity = Array(7).fill(false);
      }

      // Mark today active
      weekActivity[isoDay] = true;

      // Persist updated activity
      await AsyncStorage.setItem(
        WEEK_ACTIVITY_KEY(uid),
        JSON.stringify(weekActivity)
      );

      // ── Compute previousStreak for the count-up animation ─────────────
      // If streak is 1, it either just started or reset — animate 0 → 1
      // Otherwise animate (newStreak - 1) → newStreak
      const previousStreak = newStreak <= 1 ? 0 : newStreak - 1;

      // ── Mark as shown today ───────────────────────────────────────────
      await AsyncStorage.setItem(STREAK_SHOWN_KEY(uid), today);

      // ── Show modal ────────────────────────────────────────────────────
      setState({
        visible: true,
        streakCount: newStreak,
        previousStreak,
        weekActivity,
      });
    } catch (err) {
      // Non-blocking: if anything fails, app continues normally
      console.log("[useStreakCelebration] error:", err);
    }
  }, []);

  const dismissStreak = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  return { state, checkAndShowStreak, dismissStreak };
}