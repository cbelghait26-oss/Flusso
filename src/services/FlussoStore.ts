// src/services/flussoStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ObjectiveStatus = "active" | "paused" | "completed";
export type ObjectiveTimeRange = "short" | "medium" | "long";

export type Objective = {
  id: string;
  title: string;
  description?: string;
  category: string;
  timeRange: ObjectiveTimeRange;
  priority: 1 | 2 | 3 | 4 | 5;
  status: ObjectiveStatus;
  deadline?: string; // YYYY-MM-DD
  createdAt: string;

  progress: number;
  taskCount: number;
  completedTasks: number;
};

export type TaskStatus = "not-started" | "in-progress" | "completed";

export type Task = {
  id: string;
  objectiveId: string;
  title: string;
  description?: string;
  deadline?: string; // YYYY-MM-DD
  duration: number; // hours (kept for future; UI can ignore)
  importance: 1 | 2 | 3 | 4;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string | null;
};

export type Settings = {
  activeObjectiveId?: string | null;
  todayTasksCompleted?: number;
};

export type StorageSchema = {
  objectives: Objective[];
  tasks: Task[];
  settings: Settings;
};

const KEY = "flusso:data:v1";
const MISC_ID = "obj_miscellaneous";

function nowISO() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeDateYYYYMMDD(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function isPastDate(dateYYYYMMDD: string) {
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const [y, m, d] = dateYYYYMMDD.split("-").map(Number);
  const x = new Date(y, m - 1, d).getTime();
  return x < t;
}

export type DeadlineStatus = "overdue" | "today" | "urgent" | "upcoming" | "future" | "none";

export function getDeadlineStatus(deadline?: string): DeadlineStatus {
  if (!deadline) return "none";
  const norm = normalizeDateYYYYMMDD(deadline);
  if (!norm) return "none";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const [y, m, d] = norm.split("-").map(Number);
  const due = new Date(y, m - 1, d).getTime();

  const diffDays = Math.ceil((due - startOfToday) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 2) return "urgent";
  if (diffDays <= 7) return "upcoming";
  return "future";
}

export function calculateObjectiveProgress(objectiveId: string, tasks: Task[]) {
  const related = tasks.filter((t) => t.objectiveId === objectiveId);
  if (related.length === 0) return { progress: 0, taskCount: 0, completedTasks: 0 };
  const completedTasks = related.filter((t) => t.status === "completed").length;
  const progress = Math.round((completedTasks / related.length) * 100);
  return { progress, taskCount: related.length, completedTasks };
}

export function recomputeObjectives(objectives: Objective[], tasks: Task[]) {
  return objectives.map((o) => {
    const derived = calculateObjectiveProgress(o.id, tasks);
    let status: ObjectiveStatus = o.status;
    if (derived.progress === 100 && derived.taskCount > 0) status = "completed";
    return { ...o, status, ...derived };
  });
}

function ensureMiscObjective(schema: StorageSchema): StorageSchema {
  const hasMisc = schema.objectives.some((o) => o.id === MISC_ID);
  if (hasMisc) return schema;

  const misc: Objective = {
    id: MISC_ID,
    title: "Miscellaneous",
    description: "Default objective for quick tasks.",
    category: "General",
    timeRange: "short",
    priority: 3,
    status: "active",
    deadline: undefined,
    createdAt: nowISO(),
    progress: 0,
    taskCount: 0,
    completedTasks: 0,
  };

  const objectives = recomputeObjectives([misc, ...schema.objectives], schema.tasks);
  const settings: Settings = {
    ...schema.settings,
    activeObjectiveId: schema.settings.activeObjectiveId ?? misc.id,
    todayTasksCompleted: schema.settings.todayTasksCompleted ?? 0,
  };

  return { ...schema, objectives, settings };
}

export async function loadData(): Promise<StorageSchema> {
  const raw = await AsyncStorage.getItem(KEY);

  let schema: StorageSchema;
  if (!raw) {
    schema = { objectives: [], tasks: [], settings: { activeObjectiveId: null, todayTasksCompleted: 0 } };
  } else {
    try {
      const parsed = JSON.parse(raw) as StorageSchema;
      schema = {
        objectives: Array.isArray(parsed.objectives) ? parsed.objectives : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        settings: parsed.settings ?? { activeObjectiveId: null, todayTasksCompleted: 0 },
      };
    } catch {
      schema = { objectives: [], tasks: [], settings: { activeObjectiveId: null, todayTasksCompleted: 0 } };
    }
  }

  const ensured = ensureMiscObjective(schema);

  // persist if we had to inject misc
  if (ensured !== schema) {
    await saveData(ensured);
  } else {
    // also ensure derived fields are consistent (cheap and stable)
    const fixed = { ...ensured, objectives: recomputeObjectives(ensured.objectives, ensured.tasks) };
    await saveData(fixed);
    return fixed;
  }

  return ensured;
}

export async function saveData(data: StorageSchema) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export function validateObjective(input: Partial<Objective>) {
  const errors: string[] = [];
  const title = (input.title ?? "").trim();

  if (title.length < 3) errors.push("Objective title must be at least 3 characters.");
  if (title.length > 100) errors.push("Objective title must be at most 100 characters.");

  const p = input.priority ?? 3;
  if (!Number.isInteger(p) || p < 1 || p > 5) errors.push("Priority must be 1-5.");

  if (input.deadline) {
    const norm = normalizeDateYYYYMMDD(input.deadline);
    if (!norm) errors.push("Objective deadline must be YYYY-MM-DD.");
    else if (isPastDate(norm)) errors.push("Objective deadline cannot be in the past.");
  }

  return errors;
}

export async function createObjective(payload: {
  title: string;
  description?: string;
  category: string;
  timeRange: ObjectiveTimeRange;
  priority: 1 | 2 | 3 | 4 | 5;
  deadline?: string;
}) {
  const data = await loadData();
  const errors = validateObjective(payload);
  if (errors.length) return { ok: false as const, errors };

  const objective: Objective = {
    id: uid("obj"),
    title: payload.title.trim(),
    description: payload.description?.trim() || "",
    category: payload.category.trim() || "General",
    timeRange: payload.timeRange,
    priority: payload.priority,
    status: "active",
    deadline: payload.deadline ? normalizeDateYYYYMMDD(payload.deadline) ?? undefined : undefined,
    createdAt: nowISO(),
    progress: 0,
    taskCount: 0,
    completedTasks: 0,
  };

  const objectives = recomputeObjectives([...data.objectives, objective], data.tasks);
  const settings: Settings = { ...data.settings };

  await saveData({ ...data, objectives, settings });
  return { ok: true as const, objective };
}

export async function deleteObjective(objectiveId: string) {
  const data = await loadData();

  if (objectiveId === MISC_ID) {
    return { ok: false as const, errors: ["Miscellaneous objective cannot be deleted."] };
  }

  const objectives = data.objectives.filter((o) => o.id !== objectiveId);
  const tasks = data.tasks.filter((t) => t.objectiveId !== objectiveId);

  let settings = { ...data.settings };
  if (settings.activeObjectiveId === objectiveId) {
    settings.activeObjectiveId = objectives[0]?.id ?? MISC_ID;
  }

  await saveData({ objectives: recomputeObjectives(objectives, tasks), tasks, settings });
  return { ok: true as const };
}

export async function setActiveObjective(objectiveId: string) {
  const data = await loadData();
  const exists = data.objectives.some((o) => o.id === objectiveId);
  if (!exists) return { ok: false as const, errors: ["Objective not found."] };

  const settings = { ...data.settings, activeObjectiveId: objectiveId };
  await saveData({ ...data, settings });
  return { ok: true as const };
}

// src/services/flussoStore.ts

export function validateTask(task: Partial<Task>, objectives: Objective[]) {
  const errors: string[] = [];

  const title = (task.title ?? "").trim();
  if (title.length < 3) errors.push("Task title must be at least 3 characters.");
  if (title.length > 200) errors.push("Task title must be at most 200 characters.");

  const objectiveId = task.objectiveId;
  const obj = objectives.find((o) => o.id === objectiveId);
  if (!objectiveId || !obj) errors.push("Parent objective not found.");

  const imp = Number(task.importance);
  if (!Number.isInteger(imp) || imp < 1 || imp > 4) errors.push("Importance must be 1-4.");

  // ✅ duration validation (optional)
  if (task.duration != null) {
    const dur = Number(task.duration);
    if (!Number.isFinite(dur) || dur <= 0 || dur > 100) errors.push("Duration must be between 0.1 and 100 hours.");
  }

  if (task.deadline) {
    const norm = normalizeDateYYYYMMDD(task.deadline);
    if (!norm) errors.push("Task deadline must be YYYY-MM-DD.");
    else if (isPastDate(norm)) errors.push("Deadline cannot be in the past.");

    if (obj?.deadline && norm) {
      if (new Date(norm).getTime() > new Date(obj.deadline).getTime()) {
        errors.push("Task deadline cannot be after the objective deadline.");
      }
    }
  }

  return errors;
}

export async function createTask(payload: {
  objectiveId: string;
  title: string;
  description?: string;
  deadline?: string;
  duration?: number;                 // ✅ new
  importance: 1 | 2 | 3 | 4;
  status: TaskStatus;
}) {
  const data = await loadData();
  const errors = validateTask(payload as any, data.objectives);
  if (errors.length) return { ok: false as const, errors };

  const task: Task = {
    id: uid("task"),
    objectiveId: payload.objectiveId,
    title: payload.title.trim(),
    description: payload.description?.trim() || "",
    deadline: payload.deadline ? normalizeDateYYYYMMDD(payload.deadline) ?? undefined : undefined,
    duration: payload.duration ?? 1.0,         // ✅ actually saved now
    importance: payload.importance,
    status: payload.status,
    createdAt: nowISO(),
    completedAt: payload.status === "completed" ? nowISO() : null,
  };

  const tasks = [...data.tasks, task];
  const objectives = recomputeObjectives(data.objectives, tasks);
  await saveData({ ...data, tasks, objectives });
  return { ok: true as const, task };
}

export async function toggleTaskCompletion(taskId: string) {
  const data = await loadData();
  const idx = data.tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return { ok: false as const, errors: ["Task not found."] };

  const t = data.tasks[idx];
  let settings = { ...data.settings };

  const next: Task =
    t.status === "completed"
      ? { ...t, status: "not-started", completedAt: null }
      : { ...t, status: "completed", completedAt: nowISO() };

  settings.todayTasksCompleted =
    t.status === "completed"
      ? Math.max(0, (settings.todayTasksCompleted || 0) - 1)
      : (settings.todayTasksCompleted || 0) + 1;

  const tasks = [...data.tasks];
  tasks[idx] = next;

  const objectives = recomputeObjectives(data.objectives, tasks);
  await saveData({ ...data, tasks, objectives, settings });
  return { ok: true as const, task: next };
}

export function getSuggestedTasks(tasks: Task[], settings: Settings) {
  const statusPriority: Record<DeadlineStatus, number> = {
    overdue: 0,
    today: 1,
    urgent: 2,
    upcoming: 3,
    future: 4,
    none: 5,
  };

  return tasks
    .filter((t) => t.status !== "completed")
    .sort((a, b) => {
      const as = getDeadlineStatus(a.deadline);
      const bs = getDeadlineStatus(b.deadline);

      if (statusPriority[as] !== statusPriority[bs]) return statusPriority[as] - statusPriority[bs];
      if (a.importance !== b.importance) return b.importance - a.importance;

      const aActive = settings.activeObjectiveId && a.objectiveId === settings.activeObjectiveId;
      const bActive = settings.activeObjectiveId && b.objectiveId === settings.activeObjectiveId;
      if (aActive !== bActive) return aActive ? -1 : 1;

      const ad = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
      return ad - bd;
    })
    .slice(0, 5);
}

export function getMiscObjectiveId() {
  return MISC_ID;
}
