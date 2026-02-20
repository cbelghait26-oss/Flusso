export const STORAGE_MODULE_ID = "storage.ts::A_2026-02-19_1";
import AsyncStorage from "@react-native-async-storage/async-storage";

// --- Local types for user data ---
export type StreakData = {
  days: number;
  lastLoginDate: string | null;
};

export type FocusDailyData = {
  minutesToday: number;
  lastDate: string | null;
};

export type FocusSettingsData = {
  background: string | null;
  focusMinutes: number;
  breakMinutes: number;
};
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

const memoryStore = new Map<string, string>();
const pendingCloudWrites = new Map<string, any>();

function requireUserId() {
  if (!currentUserId) {
    throw new Error("No current user ID");
  }
  return currentUserId;
}

function getMemoryItem(key: string): string | null {
  return memoryStore.has(key) ? (memoryStore.get(key) as string) : null;
}

function setMemoryItem(key: string, value: string) {
  memoryStore.set(key, value);
}

function removeMemoryItem(key: string) {
  memoryStore.delete(key);
}

function clearUserMemory() {
  if (!currentUserId) {
    memoryStore.clear();
    return;
  }
  const prefix = `${currentUserId}:`;
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
    }
  }
}

function getMemoryJson<T>(key: string): T | null {
  const raw = getMemoryItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function setMemoryJson(key: string, value: unknown) {
  setMemoryItem(key, JSON.stringify(value));
}

async function loadLegacyJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function loadLegacyNumber(key: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

// --- Helper to sanitize undefined values ---
function stripUndefinedDeep(value: any): any {
  if (value === undefined) return null;
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep);
  }
  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) {
        out[k] = null;
      } else {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out;
  }
  return value;
}

// --- Cloud Sync with Retry ---
let flushTimer: any = null;

async function syncToCloud(collection: string, data: any) {
  if (!currentUserId) return;

  // Always store latest payload to retry later
  pendingCloudWrites.set(collection, data);

  const success = await attemptCloudWrite(collection, data);
  if (success) {
    pendingCloudWrites.delete(collection);
    return;
  }

  // Schedule a retry (non-blocking)
  scheduleCloudFlush();
}

function scheduleCloudFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushPendingCloudWrites();
    // If still pending, schedule again
    if (pendingCloudWrites.size > 0) scheduleCloudFlush();
  }, 4000);
}

export async function flushPendingCloudWrites() {
  if (!currentUserId || pendingCloudWrites.size === 0) return;

  const entries = Array.from(pendingCloudWrites.entries());
  for (const [collection, data] of entries) {
    const success = await attemptCloudWrite(collection, data);
    if (success) pendingCloudWrites.delete(collection);
  }
}

async function attemptCloudWrite(collection: string, data: any): Promise<boolean> {
  if (!currentUserId) return false;

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Cloud sync timeout")), 10000)
  );

  const syncOp = (async () => {
    const docRef = doc(db, "users", currentUserId, collection, "data");
    const safe = stripUndefinedDeep(data);
    await setDoc(docRef, { content: safe, updatedAt: new Date().toISOString() }, { merge: true });
  })();

  try {
    await Promise.race([syncOp, timeout]);
    console.log("✅ Cloud write OK:", collection, "uid=", currentUserId);
    return true;
  } catch (e) {
    console.log("❌ Cloud write FAIL:", collection, "uid=", currentUserId, "err=", String(e));
    return false;
  }
}

async function loadSetupPayload(): Promise<any> {
  requireUserId();
  const cached = getMemoryJson<any>(KEYS.SETUP());
  if (cached) return cached;
  const cloud = await loadFromCloud("setup");
  if (cloud) {
    setMemoryJson(KEYS.SETUP(), cloud);
    return cloud;
  }
  return {};
}

async function loadStreakData(): Promise<StreakData> {
  requireUserId();
  const cachedDays = getMemoryItem(KEYS.STREAK_DAYS());
  const cachedDate = getMemoryItem(KEYS.LAST_LOGIN_DATE());
  if (cachedDays !== null || cachedDate !== null) {
    return {
      days: cachedDays ? Number(cachedDays) || 0 : 0,
      lastLoginDate: cachedDate || null,
    };
  }
  const cloud = await loadFromCloud("streak");
  if (cloud) {
    const days = Number(cloud.days) || 0;
    const lastLoginDate = cloud.lastLoginDate || null;
    setMemoryItem(KEYS.STREAK_DAYS(), String(days));
    if (lastLoginDate) setMemoryItem(KEYS.LAST_LOGIN_DATE(), lastLoginDate);
    return { days, lastLoginDate };
  }
  return { days: 0, lastLoginDate: null };
}

async function saveStreakData(data: StreakData) {
  requireUserId();
  const next = {
    days: Number(data.days) || 0,
    lastLoginDate: data.lastLoginDate || null,
  };
  setMemoryItem(KEYS.STREAK_DAYS(), String(next.days));
  if (next.lastLoginDate) setMemoryItem(KEYS.LAST_LOGIN_DATE(), next.lastLoginDate);
  else removeMemoryItem(KEYS.LAST_LOGIN_DATE());
  await syncToCloud("streak", next);
}

async function loadFocusDailyData(): Promise<FocusDailyData> {
  requireUserId();
  const cachedMinutes = getMemoryItem(KEYS.FOCUS_MIN_TODAY());
  const cachedDate = getMemoryItem(KEYS.FOCUS_DATE());
  if (cachedMinutes !== null || cachedDate !== null) {
    return {
      minutesToday: cachedMinutes ? Number(cachedMinutes) || 0 : 0,
      lastDate: cachedDate || null,
    };
  }
  const cloud = await loadFromCloud("focusDaily");
  if (cloud) {
    const minutesToday = Number(cloud.minutesToday) || 0;
    const lastDate = cloud.lastDate || null;
    setMemoryItem(KEYS.FOCUS_MIN_TODAY(), String(minutesToday));
    if (lastDate) setMemoryItem(KEYS.FOCUS_DATE(), lastDate);
    return { minutesToday, lastDate };
  }
  return { minutesToday: 0, lastDate: null };
}

async function saveFocusDailyData(data: FocusDailyData) {
  requireUserId();
  const payload = {
    minutesToday: Number(data.minutesToday) || 0,
    lastDate: data.lastDate || null,
  };
  setMemoryItem(KEYS.FOCUS_MIN_TODAY(), String(payload.minutesToday));
  if (payload.lastDate) setMemoryItem(KEYS.FOCUS_DATE(), payload.lastDate);
  else removeMemoryItem(KEYS.FOCUS_DATE());
  await syncToCloud("focusDaily", payload);
}

async function loadFocusSettingsData(): Promise<FocusSettingsData> {
  requireUserId();
  const cachedBg = getMemoryItem(KEYS.FOCUS_BG());
  const cachedFocus = getMemoryItem(KEYS.FOCUS_MINUTES());
  const cachedBreak = getMemoryItem(KEYS.BREAK_MINUTES());
  const hasFocus = cachedFocus !== null;
  const hasBreak = cachedBreak !== null;

  if (hasFocus && hasBreak) {
    return {
      background: cachedBg || null,
      focusMinutes: Number(cachedFocus) || 25,
      breakMinutes: Number(cachedBreak) || 5,
    };
  }

  const cloud = await loadFromCloud("focusSettings");
  if (cloud) {
    const background = cloud.background ?? null;
    const focusMinutes = Number(cloud.focusMinutes) || 25;
    const breakMinutes = Number(cloud.breakMinutes) || 5;
    if (background != null) setMemoryItem(KEYS.FOCUS_BG(), background);
    setMemoryItem(KEYS.FOCUS_MINUTES(), String(focusMinutes));
    setMemoryItem(KEYS.BREAK_MINUTES(), String(breakMinutes));
    return { background, focusMinutes, breakMinutes };
  }

  return {
    background: cachedBg || null,
    focusMinutes: cachedFocus ? Number(cachedFocus) || 25 : 25,
    breakMinutes: cachedBreak ? Number(cachedBreak) || 5 : 5,
  };
}

async function saveFocusSettingsData(data: FocusSettingsData) {
  requireUserId();
  const payload = {
    background: data.background ?? null,
    focusMinutes: Number(data.focusMinutes) || 25,
    breakMinutes: Number(data.breakMinutes) || 5,
  };
  if (payload.background != null) setMemoryItem(KEYS.FOCUS_BG(), payload.background);
  else removeMemoryItem(KEYS.FOCUS_BG());
  setMemoryItem(KEYS.FOCUS_MINUTES(), String(payload.focusMinutes));
  setMemoryItem(KEYS.BREAK_MINUTES(), String(payload.breakMinutes));
  await syncToCloud("focusSettings", payload);
}

export async function loadObjectives(): Promise<Objective[]> {
  requireUserId();
  const cached = getMemoryJson<Objective[]>(KEYS.OBJECTIVES());
  if (cached !== null) return cached;

  // local fallback first
  const localRaw = await AsyncStorage.getItem(KEYS.OBJECTIVES());
  if (localRaw) {
    try {
      const local = JSON.parse(localRaw) as Objective[];
      setMemoryJson(KEYS.OBJECTIVES(), Array.isArray(local) ? local : []);
      return Array.isArray(local) ? local : [];
    } catch {}
  }

  const cloud = await loadFromCloud("objectives");
  if (cloud) {
    setMemoryJson(KEYS.OBJECTIVES(), cloud);
    await AsyncStorage.setItem(KEYS.OBJECTIVES(), JSON.stringify(cloud));
    return cloud as Objective[];
  }

  setMemoryJson(KEYS.OBJECTIVES(), []);
  await AsyncStorage.setItem(KEYS.OBJECTIVES(), JSON.stringify([]));
  return [];
}

export async function saveObjectives(objs: Objective[]) {
  requireUserId();
  if (!Array.isArray(objs)) throw new Error("saveObjectives: invalid array");
  for (const o of objs) {
    if (!o.id) {
      console.error("Objective without ID:", o);
    }
  }
  setMemoryJson(KEYS.OBJECTIVES(), objs);
  await AsyncStorage.setItem(KEYS.OBJECTIVES(), JSON.stringify(objs));
  // Non-blocking cloud write
  syncToCloud("objectives", objs).catch(() => {});
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
  requireUserId();
  const cached = getMemoryJson<Task[]>(KEYS.TASKS());
  if (cached !== null) return cached;

  const localRaw = await AsyncStorage.getItem(KEYS.TASKS());
  if (localRaw) {
    try {
      const local = JSON.parse(localRaw) as Task[];
      setMemoryJson(KEYS.TASKS(), Array.isArray(local) ? local : []);
      return Array.isArray(local) ? local : [];
    } catch {}
  }

  const cloud = await loadFromCloud("tasks");
  if (cloud) {
    setMemoryJson(KEYS.TASKS(), cloud);
    await AsyncStorage.setItem(KEYS.TASKS(), JSON.stringify(cloud));
    return cloud as Task[];
  }

  setMemoryJson(KEYS.TASKS(), []);
  await AsyncStorage.setItem(KEYS.TASKS(), JSON.stringify([]));
  return [];
}

export async function saveTasks(tasks: Task[]) {
  requireUserId();
  if (!Array.isArray(tasks)) throw new Error("saveTasks: invalid array");
  for (const t of tasks) {
    if (!t.id) {
      console.error("Task without ID:", t);
    }
  }
  setMemoryJson(KEYS.TASKS(), tasks);
  await AsyncStorage.setItem(KEYS.TASKS(), JSON.stringify(tasks));
  // Non-blocking cloud write
  syncToCloud("tasks", tasks).catch(() => {});
}

export async function addTask(input: {
  title: string;
  objectiveId: string;
  description?: string;
  deadline?: string;
  importance: Task["importance"];
  status: Task["status"];
}) {
  console.log("addTask() CALLED uid=", currentUserId, "title=", input.title);
  const tasks = await loadTasks();
  const t: Task = {
    id: uid("task"),
    title: input.title.trim(),
    objectiveId: input.objectiveId,
    description: input.description?.trim() || null,
    deadline: input.deadline ?? null,
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
    description: input.description?.trim() || null,
    category: input.category,
    color: input.color,
    deadline: input.deadline ?? null,
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
  requireUserId();
  const cached = getMemoryJson<CalendarEvent[]>(KEYS.CAL_EVENTS());
  if (cached !== null) return cached;
  const cloud = await loadFromCloud("calendarEvents");
  if (cloud) {
    setMemoryJson(KEYS.CAL_EVENTS(), cloud);
    return cloud as CalendarEvent[];
  }
  setMemoryJson(KEYS.CAL_EVENTS(), []);
  return [];
}

export async function saveCalendarEvents(events: CalendarEvent[]) {
  requireUserId();
  console.log("saveCalendarEvents() uid=", currentUserId, "count=", events.length);
  setMemoryJson(KEYS.CAL_EVENTS(), events);
  await AsyncStorage.setItem(KEYS.CAL_EVENTS(), JSON.stringify(events));
  const ok = await attemptCloudWrite("calendarEvents", events);
  console.log("saveCalendarEvents cloud ok =", ok);
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
  requireUserId();
  console.log("saveSetupName: Saving for user:", currentUserId);
  const parsed = await loadSetupPayload();
  parsed.name = name.trim();
  await saveSetupData(parsed);
  console.log("saveSetupName: Complete");
}

export async function loadSetupName(): Promise<string | null> {
  requireUserId();
  const parsed = await loadSetupPayload();
  return parsed.name || null;
}

/**
 * Save setup completion status to cloud and local storage
 */
export async function saveSetupComplete(isComplete: boolean) {
  requireUserId();
  console.log("saveSetupComplete: Saving for user:", currentUserId);
  const parsed = await loadSetupPayload();
  parsed.setupComplete = isComplete;
  await saveSetupData(parsed);
  console.log("saveSetupComplete: Complete");
}

/**
 * Save complete setup data (name, targetLevel, targetMinutesPerDay, etc.)
 */
export async function saveSetupData(setupData: any) {
  requireUserId();
  console.log("saveSetupData: Saving for user:", currentUserId, setupData);
  setMemoryJson(KEYS.SETUP(), setupData);
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
  requireUserId();
  try {
    const cached = getMemoryJson<any>(KEYS.SETUP());
    if (cached) return cached;
    const cloudData = await loadFromCloud("setup");
    if (cloudData) {
      console.log("loadSetupData: Loaded from cloud:", cloudData);
      setMemoryJson(KEYS.SETUP(), cloudData);
      return cloudData;
    }
  } catch (error) {
    console.log("loadSetupData: Cloud load failed");
  }
  return null;
}

/**
 * Load setup completion status - reads from local storage (instant)
 * Cloud sync happens in setCurrentUser(), so data is already local
 */
export async function loadSetupComplete(): Promise<boolean> {
  requireUserId();
  const parsed = await loadSetupPayload();
  const setupComplete = parsed.setupComplete ?? false;
  console.log("loadSetupComplete: Loaded from cloud cache:", setupComplete);
  return setupComplete;
}

export async function loadFocusMinutesToday(): Promise<number> {
  requireUserId();
  const today = todayKey();
  const { minutesToday, lastDate } = await loadFocusDailyData();

  // Reset if new day
  if (lastDate !== today) {
    await saveFocusDailyData({ minutesToday: 0, lastDate: today });
    return 0;
  }

  return minutesToday;
}

export async function addFocusMinutes(minutes: number) {
  requireUserId();
  const today = todayKey();
  const { minutesToday, lastDate } = await loadFocusDailyData();
  const base = lastDate === today ? minutesToday : 0;
  const newTotal = base + minutes;

  await saveFocusDailyData({ minutesToday: newTotal, lastDate: today });
  return newTotal;
}

export async function loadStreakDays(): Promise<number> {
  requireUserId();
  const streak = await loadStreakData();
  return streak.days;
}

export async function saveStreakDays(days: number) {
  requireUserId();
  const streak = await loadStreakData();
  await saveStreakData({ days, lastLoginDate: streak.lastLoginDate });
}

// Update streak based on login dates
export async function updateLoginStreak(): Promise<number> {
  requireUserId();
  const today = todayKey();
  const streak = await loadStreakData();
  const lastLogin = streak.lastLoginDate;
  const currentStreak = streak.days;

  if (!lastLogin) {
    // First login
    await saveStreakData({ days: 1, lastLoginDate: today });
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

  await saveStreakData({ days: newStreak, lastLoginDate: today });
  return newStreak;
}

type FocusSession = {
  date: string;
  startTime: string;
  minutes: number;
  taskId?: string;
};

type ThemeData = { mode: string; accent: string };

async function loadThemeData(): Promise<ThemeData> {
  requireUserId();

  const cachedMode = getMemoryItem(KEYS.THEME_MODE());
  const cachedAccent = getMemoryItem(KEYS.THEME_ACCENT());
  if (cachedMode !== null && cachedAccent !== null) {
    return { mode: cachedMode || "light", accent: cachedAccent || "#1C7ED6" };
  }

  const cloud = await loadFromCloud("theme");
  if (cloud) {
    const mode = cloud.mode || "light";
    const accent = cloud.accent || "#1C7ED6";
    setMemoryItem(KEYS.THEME_MODE(), mode);
    setMemoryItem(KEYS.THEME_ACCENT(), accent);
    return { mode, accent };
  }

  // fallback to AsyncStorage if you want, otherwise default
  return { mode: "light", accent: "#1C7ED6" };
}

async function saveThemeData(next: ThemeData) {
  requireUserId();
  const payload = { mode: next.mode || "light", accent: next.accent || "#1C7ED6" };
  setMemoryItem(KEYS.THEME_MODE(), payload.mode);
  setMemoryItem(KEYS.THEME_ACCENT(), payload.accent);
  syncToCloud("theme", payload).catch(() => {});
}

export async function saveFocusSession(session: FocusSession) {
  requireUserId();
  const cached = getMemoryJson<FocusSession[]>(KEYS.FOCUS_SESSIONS());
  const sessions = cached ? [...cached] : [];
  sessions.push(session);

  setMemoryJson(KEYS.FOCUS_SESSIONS(), sessions);
  syncToCloud("focusSessions", sessions).catch(() => {});

  // Add to daily total
  await addFocusMinutes(session.minutes);

  return sessions;
}

export async function loadFocusSessions(): Promise<FocusSession[]> {
  requireUserId();
  const cached = getMemoryJson<FocusSession[]>(KEYS.FOCUS_SESSIONS());
  if (cached !== null) return cached;
  const cloud = await loadFromCloud("focusSessions");
  if (cloud) {
    setMemoryJson(KEYS.FOCUS_SESSIONS(), cloud);
    return cloud as FocusSession[];
  }
  setMemoryJson(KEYS.FOCUS_SESSIONS(), []);
  return [];
}

// ========== Daily Goal Tracking ==========

/**
 * Load the user's custom daily goal target (default 5 tasks)
 */
export async function loadDailyGoal(): Promise<number> {
  requireUserId();
  const cached = getMemoryItem(KEYS.DAILY_GOAL());
  if (cached) return Number(cached) || 5;
  const cloud = await loadFromCloud("dailyGoal");
  if (cloud?.goal != null) {
    setMemoryItem(KEYS.DAILY_GOAL(), String(cloud.goal));
    return Number(cloud.goal) || 5;
  }
  return 5;
}

/**
 * Save the user's custom daily goal target
 */
export async function saveDailyGoal(goal: number) {
  requireUserId();
  setMemoryItem(KEYS.DAILY_GOAL(), String(goal));
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

// ========== Theme Settings (User-Specific, Cloud-Backed) ==========

export async function loadThemeMode(): Promise<string> {
  const t = await loadThemeData();
  return t.mode;
}

export async function saveThemeMode(mode: string) {
  const t = await loadThemeData();
  await saveThemeData({ ...t, mode });
}

export async function loadThemeAccent(): Promise<string> {
  const t = await loadThemeData();
  return t.accent;
}

export async function saveThemeAccent(accent: string) {
  const t = await loadThemeData();
  await saveThemeData({ ...t, accent });
}

// ========== Focus Timer Settings (User-Specific) ==========

export async function loadFocusBackground(): Promise<string | null> {
  requireUserId();
  const settings = await loadFocusSettingsData();
  return settings.background;
}

export async function saveFocusBackground(bgId: string) {
  requireUserId();
  const settings = await loadFocusSettingsData();
  await saveFocusSettingsData({ ...settings, background: bgId });
}

export async function loadFocusMinutes(): Promise<number> {
  requireUserId();
  const settings = await loadFocusSettingsData();
  return settings.focusMinutes;
}

export async function saveFocusMinutes(minutes: number) {
  requireUserId();
  const settings = await loadFocusSettingsData();
  await saveFocusSettingsData({ ...settings, focusMinutes: minutes });
}

export async function loadBreakMinutes(): Promise<number> {
  requireUserId();
  const settings = await loadFocusSettingsData();
  return settings.breakMinutes;
}

export async function saveBreakMinutes(minutes: number) {
  requireUserId();
  const settings = await loadFocusSettingsData();
  await saveFocusSettingsData({ ...settings, breakMinutes: minutes });
}

// ========== Local Calendar Events (User-Created) ==========

export async function loadLocalEvents(): Promise<any[]> {
  requireUserId();
  const cached = getMemoryJson<any[]>(KEYS.LOCAL_EVENTS());
  if (cached !== null) return cached;
  const cloud = await loadFromCloud("localEvents");
  if (cloud) {
    setMemoryJson(KEYS.LOCAL_EVENTS(), cloud);
    return cloud as any[];
  }
  setMemoryJson(KEYS.LOCAL_EVENTS(), []);
  return [];
}

export async function saveLocalEvents(events: any[]) {
  requireUserId();
  setMemoryJson(KEYS.LOCAL_EVENTS(), events);
  await AsyncStorage.setItem(KEYS.LOCAL_EVENTS(), JSON.stringify(events));
  syncToCloud("localEvents", events).catch(() => {});
}

// Migrates legacy local data to the new per-user key format (stub)
export async function migrateLegacyLocalDataToCloud() {
  // Implement migration logic if needed
  // For now, this is a no-op stub
  return;
}

// Syncs all relevant data from cloud to local (stub)
export async function syncFromCloud() {
  // Implement full cloud-to-local sync logic if needed
  // For now, this is a no-op stub
  return;
}

export async function setCurrentUser(userId: string) {
  currentUserId = userId;
  await AsyncStorage.setItem(STATIC_KEYS.CURRENT_USER, userId);
  clearUserMemory();
  pendingCloudWrites.clear();
  // Migrate legacy local data once, then sync from cloud
  console.log("setCurrentUser: Starting cloud sync...");
  try {
    await migrateLegacyLocalDataToCloud();
    await syncFromCloud();
    console.log("setCurrentUser: Cloud sync completed");
  } catch (error) {
    console.log("setCurrentUser: Cloud sync failed (non-blocking)", error);
  }
}

export async function getCurrentUser(): Promise<string | null> {
  if (currentUserId) return currentUserId;
  currentUserId = await AsyncStorage.getItem(STATIC_KEYS.CURRENT_USER);
  return currentUserId;
}

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
  clearUserMemory();
  pendingCloudWrites.clear();
  await AsyncStorage.removeItem(STATIC_KEYS.CURRENT_USER);
  currentUserId = null;
}

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

export { loadFromCloud };

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export { uid };

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export { todayKey };
