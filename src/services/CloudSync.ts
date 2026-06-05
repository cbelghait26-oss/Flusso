import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  Timestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import type { StorageSchema, Task, Objective } from "./FlussoStore";

// ---------- Types you will store in Firestore ----------
export type CloudTask = Task & { updatedAt?: any; deleted?: boolean };
export type CloudObjective = Objective & { updatedAt?: any; deleted?: boolean };

export type CloudEvent = {
  id: string;
  eventType: "event" | "birthday";
  title: string;
  notes?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  allDay: boolean;
  color: string;
  rrule?: string;
  birthYear?: number;

  updatedAt?: any;
  deleted?: boolean;
};

export type CloudAchievement = {
  id: string;
  unlocked: boolean;
  unlockedAt?: any;
  updatedAt?: any;
  deleted?: boolean;
};

export type CloudSettings = {
  theme: "light" | "dark" | "system";
  accent?: string;
};

export type CloudStats = {
  streak: number;
  minutesFocused: number;
  tasksCompletedTotal: number;
  objectivesCompletedTotal: number;
};

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("CloudSync: user not logged in (missing uid).");
  return uid;
}

function lastPullKey(uid: string) {
  return `flusso:cloud:lastPull:${uid}`;
}

function toMillis(ts: any): number {
  // Firestore Timestamp
  if (ts && typeof ts.toMillis === "function") return ts.toMillis();
  // ISO string fallback
  if (typeof ts === "string") {
    const n = Date.parse(ts);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// ---------- Public API ----------

/**
 * Ensures the Firestore user documents exist.
 * Call this once after login.
 */
export async function cloudEnsureUserDoc(params: { name: string; email: string }) {
  const uid = requireUid();
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  const base = {
    uid,
    name: params.name ?? "",
    email: params.email ?? "",
    updatedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    await setDoc(userRef, { ...base, createdAt: serverTimestamp() }, { merge: true });
    // create private docs
    await setDoc(doc(db, "users", uid, "private", "settings"), { theme: "system", updatedAt: serverTimestamp() }, { merge: true });
    await setDoc(doc(db, "users", uid, "private", "stats"), { streak: 0, minutesFocused: 0, tasksCompletedTotal: 0, objectivesCompletedTotal: 0, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await setDoc(userRef, base, { merge: true });
  }
}

/**
 * Pulls from Firestore and returns cloud objects.
 * You apply them to AsyncStorage yourself (see section 5).
 */
export async function cloudPullAll(): Promise<{
  tasks: CloudTask[];
  objectives: CloudObjective[];
  events: CloudEvent[];
  achievements: CloudAchievement[];
  settings: CloudSettings | null;
  stats: CloudStats | null;
}> {
  const uid = requireUid();

  const [tasksSnap, objSnap, evSnap, achSnap, settingsSnap, statsSnap] = await Promise.all([
    getDocs(collection(db, "users", uid, "tasks")),
    getDocs(collection(db, "users", uid, "objectives")),
    getDocs(collection(db, "users", uid, "events")),
    getDocs(collection(db, "users", uid, "achievements")),
    getDoc(doc(db, "users", uid, "private", "settings")),
    getDoc(doc(db, "users", uid, "private", "stats")),
  ]);

  const tasks = tasksSnap.docs.map((d) => d.data() as CloudTask);
  const objectives = objSnap.docs.map((d) => d.data() as CloudObjective);
  const events = evSnap.docs.map((d) => d.data() as CloudEvent);
  const achievements = achSnap.docs.map((d) => d.data() as CloudAchievement);

  const settings = settingsSnap.exists() ? (settingsSnap.data() as any as CloudSettings) : null;
  const stats = statsSnap.exists() ? (statsSnap.data() as any as CloudStats) : null;

  return { tasks, objectives, events, achievements, settings, stats };
}

/**
 * Pushes the full dataset to Firestore using batched writes.
 * This is safe and deterministic for MVP.
 * Later you can optimize to incremental updates.
 */
export async function cloudPushAll(params: {
  schema: StorageSchema; // tasks/objectives/settings from flussoStore.ts
  events: CloudEvent[];  // your calendar events array (user events + birthdays; exclude holidays)
  achievements: CloudAchievement[];
  settings: CloudSettings; // theme etc (use your real settings model)
  stats: CloudStats;
}) {
  const uid = requireUid();

  const batch = writeBatch(db);

  // Root user doc (keep name/email already set by cloudEnsureUserDoc)
  batch.set(doc(db, "users", uid), { updatedAt: serverTimestamp() }, { merge: true });

  // Private docs
  batch.set(doc(db, "users", uid, "private", "settings"), { ...params.settings, updatedAt: serverTimestamp() }, { merge: true });
  batch.set(doc(db, "users", uid, "private", "stats"), { ...params.stats, updatedAt: serverTimestamp() }, { merge: true });

  // Objectives
  for (const o of params.schema.objectives) {
    const ref = doc(db, "users", uid, "objectives", o.id);
    batch.set(ref, { ...o, id: o.id, deleted: false, updatedAt: serverTimestamp() }, { merge: true });
  }

  // Tasks
  for (const t of params.schema.tasks) {
    const ref = doc(db, "users", uid, "tasks", t.id);
    batch.set(ref, { ...t, id: t.id, deleted: false, updatedAt: serverTimestamp() }, { merge: true });
  }

  // Events
  for (const e of params.events) {
    const ref = doc(db, "users", uid, "events", e.id);
    batch.set(ref, { ...e, id: e.id, deleted: false, updatedAt: serverTimestamp() }, { merge: true });
  }

  // Achievements
  for (const a of params.achievements) {
    const ref = doc(db, "users", uid, "achievements", a.id);
    batch.set(ref, { ...a, id: a.id, deleted: false, updatedAt: serverTimestamp() }, { merge: true });
  }

  await batch.commit();

  // mark last pull time locally (used by your bootstrap logic)
  await AsyncStorage.setItem(lastPullKey(uid), String(Date.now()));
}

/**
 * Minimal incremental pull: returns docs updated after last pull time.
 * Uses `updatedAt` (server timestamp).
 */
export async function cloudPullSinceLast(): Promise<{
  tasks: CloudTask[];
  objectives: CloudObjective[];
  events: CloudEvent[];
  achievements: CloudAchievement[];
  pulledAtMs: number;
}> {
  const uid = requireUid();
  const lastRaw = await AsyncStorage.getItem(lastPullKey(uid));
  const lastMs = lastRaw ? Number(lastRaw) : 0;
  const lastTs = Timestamp.fromMillis(lastMs || 0);

  const [tasksSnap, objSnap, evSnap, achSnap] = await Promise.all([
    getDocs(query(collection(db, "users", uid, "tasks"), where("updatedAt", ">", lastTs))),
    getDocs(query(collection(db, "users", uid, "objectives"), where("updatedAt", ">", lastTs))),
    getDocs(query(collection(db, "users", uid, "events"), where("updatedAt", ">", lastTs))),
    getDocs(query(collection(db, "users", uid, "achievements"), where("updatedAt", ">", lastTs))),
  ]);

  const tasks = tasksSnap.docs.map((d) => d.data() as CloudTask);
  const objectives = objSnap.docs.map((d) => d.data() as CloudObjective);
  const events = evSnap.docs.map((d) => d.data() as CloudEvent);
  const achievements = achSnap.docs.map((d) => d.data() as CloudAchievement);

  const pulledAtMs = Date.now();
  await AsyncStorage.setItem(lastPullKey(uid), String(pulledAtMs));

  return { tasks, objectives, events, achievements, pulledAtMs };
}
