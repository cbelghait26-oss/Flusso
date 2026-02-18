import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalItem, LocalEvent, YMD } from "./types";
import { hmToMinutes, isValidHM, ymdCompare } from "./date";
import { loadTasks, loadObjectives } from "../../data/storage";

type Params = {
  query: string;
  showEvents: boolean;
  showTasks: boolean;
  showBirthdays: boolean;
  showHolidays: boolean;
};

export function useCalendarItems(params: Params) {
  const { query, showEvents, showTasks, showBirthdays, showHolidays } = params;

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [objectives, setObjectives] = useState<any[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]); // local for now

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksData, objectivesData] = await Promise.all([
        loadTasks(),
        loadObjectives(),
      ]);
      setTasks(tasksData ?? []);
      setObjectives(objectivesData ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const items = useMemo(() => {
    const out: CalItem[] = [];

    if (showEvents) {
      for (const e of events) {
        // Skip birthdays if we're only showing events
        if (e.eventType === "birthday") continue;
        
        // Skip holidays if holidays are disabled
        if (!showHolidays && e.id?.startsWith('holiday_')) continue;
        
        out.push({
          id: `event:${e.id}`,
          type: "event",
          title: e.title || "Event",
          date: e.startDate,
          allDay: e.allDay,
          startTime: e.allDay ? undefined : e.startTime,
          endTime: e.allDay ? undefined : e.endTime,
          colorKey: e.color,
          location: e.location,
        });
      }
    }

    if (showBirthdays) {
      for (const e of events) {
        // Only show birthdays
        if (e.eventType !== "birthday") continue;
        
        out.push({
          id: `event:${e.id}`,
          type: "event",
          title: e.title || "Birthday",
          date: e.startDate,
          allDay: e.allDay,
          startTime: e.allDay ? undefined : e.startTime,
          endTime: e.allDay ? undefined : e.endTime,
          colorKey: e.color,
          location: e.location,
        });
      }
    }

    if (showTasks) {
      for (const t of tasks) {
        // Skip completed tasks
        if ((t as any).status === "completed") continue;
        
        const d = (t as any).deadline ?? (t as any).date ?? null;
        if (!d) continue;
        const date: YMD = typeof d === "string" ? d : `${d}`;
        
        // Get objective color for this task
        const objective = objectives.find((o) => o.id === (t as any).objectiveId);
        const colorKey = objective?.color ?? "blue";
        
        out.push({
          id: `task:${(t as any).id ?? (t as any).title ?? Math.random()}`,
          type: "task",
          title: (t as any).title ?? "Task",
          date,
          completed: false, // Only showing non-completed tasks
          colorKey,
        });
      }
    }

    const q = query.trim().toLowerCase();
    if (!q) return out;

    return out.filter((x) => {
      if (x.title.toLowerCase().includes(q)) return true;
      if (x.type === "event" && x.location && x.location.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [events, tasks, objectives, showEvents, showBirthdays, showTasks, showHolidays, query]);

  const itemsByDay = useMemo(() => {
    const map = new Map<YMD, CalItem[]>();
    for (const it of items) {
      const arr = map.get(it.date) ?? [];
      arr.push(it);
      map.set(it.date, arr);
    }

    const rank = (t: CalItem["type"]) => (t === "event" ? 0 : t === "objective" ? 1 : 2);

    for (const [k, arr] of map) {
      arr.sort((a, b) => {
        const r = rank(a.type) - rank(b.type);
        if (r !== 0) return r;

        // events: all-day first, then time
        if (a.type === "event" && b.type === "event") {
          const aAll = !!a.allDay;
          const bAll = !!b.allDay;
          if (aAll !== bAll) return aAll ? -1 : 1;
          if (a.startTime && b.startTime && isValidHM(a.startTime) && isValidHM(b.startTime)) {
            return hmToMinutes(a.startTime) - hmToMinutes(b.startTime);
          }
        }

        return a.title.localeCompare(b.title);
      });
      map.set(k, arr);
    }

    return map;
  }, [items]);

  const dayKeysSorted = useMemo(() => {
    const keys = Array.from(itemsByDay.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return keys;
  }, [itemsByDay]);

  return {
    loading,
    reload,
    items,
    itemsByDay,
    dayKeysSorted,
    events,
    setEvents,
  };
}
