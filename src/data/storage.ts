import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, setDoc, getDoc, collection, getDocs, writeBatch, deleteDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import type { Objective, Task, CalendarEvent } from "./models";

const STATIC_KEYS = {
  CURRENT_USER: "auth:currentUser",
};

let currentUserId: string | null = null;

const KEYS = {
  SETUP: () => `${currentUserId}:setup:payload`,
  OBJECTIVES: () => `${currentUserId}:data:objectives`,
  TASKS: () => `${currentUserId}:data:tasks`,
  CAL_EVENTS: () => `${currentUserId}:data:calendarEvents`,
  LOCAL_EVENTS: () => `${currentUserId}:calendar:events`,
  FOCUS_MIN_TODAY: () => `${currentUserId}:focus:minutesToday`,
  FOCUS_DATE: () => `${currentUserId}:focus:lastDate`,
  FOCUS_SESSIONS: () => `${currentUserId}:focus:sessions`,
  STREAK_DAYS: () => `${currentUserId}:streak:days`,
  LAST_LOGIN_DATE: () => `${currentUserId}:streak:lastLoginDate`,
  DAILY_GOAL: () => `${currentUserId}:goal:dailyTaskCount`,
  THEME_MODE: () => `${currentUserId}:theme:mode`,
  THEME_ACCENT: () => `${currentUserId}:theme:accent`,
  FOCUS_BG: () => `${currentUserId}:focus:background`,
  FOCUS_MINUTES: () => `${currentUserId}:focus:minutes`,
  BREAK_MINUTES: () => `${currentUserId}:break:minutes`,
};

// ========== Cloud Sync Helpers ==========

/**
 * Sync data to Firestore cloud storage (silent, non-blocking)
 */
async function syncToCloud(collection: string, data: any) {
  if (!currentUserId) return;
  
  // Add timeout to prevent hanging
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Cloud sync timeout')), 10000)
  );
  
  const syncOp = (async () => {
    const docRef = doc(db, "users", currentUserId, collection, "data");
    await setDoc(docRef, { content: data, updatedAt: new Date().toISOString() });
  })();
  
  try {
    await Promise.race([syncOp, timeout]);
  } catch (error) {
    // Silently fail - app works offline
    console.log(`syncToCloud: ${collection} sync failed (non-blocking)`);
  }
}

/**
 * Load data from Firestore cloud storage (with timeout)
 */
async function loadFromCloud(collection: string): Promise<any | null> {
  if (!currentUserId) return null;
  
  // Add timeout to prevent hanging (5 seconds for reads)
  const timeout = new Promise<null>((resolve) => 
    setTimeout(() => resolve(null), 5000)
  );
  
  const loadOp = (async () => {
    const docRef = doc(db, "users", currentUserId, collection, "data");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().content;
    }
    return null;
  })();
  
  try {
    return await Promise.race([loadOp, timeout]);
  } catch (error) {
    // Silently fail - app works offline
    console.log(`loadFromCloud: ${collection} load failed (non-blocking)`);
    return null;
  }
}

/**
 * Sync all user data from cloud to local storage on login
 */
export async function syncFromCloud() {
  if (!currentUserId) return;
  
  try {
    // Load all collections from cloud
    const [
      objectives,
      tasks,
      events,
      localEvents,
      setup,
      focusSessions,
      streak,
      dailyGoal
    ] = await Promise.all([
      loadFromCloud("objectives"),
      loadFromCloud("tasks"),
      loadFromCloud("calendarEvents"),
      loadFromCloud("localEvents"),
      loadFromCloud("setup"),
      loadFromCloud("focusSessions"),
      loadFromCloud("streak"),
      loadFromCloud("dailyGoal"),
    ]);

    // Save to local storage
    if (objectives) await AsyncStorage.setItem(KEYS.OBJECTIVES(), JSON.stringify(objectives));
    if (tasks) await AsyncStorage.setItem(KEYS.TASKS(), JSON.stringify(tasks));
    if (events) await AsyncStorage.setItem(KEYS.CAL_EVENTS(), JSON.stringify(events));
    if (localEvents) await AsyncStorage.setItem(KEYS.LOCAL_EVENTS(), JSON.stringify(localEvents));
    if (setup) await AsyncStorage.setItem(KEYS.SETUP(), JSON.stringify(setup));
    if (focusSessions) await AsyncStorage.setItem(KEYS.FOCUS_SESSIONS(), JSON.stringify(focusSessions));
    if (streak?.days) await AsyncStorage.setItem(KEYS.STREAK_DAYS(), String(streak.days));
    if (dailyGoal?.goal) await AsyncStorage.setItem(KEYS.DAILY_GOAL(), String(dailyGoal.goal));
  } catch (error) {
    // Silently fail - app works with local data
  }
}

/**
 * Set the current user ID for storage isolation
 */
export async function setCurrentUser(userId: string) {
  currentUserId = userId;
  await AsyncStorage.setItem(STATIC_KEYS.CURRENT_USER, userId);
  // Sync data from cloud (blocking to ensure data is ready)
  console.log("setCurrentUser: Starting cloud sync...");
  try {
    await syncFromCloud();
    console.log("setCurrentUser: Cloud sync completed");
  } catch (error) {
    console.log("setCurrentUser: Cloud sync failed (non-blocking)", error);
  }
}

/**
 * Get the current user ID
 */
export async function getCurrentUser(): Promise<string | null> {
  if (currentUserId) return currentUserId;
  currentUserId = await AsyncStorage.getItem(STATIC_KEYS.CURRENT_USER);
  return currentUserId;
}

/**
 * Clear all user data and sign out
 */
export async function clearUserData() {
  if (!currentUserId) return;
  
  const userKeys = [
    KEYS.SETUP(),
    KEYS.OBJECTIVES(),
    KEYS.TASKS(),
    KEYS.CAL_EVENTS(),
    KEYS.LOCAL_EVENTS(),
    KEYS.FOCUS_MIN_TODAY(),
    KEYS.FOCUS_DATE(),
    KEYS.FOCUS_SESSIONS(),
    KEYS.STREAK_DAYS(),
    KEYS.LAST_LOGIN_DATE(),
    KEYS.DAILY_GOAL(),
    KEYS.THEME_MODE(),
    KEYS.THEME_ACCENT(),
    KEYS.FOCUS_BG(),
    KEYS.FOCUS_MINUTES(),
    KEYS.BREAK_MINUTES(),
  ];
  
  await AsyncStorage.multiRemove(userKeys);
  await AsyncStorage.removeItem(STATIC_KEYS.CURRENT_USER);
  currentUserId = null;
}

/**
 * Delete all user data from Firestore cloud (for account deletion)
 * Deletes all collections in parallel for faster performance
 */
export async function deleteAllCloudData() {
  if (!currentUserId) {
    console.error("deleteAllCloudData: No current user ID");
    return;
  }
  
  console.log("deleteAllCloudData: Deleting all cloud data for user:", currentUserId);
  
  try {
    // List of all collections to delete
    const collections = [
      "objectives",
      "tasks",
      "calendarEvents",
      "localEvents",
      "setup",
      "focusSessions",
      "streak",
      "dailyGoal",
    ];
    
    // Delete all collections in parallel for faster performance
    const deletePromises = collections.map(async (collectionName) => {
      try {
        const docRef = doc(db, "users", currentUserId, collectionName, "data");
        await deleteDoc(docRef);
        console.log(`deleteAllCloudData: Deleted ${collectionName}`);
      } catch (error) {
        // Log but don't fail if collection doesn't exist
        console.log(`deleteAllCloudData: Error deleting ${collectionName}:`, error);
      }
    });
    
    await Promise.all(deletePromises);
    console.log("deleteAllCloudData: All cloud data deleted successfully");
  } catch (error) {
    console.error("deleteAllCloudData: Error deleting cloud data:", error);
    throw error;
  }
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function loadObjectives(): Promise<Objective[]> {
  if (!currentUserId) return [];
  const raw = await AsyncStorage.getItem(KEYS.OBJECTIVES());
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Objective[];
  } catch {
    return [];
  }
}

export async function saveObjectives(objs: Objective[]) {
  if (!currentUserId) return;
  await AsyncStorage.setItem(KEYS.OBJECTIVES(), JSON.stringify(objs));
  // Fire and forget - don't block on cloud sync
  syncToCloud("objectives", objs).catch((e) => {
    console.log("saveObjectives: Cloud sync failed (non-blocking)");
  });
}

export async function ensureDefaultObjective(): Promise<Objective> {
  const objs = await loadObjectives();
  const existing = objs.find((o) => o.title.trim().toLowerCase() === "miscellaneous");
  if (existing) return existing;

  const created: Objective = {
    id: uid("obj"),
    title: "Miscellaneous",
    description: "Unsorted tasks",
    category: "Misc",
    color: "gray",
    createdAt: new Date().toISOString(),
    status: "active",
  };

  await saveObjectives([created, ...objs]);
  return created;
}

export async function loadTasks(): Promise<Task[]> {
  if (!currentUserId) return [];
  const raw = await AsyncStorage.getItem(KEYS.TASKS());
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Task[];
  } catch {
    return [];
  }
}

export async function saveTasks(tasks: Task[]) {
  if (!currentUserId) return;
  await AsyncStorage.setItem(KEYS.TASKS(), JSON.stringify(tasks));
  // Fire and forget - don't block on cloud sync
  syncToCloud("tasks", tasks).catch((e) => {
    console.log("saveTasks: Cloud sync failed (non-blocking)");
  });
}

export async function addTask(input: {
  title: string;
  objectiveId: string;
  description?: string;
  deadline?: string;
  importance: Task["importance"];
  status: Task["status"];
}) {
  const tasks = await loadTasks();
  const t: Task = {
    id: uid("task"),
    title: input.title.trim(),
    objectiveId: input.objectiveId,
    description: input.description?.trim() || undefined,
    deadline: input.deadline,
    importance: input.importance,
    status: input.status,
    createdAt: new Date().toISOString(),
    completedAt: input.status === "completed" ? new Date().toISOString() : null,
  };
  await saveTasks([t, ...tasks]);
  await syncCalendarFromTasks();
  return t;
}

export async function updateTask(taskId: string, patch: Partial<Task>) {
  const tasks = await loadTasks();
  const next = tasks.map((t) => {
    if (t.id !== taskId) return t;
    
    const updated = { ...t, ...patch };
    
    // Automatically set completedAt when marking as completed
    if (updated.status === "completed" && !updated.completedAt) {
      updated.completedAt = new Date().toISOString();
    }
    
    // Clear completedAt if unmarking as completed
    if (updated.status !== "completed" && updated.completedAt) {
      updated.completedAt = null;
    }
    
    return updated;
  });
  await saveTasks(next);
  await syncCalendarFromTasks();
}

export async function deleteTask(taskId: string) {
  const tasks = await loadTasks();
  const next = tasks.filter((t) => t.id !== taskId);
  await saveTasks(next);
  await syncCalendarFromTasks();
}

export async function addObjective(input: {
  title: string;
  description?: string;
  category: Objective["category"];
  color: Objective["color"];
  deadline?: string;
}) {
  const objs = await loadObjectives();
  const o: Objective = {
    id: uid("obj"),
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    category: input.category,
    color: input.color,
    deadline: input.deadline,
    createdAt: new Date().toISOString(),
    status: "active",
  };
  await saveObjectives([o, ...objs]);
  return o;
}

export async function updateObjective(objectiveId: string, patch: Partial<Objective>) {
  const objs = await loadObjectives();
  const next = objs.map((o) => (o.id === objectiveId ? { ...o, ...patch } : o));
  await saveObjectives(next);
}

export async function deleteObjective(objectiveId: string) {
  // cascade delete tasks
  const objs = await loadObjectives();
  const nextObjs = objs.filter((o) => o.id !== objectiveId);
  await saveObjectives(nextObjs);

  const tasks = await loadTasks();
  const nextTasks = tasks.filter((t) => t.objectiveId !== objectiveId);
  await saveTasks(nextTasks);

  await syncCalendarFromTasks();
}

export async function setObjectiveCompleted(objectiveId: string, completed: boolean) {
  await updateObjective(objectiveId, { status: completed ? "completed" : "active" });
}

export async function loadCalendarEvents(): Promise<CalendarEvent[]> {
  if (!currentUserId) return [];
  const raw = await AsyncStorage.getItem(KEYS.CAL_EVENTS());
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CalendarEvent[];
  } catch {
    return [];
  }
}

export async function saveCalendarEvents(events: CalendarEvent[]) {
  if (!currentUserId) return;
  await AsyncStorage.setItem(KEYS.CAL_EVENTS(), JSON.stringify(events));
  syncToCloud("calendarEvents", events).catch(() => {});
}

export async function syncCalendarFromTasks() {
  const tasks = await loadTasks();
  const objectives = await loadObjectives();

  const events: CalendarEvent[] = tasks
    .filter((t) => !!t.deadline)
    .map((t) => {
      const obj = objectives.find((o) => o.id === t.objectiveId);
      return {
        id: `evt_task_${t.id}`,
        title: obj ? `${t.title} · ${obj.title}` : t.title,
        date: t.deadline!,
        source: "task-deadline",
        meta: { taskId: t.id, objectiveId: t.objectiveId },
      };
    });

  // keep manual/google events if present
  const existing = await loadCalendarEvents();
  const keep = existing.filter((e) => e.source !== "task-deadline");
  await saveCalendarEvents([...events, ...keep]);
}
export async function saveSetupName(name: string) {
  // Ensure currentUserId is loaded
  if (!currentUserId) {
    await getCurrentUser();
  }
  if (!currentUserId) {
    console.error("saveSetupName: No current user ID");
    return;
  }
  
  console.log("saveSetupName: Saving for user:", currentUserId);
  const raw = await AsyncStorage.getItem(KEYS.SETUP());
  let parsed: any = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }
  parsed.name = name.trim();
  console.log("saveSetupName: About to save to AsyncStorage");
  await AsyncStorage.setItem(KEYS.SETUP(), JSON.stringify(parsed));
  console.log("saveSetupName: Saved to AsyncStorage, syncing to cloud");
  
  // Fire and forget - don't block on cloud sync
  syncToCloud("setup", parsed).catch((e) => {
    console.error("saveSetupName: Cloud sync failed (non-blocking):", e);
  });
  
  console.log("saveSetupName: Complete");
}

export async function loadSetupName(): Promise<string | null> {
  if (!currentUserId) return null;
  const raw = await AsyncStorage.getItem(KEYS.SETUP());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.name || null;
  } catch {
    return null;
  }
}

/**
 * Save setup completion status to cloud and local storage
 */
export async function saveSetupComplete(isComplete: boolean) {
  // Ensure currentUserId is loaded
  if (!currentUserId) {
    await getCurrentUser();
  }
  if (!currentUserId) {
    console.error("saveSetupComplete: No current user ID");
    return;
  }
  
  console.log("saveSetupComplete: Saving for user:", currentUserId);
  const raw = await AsyncStorage.getItem(KEYS.SETUP());
  let parsed: any = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }
  parsed.setupComplete = isComplete;
  console.log("saveSetupComplete: About to save to AsyncStorage");
  await AsyncStorage.setItem(KEYS.SETUP(), JSON.stringify(parsed));
  console.log("saveSetupComplete: Saved to AsyncStorage, syncing to cloud");
  
  // Fire and forget - don't block on cloud sync
  syncToCloud("setup", parsed).catch((e) => {
    console.error("saveSetupComplete: Cloud sync failed (non-blocking):", e);
  });
  
  console.log("saveSetupComplete: Complete");
}

/**
 * Save complete setup data (name, targetLevel, targetMinutesPerDay, etc.)
 */
export async function saveSetupData(setupData: any) {
  // Ensure currentUserId is loaded
  if (!currentUserId) {
    await getCurrentUser();
  }
  if (!currentUserId) {
    console.error("saveSetupData: No current user ID");
    return;
  }
  
  console.log("saveSetupData: Saving for user:", currentUserId, setupData);
  await AsyncStorage.setItem(KEYS.SETUP(), JSON.stringify(setupData));
  console.log("saveSetupData: Saved to AsyncStorage, syncing to cloud");
  
  // Fire and forget - don't block on cloud sync
  syncToCloud("setup", setupData).catch((e) => {
    console.error("saveSetupData: Cloud sync failed (non-blocking):", e);
  });
  
  console.log("saveSetupData: Complete");
}

/**
 * Load complete setup data from cloud or local storage
 */
export async function loadSetupData(): Promise<any | null> {
  // Ensure currentUserId is loaded
  if (!currentUserId) {
    await getCurrentUser();
  }
  if (!currentUserId) return null;
  
  // Try to load from cloud first for multi-device sync
  try {
    const cloudData = await loadFromCloud("setup");
    if (cloudData) {
      console.log("loadSetupData: Loaded from cloud:", cloudData);
      // Save to local storage for offline access
      await AsyncStorage.setItem(KEYS.SETUP(), JSON.stringify(cloudData));
      return cloudData;
    }
  } catch (error) {
    console.log("loadSetupData: Cloud load failed, falling back to local");
  }
  
  // Fallback to local storage
  const raw = await AsyncStorage.getItem(KEYS.SETUP());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    console.log("loadSetupData: Loaded from local:", parsed);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Load setup completion status - reads from local storage (instant)
 * Cloud sync happens in setCurrentUser(), so data is already local
 */
export async function loadSetupComplete(): Promise<boolean> {
  // Ensure currentUserId is loaded
  if (!currentUserId) {
    await getCurrentUser();
  }
  if (!currentUserId) return false;
  
  // Read from local storage (instant - cloud sync already happened in setCurrentUser)
  const raw = await AsyncStorage.getItem(KEYS.SETUP());
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    const setupComplete = parsed.setupComplete ?? false;
    console.log("loadSetupComplete: Loaded from local storage (instant):", setupComplete);
    return setupComplete;
  } catch {
    return false;
  }
}

export async function loadFocusMinutesToday(): Promise<number> {
  if (!currentUserId) return 0;
  const today = todayKey();
  const lastDate = await AsyncStorage.getItem(KEYS.FOCUS_DATE());
  
  // Reset if new day
  if (lastDate !== today) {
    await AsyncStorage.setItem(KEYS.FOCUS_MIN_TODAY(), "0");
    await AsyncStorage.setItem(KEYS.FOCUS_DATE(), today);
    return 0;
  }
  
  const raw = await AsyncStorage.getItem(KEYS.FOCUS_MIN_TODAY());
  return raw ? Number(raw) || 0 : 0;
}

export async function addFocusMinutes(minutes: number) {
  if (!currentUserId) return 0;
  const current = await loadFocusMinutesToday();
  const newTotal = current + minutes;
  const today = todayKey();
  
  
  await AsyncStorage.setItem(KEYS.FOCUS_MIN_TODAY(), String(newTotal));
  await AsyncStorage.setItem(KEYS.FOCUS_DATE(), today);
  
  return newTotal;
}

export async function loadStreakDays(): Promise<number> {
  if (!currentUserId) return 0;
  const raw = await AsyncStorage.getItem(KEYS.STREAK_DAYS());
  return raw ? Number(raw) || 0 : 0;
}

export async function saveStreakDays(days: number) {
  if (!currentUserId) return;
  await AsyncStorage.setItem(KEYS.STREAK_DAYS(), String(days));
  syncToCloud("streak", { days }).catch(() => {});
}

// Update streak based on login dates
export async function updateLoginStreak(): Promise<number> {
  if (!currentUserId) return 0;
  const today = todayKey();
  const lastLogin = await AsyncStorage.getItem(KEYS.LAST_LOGIN_DATE());
  const currentStreak = await loadStreakDays();

  if (!lastLogin) {
    // First login
    await AsyncStorage.setItem(KEYS.LAST_LOGIN_DATE(), today);
    await saveStreakDays(1);
    return 1;
  }

  if (lastLogin === today) {
    // Already logged in today, keep streak
    return currentStreak;
  }

  // Calculate days difference
  const lastDate = new Date(lastLogin);
  const todayDate = new Date(today);
  const diffTime = todayDate.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let newStreak: number;
  if (diffDays === 1) {
    // Logged in yesterday, increment streak
    newStreak = currentStreak + 1;
  } else if (diffDays > 1) {
    // Missed days, reset streak
    newStreak = 1;
  } else {
    // Same day or future (shouldn't happen)
    newStreak = currentStreak;
  }

  await AsyncStorage.setItem(KEYS.LAST_LOGIN_DATE(), today);
  await saveStreakDays(newStreak);
  return newStreak;
}

type FocusSession = {
  date: string;
  startTime: string;
  minutes: number;
  taskId?: string;
};

export async function saveFocusSession(session: FocusSession) {
  if (!currentUserId) return [];
  const raw = await AsyncStorage.getItem(KEYS.FOCUS_SESSIONS());
  let sessions: FocusSession[] = [];
  
  try {
    sessions = raw ? JSON.parse(raw) : [];
  } catch {
    sessions = [];
  }
  

  sessions.push(session);
  
  await AsyncStorage.setItem(KEYS.FOCUS_SESSIONS(), JSON.stringify(sessions));
  syncToCloud("focusSessions", sessions).catch(() => {});
  
  // Add to daily total
  await addFocusMinutes(session.minutes);
  
  return sessions;
}

export async function loadFocusSessions(): Promise<FocusSession[]> {
  if (!currentUserId) return [];
  const raw = await AsyncStorage.getItem(KEYS.FOCUS_SESSIONS());
  if (!raw) return [];
  try {
    return JSON.parse(raw) as FocusSession[];
  } catch {
    return [];
  }
}

// ========== Daily Goal Tracking ==========

/**
 * Load the user's custom daily goal target (default 5 tasks)
 */
export async function loadDailyGoal(): Promise<number> {
  if (!currentUserId) return 5;
  const raw = await AsyncStorage.getItem(KEYS.DAILY_GOAL());
  return raw ? Number(raw) || 5 : 5;
}

/**
 * Save the user's custom daily goal target
 */
export async function saveDailyGoal(goal: number) {
  if (!currentUserId) return;
  await AsyncStorage.setItem(KEYS.DAILY_GOAL(), String(goal));
  syncToCloud("dailyGoal", { goal }).catch(() => {});
}

/**
 * Count tasks completed today
 */
export async function loadTasksCompletedToday(): Promise<number> {
  const tasks = await loadTasks();
  const today = todayKey();
  
  const completedToday = tasks.filter((t) => {
    if (t.status !== "completed" || !t.completedAt) return false;
    
    try {
      const completedDate = new Date(t.completedAt);
      const completedKey = todayKey(completedDate);
      return completedKey === today;
    } catch {
      return false;
    }
  });
  
  return completedToday.length;
}

/**
 * Count tasks due today (deadline is today)
 */
export async function loadTasksDueToday(): Promise<number> {
  const tasks = await loadTasks();
  const today = todayKey();
  
  const dueToday = tasks.filter((t) => {
    // Count all tasks with today's deadline (completed or not)
    return t.deadline === today;
  });
  
  return dueToday.length;
}

/**
 * Count tasks completed today that were due today
 */
export async function loadTasksCompletedDueToday(): Promise<number> {
  const tasks = await loadTasks();
  const today = todayKey();
  
  const completedDueToday = tasks.filter((t) => {
    // Only count completed tasks with today's deadline
    return t.status === "completed" && t.deadline === today;
  });
  
  return completedDueToday.length;
}

// ========== Theme Settings (User-Specific) ==========

export async function loadThemeMode(): Promise<string | null> {
  if (!currentUserId) return "light";
  const mode = await AsyncStorage.getItem(KEYS.THEME_MODE());
  return mode || "light";
}

export async function saveThemeMode(mode: string) {
  if (!currentUserId) return;
  await AsyncStorage.setItem(KEYS.THEME_MODE(), mode);
}

export async function loadThemeAccent(): Promise<string> {
  if (!currentUserId) return "#1C7ED6";
  const accent = await AsyncStorage.getItem(KEYS.THEME_ACCENT());
  return accent || "#1C7ED6";
}

export async function saveThemeAccent(accent: string) {
  if (!currentUserId) return;
  await AsyncStorage.setItem(KEYS.THEME_ACCENT(), accent);
}

// ========== Focus Timer Settings (User-Specific) ==========

export async function loadFocusBackground(): Promise<string | null> {
  if (!currentUserId) return null;
  return await AsyncStorage.getItem(KEYS.FOCUS_BG());
}

export async function saveFocusBackground(bgId: string) {
  if (!currentUserId) return;
  await AsyncStorage.setItem(KEYS.FOCUS_BG(), bgId);
}

export async function loadFocusMinutes(): Promise<number> {
  if (!currentUserId) return 25;
  const raw = await AsyncStorage.getItem(KEYS.FOCUS_MINUTES());
  return raw ? Number(raw) : 25;
}

export async function saveFocusMinutes(minutes: number) {
  if (!currentUserId) return;
  await AsyncStorage.setItem(KEYS.FOCUS_MINUTES(), String(minutes));
}

export async function loadBreakMinutes(): Promise<number> {
  if (!currentUserId) return 5;
  const raw = await AsyncStorage.getItem(KEYS.BREAK_MINUTES());
  return raw ? Number(raw) : 5;
}

export async function saveBreakMinutes(minutes: number) {
  if (!currentUserId) return;
  await AsyncStorage.setItem(KEYS.BREAK_MINUTES(), String(minutes));
}

// ========== Local Calendar Events (User-Created) ==========

export async function loadLocalEvents(): Promise<any[]> {
  if (!currentUserId) return [];
  const raw = await AsyncStorage.getItem(KEYS.LOCAL_EVENTS());
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveLocalEvents(events: any[]) {
  if (!currentUserId) return;
  await AsyncStorage.setItem(KEYS.LOCAL_EVENTS(), JSON.stringify(events));
  syncToCloud("localEvents", events).catch(() => {});
}
