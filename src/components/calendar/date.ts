import type { HM, YMD } from "./types";

export function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function ymd(d: Date): YMD {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseYMD(s: YMD): Date {
  const [Y, M, D] = s.split("-").map((x) => parseInt(x, 10));
  return new Date(Y, (M ?? 1) - 1, D ?? 1, 12, 0, 0, 0);
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
}

export function startOfWeekSunday(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // Sun=0
  x.setDate(x.getDate() - day);
  x.setHours(12, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(12, 0, 0, 0);
  return x;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function dowShort(i: number) {
  return ["S", "M", "T", "W", "T", "F", "S"][i] ?? "";
}

export function formatDayHeader(k: YMD) {
  const d = parseYMD(k);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function formatDayChip(k: YMD) {
  const d = parseYMD(k);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function isValidHM(v: string) {
  if (!/^\d{2}:\d{2}$/.test(v)) return false;
  const [h, m] = v.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function hmToMinutes(hm: HM) {
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

export function ymdCompare(a: YMD, b: YMD) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function timeLabel(allDay: boolean, startTime?: HM, endTime?: HM) {
  if (allDay) return "All day";
  if (!startTime || !endTime) return "";
  return `${startTime}–${endTime}`;
}
