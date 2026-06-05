import type { TrainingPlan, Task } from "../data/models";

function dateToKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/**
 * Pre-generate tasks for a training plan for the next `daysAhead` days.
 * For cycle-based plans this uses arithmetic rotation (keep-order); the
 * "shift-forward" logic is applied reactively via `shiftPlanForward`.
 */
export function generatePlanTasks(
  plan: TrainingPlan,
  daysAhead = 90
): Array<Omit<Task, "id" | "createdAt">> {
  const result: Array<Omit<Task, "id" | "createdAt">> = [];

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const startDate = plan.startDate
    ? new Date(plan.startDate + "T00:00:00")
    : new Date(todayDate);

  const genFrom = startDate > todayDate ? startDate : new Date(todayDate);
  const endDate = addDays(todayDate, daysAhead);

  if (plan.type === "cycle") {
    const cycleDays = plan.cycleDays ?? [];
    if (cycleDays.length === 0) return result;
    const startIdx = plan.startCycleDayIndex ?? 0;

    for (let d = new Date(genFrom); d <= endDate; d = addDays(d, 1)) {
      const daysSinceStart = daysBetween(startDate, d);
      const cyclePos =
        ((startIdx + daysSinceStart) % cycleDays.length + cycleDays.length) %
        cycleDays.length;
      const cycleDay = cycleDays[cyclePos];
      if (cycleDay.isRest) continue;

      const session = plan.sessions.find((s) => s.id === cycleDay.sessionId);
      const title = session ? session.name : cycleDay.label;

      result.push({
        objectiveId: plan.objectiveId,
        title,
        description: session?.description,
        deadline: dateToKey(d),
        importance: 2,
        status: "not-started",
        trainingPlanId: plan.id,
      });
    }
  } else {
    const weekSchedule = plan.weekSchedule ?? [];

    for (let d = new Date(genFrom); d <= endDate; d = addDays(d, 1)) {
      const dow = d.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      const assignment = weekSchedule.find((a) => a.dayOfWeek === dow);
      if (!assignment || assignment.isRest || !assignment.sessionId) continue;

      const session = plan.sessions.find((s) => s.id === assignment.sessionId);
      if (!session) continue;

      result.push({
        objectiveId: plan.objectiveId,
        title: session.name,
        description: session.description,
        deadline: dateToKey(d),
        importance: 2,
        status: "not-started",
        trainingPlanId: plan.id,
      });
    }
  }

  return result;
}

/**
 * For "shift-forward" plans: given the last completed task's cycle position,
 * regenerate remaining tasks starting from tomorrow at that position + 1.
 */
export function generateShiftedTasks(
  plan: TrainingPlan,
  completedCycleDayIndex: number,
  daysAhead = 90
): Array<Omit<Task, "id" | "createdAt">> {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const shifted: TrainingPlan = {
    ...plan,
    startDate: dateToKey(tomorrow),
    // Next cycle position after the one just completed
    startCycleDayIndex:
      completedCycleDayIndex === -1
        ? 0
        : (completedCycleDayIndex + 1) % (plan.cycleDays?.length ?? 1),
  };
  return generatePlanTasks(shifted, daysAhead);
}

/**
 * Returns the next incomplete, upcoming task for a plan (the one that should
 * be visible in the tasks list).
 */
export function getNextPlanTask(planId: string, tasks: Task[]): Task | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dateToKey(today);

  return (
    tasks
      .filter(
        (t) =>
          t.trainingPlanId === planId &&
          t.status !== "completed" &&
          (t.deadline ?? "") >= todayKey
      )
      .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))[0] ??
    null
  );
}

/**
 * Given a plan and all tasks, find the cycle-day index of the last completed
 * plan task (used for shift-forward regeneration).
 */
export function getLastCompletedCycleDayIndex(
  plan: TrainingPlan,
  tasks: Task[]
): number {
  if (plan.type !== "cycle" || !plan.cycleDays?.length) return -1;

  const completed = tasks
    .filter((t) => t.trainingPlanId === plan.id && t.status === "completed" && t.deadline)
    .sort((a, b) => (b.deadline ?? "").localeCompare(a.deadline ?? ""));

  if (completed.length === 0) return -1;

  const lastTask = completed[0];
  const startDate = plan.startDate
    ? new Date(plan.startDate + "T00:00:00")
    : new Date();
  const lastDate = new Date(lastTask.deadline + "T00:00:00");
  const daysFromStart = daysBetween(startDate, lastDate);
  const startIdx = plan.startCycleDayIndex ?? 0;

  return (
    ((startIdx + daysFromStart) % plan.cycleDays.length + plan.cycleDays.length) %
    plan.cycleDays.length
  );
}
