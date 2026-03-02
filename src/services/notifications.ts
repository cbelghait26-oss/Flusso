/**
 * src/services/notifications.ts
 * ─────────────────────────────
 * Flusso local-notification service.
 *
 * Exposed API
 * ───────────
 *   initNotifications()
 *   rescheduleAllNotifications()
 *   scheduleFocusNotifications()   (see individual focus helpers below)
 *   scheduleTaskNotifications()
 *   scheduleCalendarNotifications()
 *   scheduleDailySummaries()
 *   cancelByLogicalKey(key)
 *   cancelAllFlussoNotifications()
 *
 *   loadNotifSettings() / saveNotifSettings()  ← stored locally on device
 *
 * Focus helpers (call from FocusZoneScreen):
 *   onFocusWorkPhaseStarted(focusMin, sessionId)
 *   onFocusSessionCompleted(breakMin, sessionId)
 *   onBreakCompleted(sessionId)
 *   cancelFocusSessionNotifs(sessionId)
 *   checkAndFireDailyFocusGoal(totalMin, targetMin)
 *   generateFocusSessionId()
 *
 * Dev testing:
 *   devTestAllNotifications()
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import {
  loadTasks,
  loadLocalEvents,
  loadFocusMinutesToday,
  todayKey,
  loadNotifPrefs,
  saveNotifPrefs,
} from "../data/storage";

import type { LocalEvent } from "../components/calendar/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifSettings = {
  master: boolean;         // global kill-switch
  focus: boolean;          // focus / break notifications
  tasks: boolean;          // task due-today + due-soon
  calendar: boolean;       // event reminders + next-up
  dailySummaries: boolean; // morning agenda at 8 am
  tomorrowPreview: boolean;// evening preview at 9 pm
  coach: boolean;          // coach suggestions (default OFF)
};

export const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  master: true,
  focus: true,
  tasks: true,
  calendar: true,
  dailySummaries: true,
  tomorrowPreview: true,
  coach: false,
};

// ─── AsyncStorage keys (device-local, no cloud sync needed) ──────────────────

const SETTINGS_KEY = "flusso:notif:settings";
const KEYMAP_KEY   = "flusso:notif:keymap"; // logicalKey → expo notification id

// ─── Settings helpers ─────────────────────────────────────────────────────────

export async function loadNotifSettings(): Promise<NotifSettings> {
  try {
    // Try user-scoped cloud-backed store first (requires login, falls back to null when N/A)
    const cloud = await loadNotifPrefs();
    if (cloud) return { ...DEFAULT_NOTIF_SETTINGS, ...cloud };
  } catch {}
  // Fallback: legacy device-local AsyncStorage key (works before login / first run)
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_NOTIF_SETTINGS };
}

export async function saveNotifSettings(s: NotifSettings): Promise<void> {
  // 1. Local device key — instant, works before login
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (e) {
    console.warn("[Notif] saveNotifSettings local error:", e);
  }
  // 2. Cloud-backed user-scoped sync — non-blocking, silently no-ops if not logged in
  saveNotifPrefs(s as unknown as Record<string, any>).catch(() => {});
}

// ─── Keymap helpers ───────────────────────────────────────────────────────────

async function loadKeymap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(KEYMAP_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {}
  return {};
}

async function saveKeymap(map: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYMAP_KEY, JSON.stringify(map));
  } catch {}
}

// ─── Core: schedule / cancel ──────────────────────────────────────────────────

/**
 * Schedule a local notification with a stable logical key.
 * Any previous notification for the same key is cancelled first (deduplication).
 *
 * @param trigger  Date  → fires at that exact wall-clock time (preferred for fixed daily times)
 *                 number → fires N seconds from now (use for relative timers: focus, breaks, idle)
 */
async function scheduleNotif(
  logicalKey: string,
  title: string,
  body: string,
  trigger: Date | number, // Date = exact wall-clock time; number = seconds from now
  data?: Record<string, unknown>,
): Promise<string | null> {
  try {
    // Load keymap ONCE — cancel old entry if present, then schedule new one
    // and save everything in a single write.  This prevents the race condition
    // that occurs when multiple scheduleNotif calls run concurrently and each
    // does a separate read-then-write on the same AsyncStorage key.
    const map = await loadKeymap();

    // Cancel previous OS notification for this logical key
    const oldId = map[logicalKey];
    if (oldId) {
      try { await Notifications.cancelScheduledNotificationAsync(oldId); } catch {}
      delete map[logicalKey];
    }

    if (__DEV__) {
      const triggerDesc = trigger instanceof Date
        ? `at ${trigger.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : `in ${trigger}s`;
      console.log(`[Notif] SCHEDULE  key="${logicalKey}"  title="${title}"  ${triggerDesc}`);
    }

    const notifTrigger: Notifications.NotificationTriggerInput = trigger instanceof Date
      ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger }
      : { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, trigger) };

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { logicalKey, flusso: true, ...(data ?? {}) },
        sound: true,
      },
      trigger: notifTrigger,
    });

    map[logicalKey] = id;
    await saveKeymap(map);

    return id;
  } catch (e) {
    console.warn(`[Notif] scheduleNotif error key="${logicalKey}":`, e);
    return null;
  }
}

export async function cancelByLogicalKey(logicalKey: string): Promise<void> {
  try {
    const map = await loadKeymap();
    const id = map[logicalKey];
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      delete map[logicalKey];
      await saveKeymap(map);
      if (__DEV__) console.log(`[Notif] CANCEL  key="${logicalKey}"  id=${id}`);
    }
  } catch (e) {
    console.warn(`[Notif] cancelByLogicalKey error key="${logicalKey}":`, e);
  }
}

/**
 * Cancel every Flusso-managed notification and clear the keymap.
 */
export async function cancelAllFlussoNotifications(): Promise<void> {
  try {
    const map = await loadKeymap();
    const ids = Object.values(map);
    for (const id of ids) {
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
    }
    await saveKeymap({});
    if (__DEV__) console.log(`[Notif] CANCEL ALL  (${ids.length} notifications cleared)`);
  } catch (e) {
    console.warn("[Notif] cancelAllFlussoNotifications error:", e);
  }
}

// ─── Permission + initialisation ─────────────────────────────────────────────

/**
 * Call once on app start (before user is authenticated is fine).
 * - Suppresses OS banners while the app is in the foreground.
 * - Requests permission on physical devices.
 * - Kicks off rescheduleAllNotifications() in the background.
 */
export async function initNotifications(): Promise<boolean> {
  // FOREGROUND suppression — app active → no OS banner
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: false,
    }),
  });

  // Simulators/emulators cannot receive push tokens; skip permission
  if (!Device.isDevice) {
    if (__DEV__) console.log("[Notif] Non-physical device — skipping permission request");
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    if (__DEV__) console.log("[Notif] Permission NOT granted — notifications disabled");
    return false;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("flusso-default", {
      name: "Flusso",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  if (__DEV__) console.log("[Notif] Init OK — scheduling notifications in background…");

  // Non-blocking reschedule
  rescheduleAllNotifications().catch(() => {});

  return true;
}

// ─── Focus notifications (called imperatively from FocusZoneScreen) ───────────

/**
 * Generate a stable string ID for the current focus session.
 */
export function generateFocusSessionId(): string {
  return `fs_${Date.now().toString(16)}`;
}

/**
 * Call when a WORK phase starts.
 * Schedules the "focus session complete" notification for focusMinutes from now.
 */
export async function onFocusWorkPhaseStarted(
  focusMinutes: number,
  sessionId: string,
): Promise<void> {
  const settings = await loadNotifSettings();
  if (!settings.master || !settings.focus) return;

  // Use real remaining time — no __DEV__ shortcut here to avoid the notification
  // firing immediately whenever the user backgrounds the app during a session.
  const secs = Math.max(5, focusMinutes * 60);

  await scheduleNotif(
    `focus:end:${sessionId}`,
    "Focus session complete 🎯",
    "Great work! Time for a well-earned break.",
    secs,
  );
}

/**
 * Call when the WORK phase finishes (work→break transition).
 * - Cancels the focus:end notification (already fired or superseded).
 * - Schedules: break:started (immediate), break:endingSoon, break:end.
 */
export async function onFocusSessionCompleted(
  breakMinutes: number,
  sessionId: string,
): Promise<void> {
  // Always cancel focus:end — it may not have fired yet (e.g., manual advance)
  await cancelByLogicalKey(`focus:end:${sessionId}`);

  const settings = await loadNotifSettings();
  if (!settings.master || !settings.focus) return;

  const breakSecs      = breakMinutes * 60;
  const endingSoonSecs = Math.max(1, (breakMinutes - 2) * 60);

  // ① Break started
  await scheduleNotif(
    `break:started:${sessionId}`,
    "Break time! ☕",
    `You earned it — rest for ${breakMinutes} minute${breakMinutes !== 1 ? "s" : ""}.`,
    1,
  );

  // ② Break ending soon (only when break > 2 min)
  if (breakMinutes > 2) {
    await scheduleNotif(
      `break:endingSoon:${sessionId}`,
      "Break ending soon ⏰",
      "2 minutes left — start winding down.",
      endingSoonSecs,
    );
  }

  // ③ Break completed → back to focus
  await scheduleNotif(
    `break:end:${sessionId}`,
    "Break over — back to it! 🚀",
    "Time to refocus. You've got this.",
    breakSecs,
  );
}

/**
 * Call when the BREAK phase finishes (break→work transition).
 * Cleans up any still-pending break notifications.
 */
export async function onBreakCompleted(sessionId: string): Promise<void> {
  await cancelByLogicalKey(`break:endingSoon:${sessionId}`);
  await cancelByLogicalKey(`break:end:${sessionId}`);
}

/**
 * Cancel ALL pending notifications for the given focus session.
 * Call on pause, reset, or leave-room.
 */
export async function cancelFocusSessionNotifs(sessionId: string): Promise<void> {
  if (!sessionId) return;
  await Promise.all([
    cancelByLogicalKey(`focus:end:${sessionId}`),
    cancelByLogicalKey(`break:started:${sessionId}`),
    cancelByLogicalKey(`break:endingSoon:${sessionId}`),
    cancelByLogicalKey(`break:end:${sessionId}`),
  ]);
}

/**
 * Fire a "daily focus goal reached" notification once per calendar day.
 * Safe to call multiple times — deduplicated by date key.
 */
export async function checkAndFireDailyFocusGoal(
  totalMinutesToday: number,
  targetMinutes: number,
): Promise<void> {
  const settings = await loadNotifSettings();
  if (!settings.master || !settings.focus) return;
  if (totalMinutesToday < targetMinutes) return;

  const key = `daily:focusGoal:${todayKey()}`;
  const map = await loadKeymap();
  if (map[key]) return; // already fired today

  await scheduleNotif(
    key,
    "Daily focus goal reached! 🏆",
    `You hit your ${targetMinutes}-minute focus target. Impressive!`,
    1,
  );
}

// ─── Task notifications ───────────────────────────────────────────────────────

function tomorrowDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return todayKey(d);
}

/**
 * Returns a Date for the next occurrence of HH:MM.
 * If that time is still ≥ 60 s away today, returns today's occurrence;
 * otherwise returns tomorrow's (so the notification is never scheduled in the past).
 */
function nextOccurrenceAt(hour: number, minute = 0): Date {
  const now    = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() - now.getTime() < 60_000) {
    // Time has passed (or is less than a minute away) — push to tomorrow
    target.setDate(target.getDate() + 1);
  }
  return target;
}

/** Returns a Date for HH:MM tomorrow. */
function tomorrowAt(hour: number, minute = 0): Date {
  const now    = new Date();
  const target = new Date(now);
  target.setDate(now.getDate() + 1);
  target.setHours(hour, minute, 0, 0);
  return target;
}

/**
 * Schedule task-related notifications:
 *   - Morning summary of tasks due today (8 am)
 *   - Per-task reminder for tasks due tomorrow (at 8 am on due day)
 */
export async function scheduleTaskNotifications(): Promise<void> {
  const settings = await loadNotifSettings();
  if (!settings.master || !settings.tasks) {
    // Cancel all existing task notifs if disabled
    const map = await loadKeymap();
    for (const key of Object.keys(map)) {
      if (key.startsWith("task:")) await cancelByLogicalKey(key);
    }
    return;
  }

  const tasks    = await loadTasks();
  const today    = todayKey();
  const tomorrow = tomorrowDateKey();

  // Cancel stale task notifications before rescheduling
  const map = await loadKeymap();
  for (const key of Object.keys(map)) {
    if (key.startsWith("task:")) await cancelByLogicalKey(key);
  }

  const tasksToday    = tasks.filter((t) => t.status !== "completed" && t.deadline === today);
  const tasksTomorrow = tasks.filter((t) => t.status !== "completed" && t.deadline === tomorrow);

  // ── Morning summary for tasks due TODAY (8:00 AM) ──────────────────────
  if (tasksToday.length > 0) {
    const count   = tasksToday.length;
    const trigger = nextOccurrenceAt(8, 0);
    await scheduleNotif(
      `task:dueTodaySummary:${today}`,
      `${count} task${count !== 1 ? "s" : ""} due today 📋`,
      count === 1
        ? `"${tasksToday[0].title}" is due today.`
        : `You have ${count} tasks due today. Let's make it count!`,
      trigger,
    );
  }

  // ── Per-task notification for tasks due TOMORROW (8:00 AM tomorrow) ──────
  for (const t of tasksTomorrow) {
    const trigger = tomorrowAt(8, 0);
    await scheduleNotif(
      `task:dueSoon:${t.id}`,
      "Task due tomorrow 📅",
      `"${t.title}" is due tomorrow. Plan ahead!`,
      trigger,
    );
  }
}

// ─── Calendar notifications ───────────────────────────────────────────────────

function reminderOffsetMinutes(reminder: LocalEvent["reminder"]): number | null {
  switch (reminder) {
    case "at_time": return 0;
    case "5min":    return 5;
    case "10min":   return 10;
    case "30min":   return 30;
    case "1h":      return 60;
    case "1d":      return 1440;
    default:        return null; // "none"
  }
}

function parseEventStart(startDate: string, startTime: string): Date | null {
  try {
    const [year, month, day]   = startDate.split("-").map(Number);
    const [hour, minute]       = startTime.split(":").map(Number);
    const d = new Date(year, month - 1, day, hour, minute, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Schedule calendar-event reminders and "next up" back-to-back alerts.
 * Only looks at events in the next 48 hours (reasonable scheduling window).
 */
export async function scheduleCalendarNotifications(): Promise<void> {
  const settings = await loadNotifSettings();

  // Cancel existing calendar notifs
  const map = await loadKeymap();
  for (const key of Object.keys(map)) {
    if (key.startsWith("calendar:")) await cancelByLogicalKey(key);
  }

  if (!settings.master || !settings.calendar) return;

  const rawEvents = await loadLocalEvents();
  const events    = rawEvents as LocalEvent[];
  const now       = new Date();
  const horizon   = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 h window

  // ── Per-event reminders ──────────────────────────────────────────────────
  for (const evt of events) {
    if (evt.allDay)              continue;
    if (evt.reminder === "none") continue;

    const startMs = parseEventStart(evt.startDate, evt.startTime);
    if (!startMs || startMs <= now || startMs > horizon) continue;

    const offsetMin = reminderOffsetMinutes(evt.reminder);
    if (offsetMin === null) continue;

    const fireAt        = new Date(startMs.getTime() - offsetMin * 60_000);
    const secsFromNow   = Math.floor((fireAt.getTime() - now.getTime()) / 1000);
    if (secsFromNow < 5) continue;

    const humanOffset =
      offsetMin === 0   ? "is starting now"  :
      offsetMin < 60    ? `in ${offsetMin} min` :
      offsetMin === 60  ? "in 1 hour"        :
                          "tomorrow";

    await scheduleNotif(
      `calendar:eventReminder:${evt.id}`,
      `${evt.title} ${humanOffset} 📅`,
      `${evt.startTime}${evt.location ? ` · ${evt.location}` : ""}`,
      fireAt, // exact Date → fires precisely when the reminder is due
    );
  }

  // ── "Next up" for back-to-back events (≤ 10 min gap) ─────────────────────
  const upcomingEvents = events
    .filter((e) => {
      if (e.allDay) return false;
      const s = parseEventStart(e.startDate, e.startTime);
      return s && s > now && s <= horizon;
    })
    .sort((a, b) => {
      const sa = parseEventStart(a.startDate, a.startTime)!.getTime();
      const sb = parseEventStart(b.startDate, b.startTime)!.getTime();
      return sa - sb;
    });

  for (let i = 0; i < upcomingEvents.length - 1; i++) {
    const curr     = upcomingEvents[i];
    const next     = upcomingEvents[i + 1];
    const currEnd  = parseEventStart(curr.endDate, curr.endTime);
    const nextStart = parseEventStart(next.startDate, next.startTime);
    if (!currEnd || !nextStart) continue;

    const gapMs = nextStart.getTime() - currEnd.getTime();
    if (gapMs <= 0 || gapMs > 10 * 60_000) continue; // gap must be 1 s – 10 min

    const secsFromNow = Math.floor((currEnd.getTime() - now.getTime()) / 1000);
    if (secsFromNow < 5) continue;

    const gapMin = Math.round(gapMs / 60_000);
    await scheduleNotif(
      `calendar:nextUp:${curr.id}:${next.id}`,
      `Next up: ${next.title} ⏭️`,
      `Starting at ${next.startTime}${gapMin <= 1 ? " — right now" : ` — in ${gapMin} min`}`,
      currEnd, // exact Date → fires the moment the current event ends
    );
  }
}

// ─── Daily summaries ──────────────────────────────────────────────────────────

/**
 * Schedule morning agenda (8 am) and/or evening tomorrow-preview (9 pm).
 * Also calls scheduleCoachNotifications() if coach is enabled.
 */
export async function scheduleDailySummaries(): Promise<void> {
  const settings = await loadNotifSettings();
  if (!settings.master) return;

  const today    = todayKey();
  const tomorrow = tomorrowDateKey();

  // ── Morning agenda ───────────────────────────────────────────────────────
  if (settings.dailySummaries) {
    await cancelByLogicalKey(`daily:agenda:${today}`);

    const tasks   = await loadTasks();
    const events  = (await loadLocalEvents()) as LocalEvent[];
    const todayTasks  = tasks.filter((t) => t.status !== "completed" && t.deadline === today);
    const todayEvents = events.filter((e) => e.startDate === today && !e.allDay);
    const total   = todayTasks.length + todayEvents.length;

    if (total > 0) {
      const trigger = nextOccurrenceAt(8, 0); // 8:00 AM
      await scheduleNotif(
        `daily:agenda:${today}`,
        "Good morning — here's your day ☀️",
        total === 1
          ? "1 item on your agenda today."
          : `${total} items on your agenda today. Make it count!`,
        trigger,
      );
    }
  }

  // ── Evening tomorrow preview ─────────────────────────────────────────────
  if (settings.tomorrowPreview) {
    await cancelByLogicalKey(`daily:tomorrowPreview:${today}`);

    const tasks   = await loadTasks();
    const events  = (await loadLocalEvents()) as LocalEvent[];
    const tmrTasks  = tasks.filter((t) => t.status !== "completed" && t.deadline === tomorrow);
    const tmrEvents = events.filter((e) => e.startDate === tomorrow && !e.allDay);
    const total   = tmrTasks.length + tmrEvents.length;

    const trigger = nextOccurrenceAt(21, 0); // 9:00 PM

    await scheduleNotif(
      `daily:tomorrowPreview:${today}`,
      "Tomorrow's preview 🌙",
      total > 0
        ? `${total} item${total !== 1 ? "s" : ""} lined up for tomorrow.`
        : "Nothing scheduled for tomorrow. Enjoy the breathing room!",
      trigger,
    );
  }

  // ── Coach notifications ──────────────────────────────────────────────────
  if (settings.coach) {
    await scheduleCoachNotifications();
  } else {
    // Cancel leftover coach notifs if feature was toggled off
    const map = await loadKeymap();
    for (const key of Object.keys(map)) {
      if (key.startsWith("coach:")) await cancelByLogicalKey(key);
    }
  }
}

// ─── Coach notifications ──────────────────────────────────────────────────────

async function scheduleCoachNotifications(): Promise<void> {
  const settings = await loadNotifSettings();
  if (!settings.master || !settings.coach) return;

  const tasks    = await loadTasks();
  const events   = (await loadLocalEvents()) as LocalEvent[];
  const today    = todayKey();
  const tomorrow = tomorrowDateKey();

  // Cancel stale coach notifs
  const map = await loadKeymap();
  for (const key of Object.keys(map)) {
    if (key.startsWith("coach:")) await cancelByLogicalKey(key);
  }

  // Coach 1 — High workload tomorrow (≥ 6 items)
  const tmrTasks  = tasks.filter((t) => t.status !== "completed" && t.deadline === tomorrow);
  const tmrEvents = events.filter((e) => e.startDate === tomorrow && !e.allDay);
  const tmrTotal  = tmrTasks.length + tmrEvents.length;

  if (tmrTotal >= 6) {
    const trigger = nextOccurrenceAt(20, 0); // 8:00 PM
    await scheduleNotif(
      `coach:heavyTomorrow:${today}`,
      "Heavy day ahead 📊",
      `${tmrTotal} items scheduled tomorrow — consider prioritising now.`,
      trigger,
    );
  }

  // Coach 2 — ≥ 3 critical tasks (importance = 4) due in next 24 h
  const in24hKey  = todayKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const urgentTasks = tasks.filter(
    (t) =>
      t.status !== "completed" &&
      t.importance === 4 &&
      t.deadline &&
      t.deadline >= today &&
      t.deadline <= in24hKey,
  );

  if (urgentTasks.length >= 3) {
    const trigger = nextOccurrenceAt(9, 0); // 9:00 AM
    await scheduleNotif(
      `coach:urgentOverload:${today}`,
      "Critical tasks need attention 🚨",
      `${urgentTasks.length} critical tasks are due in the next 24 hours.`,
      trigger,
    );
  }

  // Coach 3 — Idle reminder (no focus today, past 10 am)
  // This one is intentionally relative (15 min from now), not a fixed clock time.
  const hour = new Date().getHours();
  if (hour >= 10) {
    try {
      const focusMinsToday = await loadFocusMinutesToday();
      if (focusMinsToday === 0) {
        const trigger = 15 * 60; // 15 min from now (seconds)
        await scheduleNotif(
          `coach:idle:${today}`,
          "Time to focus? 🎯",
          "You haven't started a focus session today. Even 25 minutes makes a difference!",
          trigger,
        );
      }
    } catch {}
  }

  // Coach 4 — Smart suggestion: tasks approaching deadline without progress
  const approachingTasks = tasks.filter(
    (t) =>
      t.status === "not-started" &&
      t.importance >= 3 &&
      t.deadline &&
      t.deadline >= today &&
      t.deadline <= in24hKey,
  );

  if (approachingTasks.length > 0) {
    const trigger = nextOccurrenceAt(11, 0); // 11:00 AM
    await scheduleNotif(
      `coach:notStarted:${today}`,
      "Unstarted high-priority tasks ⚡",
      `${approachingTasks.length} important task${approachingTasks.length !== 1 ? "s" : ""} due soon haven't been started yet.`,
      trigger,
    );
  }
}

// ─── Master reschedule ────────────────────────────────────────────────────────

/**
 * Cancel and rebuild ALL non-session notifications.
 * Focus-session notifications (focus:end, break:*) are preserved.
 * Call after: task edit, task complete, event edit, event delete, settings change.
 */
export async function rescheduleAllNotifications(): Promise<void> {
  if (__DEV__) console.log("[Notif] rescheduleAllNotifications() — start");

  try {
    // Cancel everything except active focus-session keys
    const map = await loadKeymap();
    for (const key of Object.keys(map)) {
      if (
        key.startsWith("focus:end:")        ||
        key.startsWith("break:started:")    ||
        key.startsWith("break:endingSoon:") ||
        key.startsWith("break:end:")
      ) continue; // preserve active session notifications
      await cancelByLogicalKey(key);
    }

    // Reschedule sequentially — NOT concurrently — to prevent race conditions
    // on the AsyncStorage keymap during simultaneous read-modify-write operations.
    await scheduleTaskNotifications();
    await scheduleCalendarNotifications();
    await scheduleDailySummaries();

    if (__DEV__) console.log("[Notif] rescheduleAllNotifications() — done");
  } catch (e) {
    console.warn("[Notif] rescheduleAllNotifications error:", e);
  }
}

// ─── Dev testing ──────────────────────────────────────────────────────────────

/**
 * Fire one of every notification type with short delays for manual QA.
 * Only available in __DEV__ builds.
 */
export async function devTestAllNotifications(): Promise<void> {
  if (!__DEV__) return;
  console.log("[Notif] DEV TEST — scheduling all notification types (short timers)…");

  await scheduleNotif("dev:1",  "① Focus done 🎯",          "Focus session complete!",              5);
  await scheduleNotif("dev:2",  "② Break start ☕",          "Break started — rest up!",             8);
  await scheduleNotif("dev:3",  "③ Break ending soon ⏰",    "2 minutes left on your break.",        11);
  await scheduleNotif("dev:4",  "④ Break over 🚀",           "Back to focus!",                       14);
  await scheduleNotif("dev:5",  "⑤ Goal reached 🏆",         "Daily focus goal achieved!",           17);
  await scheduleNotif("dev:6",  "⑥ Task due today 📋",       "You have tasks due today.",            20);
  await scheduleNotif("dev:7",  "⑦ Task due tomorrow 📅",    "A task is due tomorrow.",              23);
  await scheduleNotif("dev:8",  "⑧ Event reminder 📅",       "Your event starts soon.",             26);
  await scheduleNotif("dev:9",  "⑨ Morning agenda ☀️",       "Here's your day!",                    29);
  await scheduleNotif("dev:10", "⑩ Tonight preview 🌙",      "Tomorrow's preview.",                 32);
  await scheduleNotif("dev:11", "⑪ Next up ⏭️",              "Back-to-back event!",                 35);
  await scheduleNotif("dev:12", "⑫ Coach: heavy day 📊",      "Heavy workload tomorrow!",            38);
  await scheduleNotif("dev:13", "⑬ Coach: critical tasks 🚨", "Critical tasks due soon!",            41);
  await scheduleNotif("dev:14", "⑭ Coach: idle 🎯",           "No focus session yet today.",         44);
  await scheduleNotif("dev:15", "⑮ Coach: not started ⚡",    "High-priority tasks not started.",   47);

  console.log("[Notif] DEV TEST — all 15 notifications scheduled. Check in 5–50 seconds.");
}
