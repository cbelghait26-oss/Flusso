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
  const [events, setEvents] = useState<LocalEvent[]>([]);

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

    const birthdayBaseYear = new Map<string, number>();
    for (const e of events) {
      if (e.eventType !== "birthday") continue;
      const baseId = e.id?.split("_r")[0] ?? e.id;
      if (!baseId || birthdayBaseYear.has(baseId)) continue;
      if (typeof e.birthYear === "number" && Number.isFinite(e.birthYear)) {
        birthdayBaseYear.set(baseId, e.birthYear);
        continue;
      }
      const [yearStr] = (e.startDate || "").split("-");
      const yearNum = Number(yearStr);
      if (Number.isFinite(yearNum)) birthdayBaseYear.set(baseId, yearNum);
    }

    if (showEvents) {
      for (const e of events) {
        if (e.eventType === "birthday") continue;

        const isHoliday = !!e.id?.startsWith("holiday_");
        if (!showHolidays && isHoliday) continue;

        out.push({
          id: `event:${e.id}`,
          type: "event",
          title: e.title || "Event",
          date: e.startDate,
          allDay: e.allDay,
          startTime: e.allDay ? undefined : e.startTime,
          endTime: e.allDay ? undefined : e.endTime,
          // FIX: holidays always get "purple"; user events use their chosen color key
          colorKey: isHoliday ? "purple" : (e.color ?? "blue"),
          location: e.location,
        });
      }
    }

    if (showBirthdays) {
      for (const e of events) {
        if (e.eventType !== "birthday") continue;

        const baseId = e.id?.split("_r")[0] ?? e.id;
        const [eventYearStr] = (e.startDate || "").split("-");
        const eventYear = Number(eventYearStr);
        const birthYear = baseId ? birthdayBaseYear.get(baseId) : undefined;
        const age =
          Number.isFinite(eventYear) && Number.isFinite(birthYear)
            ? Math.max(0, eventYear - (birthYear as number))
            : null;
        const titleBase = e.title || "Birthday";
        const titleWithAge = age != null ? `${titleBase} (${age})` : titleBase;

        out.push({
          id: `event:${e.id}`,
          type: "event",
          title: titleWithAge,
          date: e.startDate,
          allDay: e.allDay,
          startTime: e.allDay ? undefined : e.startTime,
          endTime: e.allDay ? undefined : e.endTime,
          // FIX: birthdays always use the "birthday" color key (#FF6B2C orange)
          colorKey: "birthday",
          location: e.location,
        });
      }
    }

    if (showTasks) {
      // Build a quick lookup map — coerce both sides to string to survive
      // numeric vs string ID mismatches (storage sometimes returns numeric IDs).
      const objectiveById = new Map<string, any>();
      for (const o of objectives) {
        if (o.id != null) objectiveById.set(String(o.id), o);
      }

      // Reverse map: hex color value → EventColorKey name.
      // Objectives whose `color` field is stored as a raw hex (e.g. "#22C55E")
      // still resolve to the right key that eventColor() understands.
      const HEX_TO_KEY: Record<string, string> = {
        "#007aff": "blue",  "#1c7ed6": "blue",
        "#21afa1": "teal",  "#2ec4b6": "teal",
        "#34c759": "green", "#22c55e": "green",
        "#ffcc00": "yellow","#facc15": "yellow",
        "#ff9500": "orange","#f97316": "orange",
        "#ff3b30": "red",   "#f43f5e": "red",
        "#af52de": "purple","#a855f7": "purple",
        "#8e8e93": "gray",
        "#ff6b2c": "birthday",
      };

      const NAMED_KEYS = new Set(["blue","teal","green","yellow","orange","red","purple","gray","birthday"]);

      const resolveColorKey = (raw: string | undefined): string => {
        if (!raw) return "blue";
        const lower = raw.toLowerCase();
        if (NAMED_KEYS.has(lower)) return lower;        // already a key name
        return HEX_TO_KEY[lower] ?? "blue";            // hex → key, or fallback
      };

      for (const t of tasks) {
        if ((t as any).status === "completed") continue;

        const d = (t as any).deadline ?? (t as any).date ?? null;
        if (!d) continue;
        const date: YMD = typeof d === "string" ? d : `${d}`;

        const taskObjId = (t as any).objectiveId;
        const objective = taskObjId != null
          ? objectiveById.get(String(taskObjId))
          : undefined;

        const colorKey = resolveColorKey(objective?.color);

        out.push({
          id: `task:${(t as any).id ?? (t as any).title ?? Math.random()}`,
          type: "task",
          title: (t as any).title ?? "Task",
          date,
          completed: false,
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
    return Array.from(itemsByDay.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
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