// src/context/AchievementContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AchievementUnlockModal, AchievementModalData } from "../components/ui/AchievementUnlockModal";
import {
  loadTasks,
  loadStreakDays,
  loadFocusSessions,
  loadObjectives,
} from "../data/storage";

// ─── Trophy tier metadata ──────────────────────────────────────────────────
export const TROPHY_META = [
  { name: "Foundations",     icon: "ribbon-outline"  as const, color: "#CD7F32" }, // bronze
  { name: "Building Habits", icon: "medal-outline"   as const, color: "#A8A9AD" }, // silver
  { name: "Getting Serious", icon: "trophy-outline"  as const, color: "#FFD700" }, // gold
  { name: "Elite Performer", icon: "diamond-outline" as const, color: "#B9F2FF" }, // platinum
  { name: "Legend",          icon: "flame-outline"   as const, color: "#FF6B35" }, // fire
] as const;

// ─── Achievement data ──────────────────────────────────────────────────────
export type AchievementCheckData = {
  completedCount:           number;
  streakDays:               number;
  focusSessionsCount:       number;
  earlyBirdCount:           number; // sessions starting before 08:00
  nightOwlCount:            number; // sessions starting at or after 20:00
  marathon30Count:          number; // sessions >= 30 min
  marathon120Count:         number; // sessions >= 120 min
  marathon180Count:         number; // sessions >= 180 min
  objectivesCompletedCount: number;
};

export type AchievementDef = {
  id:          string;
  title:       string;
  subtitle:    string;
  icon:        keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  getProgress: (d: AchievementCheckData) => number;
  total:       number;
};

// ─── 5 trophy tiers — 7 badges each ───────────────────────────────────────
export const TROPHY_TIERS: AchievementDef[][] = [
  // ── Tier 0 — Foundations ────────────────────────────────────────────────
  [
    { id: "first_session", title: "First Focus",     subtitle: "Complete your first focus session",   icon: "timer-outline",           getProgress: (d) => Math.min(d.focusSessionsCount, 1),       total: 1  },
    { id: "first_task",    title: "First Task",       subtitle: "Complete your first task",             icon: "checkmark-circle-outline", getProgress: (d) => Math.min(d.completedCount, 1),           total: 1  },
    { id: "streak_3",      title: "3-Day Streak",     subtitle: "Log in 3 days in a row",               icon: "flame-outline",            getProgress: (d) => Math.min(d.streakDays, 3),               total: 3  },
    { id: "tasks_5",       title: "Getting Started",  subtitle: "Complete 5 tasks",                     icon: "checkmark-done-outline",   getProgress: (d) => Math.min(d.completedCount, 5),           total: 5  },
    { id: "early_bird_1",  title: "Early Bird",       subtitle: "Start a focus session before 8 AM",   icon: "sunny-outline",            getProgress: (d) => Math.min(d.earlyBirdCount, 1),           total: 1  },
    { id: "night_owl_1",   title: "Night Owl",        subtitle: "Start a focus session after 8 PM",    icon: "moon-outline",             getProgress: (d) => Math.min(d.nightOwlCount, 1),            total: 1  },
    { id: "session_30",    title: "Half Hour",         subtitle: "Complete a 30+ min focus session",    icon: "hourglass-outline",        getProgress: (d) => Math.min(d.marathon30Count, 1),          total: 1  },
  ],
  // ── Tier 1 — Building Habits ─────────────────────────────────────────────
  [
    { id: "tasks_25",      title: "Task Collector",   subtitle: "Complete 25 tasks",                    icon: "list-outline",             getProgress: (d) => Math.min(d.completedCount, 25),          total: 25 },
    { id: "streak_7",      title: "Week Warrior",     subtitle: "Maintain a 7-day login streak",        icon: "flame-outline",            getProgress: (d) => Math.min(d.streakDays, 7),               total: 7  },
    { id: "sessions_10",   title: "Focus Club",       subtitle: "Complete 10 focus sessions",           icon: "bulb-outline",             getProgress: (d) => Math.min(d.focusSessionsCount, 10),      total: 10 },
    { id: "session_120",   title: "Deep Work",        subtitle: "Complete a 120 min focus session",     icon: "alarm-outline",            getProgress: (d) => Math.min(d.marathon120Count, 1),         total: 1  },
    { id: "early_bird_5",  title: "Dawn Chaser",      subtitle: "5 focus sessions before 8 AM",         icon: "partly-sunny-outline",     getProgress: (d) => Math.min(d.earlyBirdCount, 5),           total: 5  },
    { id: "night_owl_3",   title: "Night Grinder",    subtitle: "3 focus sessions after 8 PM",          icon: "cloudy-night-outline",     getProgress: (d) => Math.min(d.nightOwlCount, 3),            total: 3  },
    { id: "objective_1",   title: "Goal Setter",      subtitle: "Complete your first objective",        icon: "flag-outline",             getProgress: (d) => Math.min(d.objectivesCompletedCount, 1), total: 1  },
  ],
  // ── Tier 2 — Getting Serious ─────────────────────────────────────────────
  [
    { id: "tasks_50",        title: "Half Century",     subtitle: "Complete 50 tasks",                   icon: "stats-chart-outline",      getProgress: (d) => Math.min(d.completedCount, 50),           total: 50  },
    { id: "streak_14",       title: "Fortnight",        subtitle: "Maintain a 14-day login streak",      icon: "flame-outline",            getProgress: (d) => Math.min(d.streakDays, 14),               total: 14  },
    { id: "sessions_25",     title: "Focus Veteran",    subtitle: "Complete 25 focus sessions",          icon: "body-outline",             getProgress: (d) => Math.min(d.focusSessionsCount, 25),       total: 25  },
    { id: "session_180",     title: "Iron Will",        subtitle: "Complete a 180 min focus session",    icon: "barbell-outline",          getProgress: (d) => Math.min(d.marathon180Count, 1),          total: 1   },
    { id: "early_bird_10",   title: "Sunrise Warrior",  subtitle: "10 focus sessions before 8 AM",      icon: "sunrise-outline",          getProgress: (d) => Math.min(d.earlyBirdCount, 10),           total: 10  },
    { id: "night_owl_10",    title: "Midnight Monk",    subtitle: "10 focus sessions after 8 PM",       icon: "moon-outline",             getProgress: (d) => Math.min(d.nightOwlCount, 10),            total: 10  },
    { id: "objectives_5",    title: "Obj. Crusher",     subtitle: "Complete 5 objectives",               icon: "trophy-outline",           getProgress: (d) => Math.min(d.objectivesCompletedCount, 5),  total: 5   },
  ],
  // ── Tier 3 — Elite Performer ─────────────────────────────────────────────
  [
    { id: "tasks_100",       title: "Century",          subtitle: "Complete 100 tasks",                  icon: "trail-sign-outline",       getProgress: (d) => Math.min(d.completedCount, 100),          total: 100 },
    { id: "streak_30",       title: "Monthly Streak",   subtitle: "Maintain a 30-day login streak",      icon: "flame-outline",            getProgress: (d) => Math.min(d.streakDays, 30),               total: 30  },
    { id: "sessions_50",     title: "Centurion",        subtitle: "Complete 50 focus sessions",          icon: "shield-checkmark-outline", getProgress: (d) => Math.min(d.focusSessionsCount, 50),       total: 50  },
    { id: "session_180_3",   title: "Endurance Beast",  subtitle: "3 sessions of 180+ min",              icon: "fitness-outline",          getProgress: (d) => Math.min(d.marathon180Count, 3),          total: 3   },
    { id: "early_bird_20",   title: "Sunrise Legend",   subtitle: "20 focus sessions before 8 AM",      icon: "sunny-outline",            getProgress: (d) => Math.min(d.earlyBirdCount, 20),           total: 20  },
    { id: "night_owl_20",    title: "Nocturnal Pro",    subtitle: "20 focus sessions after 8 PM",       icon: "telescope-outline",        getProgress: (d) => Math.min(d.nightOwlCount, 20),            total: 20  },
    { id: "objectives_10",   title: "Vision Executor",  subtitle: "Complete 10 objectives",              icon: "rocket-outline",           getProgress: (d) => Math.min(d.objectivesCompletedCount, 10), total: 10  },
  ],
  // ── Tier 4 — Legend ──────────────────────────────────────────────────────
  [
    { id: "tasks_250",       title: "Task Legend",      subtitle: "Complete 250 tasks",                  icon: "podium-outline",           getProgress: (d) => Math.min(d.completedCount, 250),          total: 250 },
    { id: "streak_60",       title: "Unstoppable",      subtitle: "Maintain a 60-day login streak",      icon: "flame-outline",            getProgress: (d) => Math.min(d.streakDays, 60),               total: 60  },
    { id: "sessions_100",    title: "Focus Legend",     subtitle: "Complete 100 focus sessions",         icon: "star-outline",             getProgress: (d) => Math.min(d.focusSessionsCount, 100),      total: 100 },
    { id: "session_180_10",  title: "Ultra Endurance",  subtitle: "10 sessions of 180+ min",             icon: "nuclear-outline",          getProgress: (d) => Math.min(d.marathon180Count, 10),         total: 10  },
    { id: "early_bird_50",   title: "Eternal Dawn",     subtitle: "50 focus sessions before 8 AM",      icon: "planet-outline",           getProgress: (d) => Math.min(d.earlyBirdCount, 50),           total: 50  },
    { id: "night_owl_50",    title: "Shadow Legend",    subtitle: "50 focus sessions after 8 PM",       icon: "eye-outline",              getProgress: (d) => Math.min(d.nightOwlCount, 50),            total: 50  },
    { id: "objectives_25",   title: "Master Planner",   subtitle: "Complete 25 objectives",              icon: "diamond-outline",          getProgress: (d) => Math.min(d.objectivesCompletedCount, 25), total: 25  },
  ],
];

/** Flat list for legacy / search consumers */
export const ACHIEVEMENT_DEFS: AchievementDef[] = TROPHY_TIERS.flat();

// ─── Storage helpers ───────────────────────────────────────────────────────
const V2_KEY = (uid: string) => `${uid}:achievements:v2`;

type V2State = { unlockedIds: string[]; completedTierCount: number };

async function loadV2(uid: string): Promise<V2State> {
  try {
    const raw = await AsyncStorage.getItem(V2_KEY(uid));
    if (!raw) return { unlockedIds: [], completedTierCount: 0 };
    const p = JSON.parse(raw);
    return {
      unlockedIds:        Array.isArray(p.unlockedIds) ? p.unlockedIds : [],
      completedTierCount: typeof p.completedTierCount === "number" ? p.completedTierCount : 0,
    };
  } catch {
    return { unlockedIds: [], completedTierCount: 0 };
  }
}

async function saveV2(uid: string, state: V2State) {
  try { await AsyncStorage.setItem(V2_KEY(uid), JSON.stringify(state)); } catch {}
}

// ─── Context ──────────────────────────────────────────────────────────────
type AchievementContextType = {
  checkAchievements:  (uid: string) => Promise<void>;
  completedTierCount: number;
};

const AchievementContext = createContext<AchievementContextType>({
  checkAchievements:  async () => {},
  completedTierCount: 0,
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
  const queue      = useRef<AchievementModalData[]>([]);
  const [current,  setCurrent]  = useState<AchievementModalData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const isShowing        = useRef(false);
  const checkInProgress  = useRef(false);          // prevents concurrent runs
  const shownInSession   = useRef<Set<string>>(new Set()); // prevents double-queue within session
  const completedTierRef = useRef(0);              // ref mirror avoids stale closure

  const [completedTierCount, setCompletedTierCount] = useState(0);

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
    setTimeout(() => processQueue(), 400);
  }, [processQueue]);

  const checkAchievements = useCallback(async (uid: string) => {
    if (!uid || checkInProgress.current) return;
    checkInProgress.current = true;
    try {
      const [tasks, sessions, streakDays, objectives] = await Promise.all([
        loadTasks(),
        loadFocusSessions(),
        loadStreakDays(),
        loadObjectives(),
      ]);

      const hour = (s: any) => parseInt(s.startTime?.split(":")[0] ?? "12", 10);

      const data: AchievementCheckData = {
        completedCount:           tasks.filter((t: any) => t.status === "completed").length,
        streakDays,
        focusSessionsCount:       sessions.length,
        earlyBirdCount:           sessions.filter((s: any) => hour(s) < 8).length,
        nightOwlCount:            sessions.filter((s: any) => hour(s) >= 20).length,
        marathon30Count:          sessions.filter((s: any) => s.minutes >= 30).length,
        marathon120Count:         sessions.filter((s: any) => s.minutes >= 120).length,
        marathon180Count:         sessions.filter((s: any) => s.minutes >= 180).length,
        objectivesCompletedCount: objectives.filter((o: any) => o.status === "completed").length,
      };

      const state    = await loadV2(uid);
      const unlocked = new Set(state.unlockedIds);
      let   tierCount = state.completedTierCount;
      let   dirty     = false;

      // Walk tiers starting at current active one
      for (let t = tierCount; t < TROPHY_TIERS.length; t++) {
        const newInTier: AchievementModalData[] = [];

        for (const def of TROPHY_TIERS[t]) {
          const alreadyQueued = shownInSession.current.has(def.id);
          if (!unlocked.has(def.id) && !alreadyQueued && def.getProgress(data) >= def.total) {
            newInTier.push({ id: def.id, title: def.title, subtitle: def.subtitle, icon: def.icon });
            unlocked.add(def.id);
            shownInSession.current.add(def.id);
            dirty = true;
          }
        }

        queue.current.push(...newInTier);

        // If entire tier is now complete, award trophy + unlock next
        const trophyId = `trophy_${t}`;
        if (
          TROPHY_TIERS[t].every((def) => unlocked.has(def.id)) &&
          tierCount <= t &&
          !shownInSession.current.has(trophyId)
        ) {
          tierCount = t + 1;
          dirty = true;
          shownInSession.current.add(trophyId);
          const meta = TROPHY_META[t];
          queue.current.push({
            id:       trophyId,
            title:    "Trophy Earned! 🏆",
            subtitle: `${meta.name} — all 7 badges unlocked`,
            icon:     "trophy",
          });
        }

        // Stop at tier boundary
        if (t >= tierCount) break;
      }

      if (dirty) {
        // Persist BEFORE processQueue so re-entrant calls see the updated state
        await saveV2(uid, { unlockedIds: Array.from(unlocked), completedTierCount: tierCount });
        completedTierRef.current = tierCount;
        setCompletedTierCount(tierCount);
      } else if (completedTierRef.current !== tierCount) {
        completedTierRef.current = tierCount;
        setCompletedTierCount(tierCount);
      }

      processQueue();
    } catch (err) {
      console.log("[AchievementContext] error:", err);
    } finally {
      checkInProgress.current = false;
    }
  }, [processQueue]);

  return (
    <AchievementContext.Provider value={{ checkAchievements, completedTierCount }}>
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