/**
 * contactsDates.ts
 *
 * Reads the device contacts and extracts birthdays and anniversaries.
 * Converts them into Flusso-compatible LocalEvent objects.
 *
 * ── Month indexing normalization ─────────────────────────────────────────────
 *   expo-contacts returns 0-based months on iOS (January = 0, December = 11),
 *   matching the underlying CNDateComponents from iOS Contacts framework.
 *   Android returns 1-based months (January = 1, December = 12).
 *   We add 1 on iOS so all downstream logic works with 1-based months.
 *   Any month outside [1..12] or day outside [1..31] after normalization
 *   is silently ignored.
 *
 * ── Feb 29 policy ────────────────────────────────────────────────────────────
 *   A birthday or anniversary on Feb 29 is shown on Feb 28 in non-leap years.
 *   The `safeDate` helper below applies this normalization.
 *
 * ── Privacy ──────────────────────────────────────────────────────────────────
 *   Only: contactId, display name, month, day, optional birth/anniversary year,
 *   and the date label are stored.  No phone numbers, emails, or addresses.
 *   These raw items are NEVER uploaded to cloud — see storage.ts notes.
 */

import { Platform } from "react-native";
import * as Contacts from "expo-contacts";
import type { LocalEvent, EventColorKey, ContactDateKind } from "../components/calendar/types";

/**
 * expo-contacts returns 0-based months on iOS (January=0, December=11).
 * Normalize to 1-based for all internal logic.
 */
function normalizeMonth(raw: number): number {
  return Platform.OS === "ios" ? raw + 1 : raw;
}

// ── Public types ──────────────────────────────────────────────────────────────

/** Raw contact date data extracted from the device contacts. */
export type ContactDateItem = {
  contactId: string;
  name: string;
  kind: ContactDateKind;
  /** Month number, 1-based (January = 1, December = 12) */
  month: number;
  day: number;
  /** Optional: the year component (birth year / start of anniversary). */
  year?: number;
  /** Original string label for the date if available (e.g. "Anniversary"). */
  label?: string;
};

// ── Permissions ───────────────────────────────────────────────────────────────

/**
 * Request read access to the device contacts.
 * Returns true if the user grants permission, false otherwise.
 */
export async function requestContactsPermission(): Promise<boolean> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    return status === "granted";
  } catch (err) {
    console.error("[contactsDates] requestPermissionsAsync failed:", err);
    throw err; // re-throw so caller can show a meaningful error
  }
}

/**
 * Returns the current contacts permission status without prompting the user.
 */
export async function getContactsPermissionStatus(): Promise<
  "granted" | "denied" | "undetermined"
> {
  try {
    const { status } = await Contacts.getPermissionsAsync();
    return status as "granted" | "denied" | "undetermined";
  } catch {
    return "undetermined";
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Reads all contacts from the device and returns an array of ContactDateItem
 * objects — one per eligible date (birthday / anniversary / other dates).
 *
 * Contacts that have no qualifying dates are skipped entirely.
 * Only the minimum necessary fields are read: name, birthday, dates.
 */
export async function fetchContactDateItems(): Promise<ContactDateItem[]> {
  const { data } = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.Birthday,
      Contacts.Fields.Dates,
    ],
  });

  const items: ContactDateItem[] = [];

  for (const contact of data) {
    if (!contact.id) continue;

    const name = contact.name?.trim() || "Unknown";

    // ── Birthday ────────────────────────────────────────────────────────────
    if (contact.birthday) {
      const bday = contact.birthday as {
        month?: number;
        day?: number;
        year?: number;
      };
      // iOS returns 0-based months; normalizeMonth() adds 1 on iOS.
      const rawMonth = typeof bday.month === "number" ? bday.month : -1;
      const month = rawMonth >= 0 ? normalizeMonth(rawMonth) : -1;
      const day = typeof bday.day === "number" ? bday.day : 0;
      const year =
        typeof bday.year === "number" && bday.year > 1800
          ? bday.year
          : undefined;

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        items.push({ contactId: contact.id, name, kind: "birthday", month, day, year });
      }
    }

    // ── Other contact dates (anniversaries, custom dates) ──────────────────
    const otherDates: any[] = Array.isArray((contact as any).dates)
      ? (contact as any).dates
      : [];

    for (const d of otherDates) {
      if (!d || typeof d !== "object") continue;

      // iOS returns 0-based months; normalizeMonth() adds 1 on iOS.
      const rawMonth = typeof d.month === "number" ? d.month : -1;
      const month = rawMonth >= 0 ? normalizeMonth(rawMonth) : -1;
      const day = typeof d.day === "number" ? d.day : 0;
      const year =
        typeof d.year === "number" && d.year > 1800 ? d.year : undefined;

      if (month < 1 || month > 12 || day < 1 || day > 31) continue;

      const label: string =
        typeof d.label === "string" ? d.label.trim() : "";
      const labelLower = label.toLowerCase();

      let kind: ContactDateKind = "other";
      if (labelLower.includes("anniversary")) kind = "anniversary";

      items.push({
        contactId: contact.id,
        name,
        kind,
        month,
        day,
        year,
        label: label || undefined,
      });
    }
  }

  return items;
}

// ── Event building ────────────────────────────────────────────────────────────

/** Returns true for leap years. */
function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/**
 * Computes the actual calendar date for an occurrence in `year`.
 * Feb 29 policy: shown on Feb 28 in non-leap years.
 */
function safeDate(
  year: number,
  month: number,
  day: number,
): { year: number; month: number; day: number } {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return { year, month: 2, day: 28 };
  }
  return { year, month, day };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function ordinalSuffix(n: number): string {
  if (n <= 0) return `${n}`;
  const abs = Math.abs(n);
  if (abs % 100 >= 11 && abs % 100 <= 13) return `${n}th`;
  switch (abs % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Builds a stable, deterministic event ID for one occurrence.
 * Format: contacts:{contactId}:{kind}:{MM}-{DD}[_{slugifiedLabel}]_r{year}
 *
 * The ID contains no personal information beyond the opaque contactId.
 * The "_r{year}" suffix mirrors the existing recurrence pattern used by the
 * birthday events already stored in Flusso, making the IDs recognizable to the
 * rest of the codebase.
 */
function buildEventId(
  contactId: string,
  kind: ContactDateKind,
  month: number,
  day: number,
  year: number,
  label?: string,
): string {
  const slugLabel = label
    ? `_${label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`
    : "";
  return `contacts:${contactId}:${kind}:${pad2(month)}-${pad2(day)}${slugLabel}_r${year}`;
}

/**
 * Converts raw ContactDateItem[] into LocalEvent objects for every year in
 * [startYear, endYear] inclusive.
 *
 * These events are generated in memory at runtime and are never written to the
 * `localEvents` storage bucket (no cloud sync risk).  They are merged into the
 * calendar feed at the CalendarScreen read layer.
 *
 * Rules:
 *  - Birthdays   → eventType:"birthday", color:"birthday" (green)
 *  - Anniversaries → regular event,       color:"teal"
 *  - Other dates  → regular event,        color:"gray"
 */
export function buildContactEvents(
  items: ContactDateItem[],
  startYear: number,
  endYear: number,
): LocalEvent[] {
  const events: LocalEvent[] = [];

  for (const item of items) {
    for (let yr = startYear; yr <= endYear; yr++) {
      const { year: fy, month: fm, day: fd } = safeDate(yr, item.month, item.day);
      const dateStr = `${fy}-${pad2(fm)}-${pad2(fd)}`;

      const hasYear =
        typeof item.year === "number" && item.year > 1800;

      if (item.kind === "birthday") {
        // Title: "Name — Nth Birthday" when age is known, else "Name — Birthday"
        let title: string;
        if (hasYear) {
          const age = yr - item.year!;
          title = age > 0
            ? `${item.name} — ${ordinalSuffix(age)} Birthday`
            : `${item.name} — Birthday`;
        } else {
          title = `${item.name} — Birthday`;
        }

        events.push({
          id: buildEventId(item.contactId, "birthday", item.month, item.day, yr),
          title,
          allDay: true,
          startDate: dateStr,
          startTime: "00:00",
          endDate: dateStr,
          endTime: "00:00",
          color: "birthday" as EventColorKey,
          reminder: "none",
          recurrence: "yearly",
          calendarSource: "local",
          // This makes it render through the existing birthday path in
          // useCalendarItems with colorKey:"birthday" (green bar).
          eventType: "birthday",
          // birthYear stored so the hook can do its own age computation if needed
          birthYear: item.year,
          // Contact provenance — stored in memory only, not persisted to cloud
          source: "contacts",
          contactId: item.contactId,
          contactDateKind: "birthday",
        } as LocalEvent);
      } else {
        // Anniversary or other date
        const isAnniversary = item.kind === "anniversary";
        const labelText =
          item.label && item.label.length > 0
            ? item.label
            : isAnniversary
            ? "Anniversary"
            : "Date";

        let title: string;
        if (hasYear) {
          const years = yr - item.year!;
          title = years > 0
            ? `${item.name} — ${ordinalSuffix(years)} ${labelText}`
            : `${item.name} — ${labelText}`;
        } else {
          title = `${item.name} — ${labelText}`;
        }

        events.push({
          id: buildEventId(item.contactId, item.kind, item.month, item.day, yr, item.label),
          title,
          allDay: true,
          startDate: dateStr,
          startTime: "00:00",
          endDate: dateStr,
          endTime: "00:00",
          color: (isAnniversary ? "teal" : "gray") as EventColorKey,
          reminder: "none",
          recurrence: "yearly",
          calendarSource: "local",
          source: "contacts",
          contactId: item.contactId,
          contactDateKind: item.kind,
          originalLabel: item.label,
        } as LocalEvent);
      }
    }
  }

  return events;
}

/**
 * Convenience: builds contact events for a sensible default year window
 * around today (2 years back, 5 years forward) — covers the full visible
 * calendar range and a comfortable lookahead.
 */
export function buildContactEventsForDefaultWindow(
  items: ContactDateItem[],
): LocalEvent[] {
  const thisYear = new Date().getFullYear();
  return buildContactEvents(items, thisYear - 2, thisYear + 5);
}
