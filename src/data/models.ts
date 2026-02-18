export type ObjectiveCategory =
  | "Academic"
  | "Career"
  | "Personal"
  | "Health & Fitness"
  | "Skill Development"
  | "Creative"
  | "Misc";

export type ObjectiveColor =
  | "blue"
  | "teal"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple"
  | "gray";

export type ObjectiveStatus = "active" | "completed";

export type Objective = {
  id: string;
  title: string;
  description?: string;
  category: ObjectiveCategory;
  color: ObjectiveColor;
  deadline?: string; // YYYY-MM-DD
  createdAt: string; // ISO
  status: ObjectiveStatus;
};

export type TaskImportance = 1 | 2 | 3 | 4; // Low / Medium / High / Critical
export type TaskStatus = "not-started" | "in-progress" | "completed";

export type Task = {
  id: string;
  objectiveId: string;
  title: string;
  description?: string;
  deadline?: string; // YYYY-MM-DD
  importance: TaskImportance;
  status: TaskStatus;
  createdAt: string; // ISO
  completedAt?: string | null;
};

export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  source: "task-deadline" | "manual" | "google";
  meta?: { taskId?: string; objectiveId?: string };
};
