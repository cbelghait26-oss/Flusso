// src/context/AchievementContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AchievementUnlockModal, AchievementModalData } from "../components/ui/AchievementUnlockModal";
import {
  loadTasks,
  loadStreakDays,
  loadFocusSessions,
} from "../data/storage";

// ─── Achievement definitions (single source of truth) ─────────────────────
// These mirror the badges array in SettingsScreen exactly.
// If you add a badge there, add it here too.

export type AchievementDef = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  /** Returns true if the achievement should be considered unlocked */
  check: (data: AchievementCheckData) => boolean;
};

export type AchievementCheckData = {
  completedCount: number;
  streakDays: number;
  focusSessionsCount: number;
  earlyBirdCount: number;
  nightOwlCount: number;
  marathonCount: number;
};

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: "first_task",
    title: "First Task",
    subtitle: "Complete your first task",
    icon: "checkmark-circle-outline",
    check: (d) => d.completedCount >= 1,
  },
  {
    id: "streak_7",
    title: "7-Day Streak",
    subtitle: "Maintain a 7-day login streak",
    icon: "flame-outline",
    check: (d) => d.streakDays >= 7,
  },
  {
    id: "focus_10",
    title: "Focus Master",
    subtitle: "Complete 10 focus sessions",
    icon: "bulb-outline",
    check: (d) => d.focusSessionsCount >= 10,
  },
  {
    id: "early",
    title: "Early Bird",
    subtitle: "Start a focus session before 8 AM",
    icon: "sunny-outline",
    check: (d) => d.earlyBirdCount >= 1,
  },
  {
    id: "night",
    title: "Night Owl",
    subtitle: "Focus session after 8 PM",
    icon: "moon-outline",
    check: (d) => d.nightOwlCount >= 1,
  },
  {
    id: "marathon",
    title: "Marathon",
    subtitle: "Complete a 120 min focus session",
    icon: "walk-outline",
    check: (d) => d.marathonCount >= 1,
  },
];

// ─── AsyncStorage key ─────────────────────────────────────────────────────
const UNLOCKED_KEY = (uid: string) => `${uid}:achievements:unlocked`;

async function loadUnlockedIds(uid: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(UNLOCKED_KEY(uid));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

async function saveUnlockedIds(uid: string, ids: Set<string>) {
  try {
    await AsyncStorage.setItem(UNLOCKED_KEY(uid), JSON.stringify(Array.from(ids)));
  } catch {
    // non-blocking
  }
}

// ─── Context ──────────────────────────────────────────────────────────────
type AchievementContextType = {
  /**
   * Call this after any action that might unlock an achievement:
   * - task completed
   * - focus session saved
   * - app launch (streak check)
   *
   * Pass the current user uid so we can namespace storage correctly.
   */
  checkAchievements: (uid: string) => Promise<void>;
};

const AchievementContext = createContext<AchievementContextType>({
  checkAchievements: async () => {},
});

export function useAchievements() {
  return useContext(AchievementContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────
export function AchievementProvider({
  children,
  accentColor,
}: {
  children: React.ReactNode;
  accentColor?: string;
}) {
  // Queue of achievements waiting to be shown
  const queue = useRef<AchievementModalData[]>([]);
  const [current, setCurrent] = useState<AchievementModalData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const isShowing = useRef(false);

  // ── Process queue ────────────────────────────────────────────────────────
  const processQueue = useCallback(() => {
    if (isShowing.current || queue.current.length === 0) return;
    const next = queue.current.shift()!;
    isShowing.current = true;
    setCurrent(next);
    setModalVisible(true);
  }, []);

  const handleDismiss = useCallback(() => {
    setModalVisible(false);
    isShowing.current = false;
    // Small delay before showing next so modals don't stack
    setTimeout(() => {
      processQueue();
    }, 400);
  }, [processQueue]);

  // ── Main check function ──────────────────────────────────────────────────
  const checkAchievements = useCallback(async (uid: string) => {
    if (!uid) return;

    try {
      // Load current state from storage
      const [tasks, sessions, streakDays] = await Promise.all([
        loadTasks(),
        loadFocusSessions(),
        loadStreakDays(),
      ]);

      const completedCount = tasks.filter((t: any) => t.status === "completed").length;
      const focusSessionsCount = sessions.length;
      const earlyBirdCount = sessions.some(
        (s: any) => parseInt(s.startTime?.split(":")[0] ?? "12") < 8
      ) ? 1 : 0;
      const nightOwlCount = sessions.some(
        (s: any) => parseInt(s.startTime?.split(":")[0] ?? "12") >= 20
      ) ? 1 : 0;
      const marathonCount = sessions.some((s: any) => s.minutes >= 120) ? 1 : 0;

      const data: AchievementCheckData = {
        completedCount,
        streakDays,
        focusSessionsCount,
        earlyBirdCount,
        nightOwlCount,
        marathonCount,
      };

      // Load which achievements have already been shown/persisted
      const alreadyUnlocked = await loadUnlockedIds(uid);

      // Find newly unlocked achievements
      const newlyUnlocked: AchievementModalData[] = [];
      for (const def of ACHIEVEMENT_DEFS) {
        if (!alreadyUnlocked.has(def.id) && def.check(data)) {
          newlyUnlocked.push({
            id: def.id,
            title: def.title,
            subtitle: def.subtitle,
            icon: def.icon,
          });
          alreadyUnlocked.add(def.id);
        }
      }

      if (newlyUnlocked.length === 0) return;

      // Persist immediately so we never show again even if app closes mid-queue
      await saveUnlockedIds(uid, alreadyUnlocked);

      // Enqueue
      queue.current.push(...newlyUnlocked);
      processQueue();
    } catch (err) {
      // Non-blocking — achievements should never crash the app
      console.log("[AchievementContext] checkAchievements error:", err);
    }
  }, [processQueue]);

  return (
    <AchievementContext.Provider value={{ checkAchievements }}>
      {children}
      <AchievementUnlockModal
        visible={modalVisible}
        achievement={current}
        accentColor={accentColor}
        onDismiss={handleDismiss}
      />
    </AchievementContext.Provider>
  );
}