export type YMD = string; // YYYY-MM-DD
export type HM = string;  // HH:MM

export type ItemType = "event" | "task" | "objective";

export type EventColorKey =
  | "blue"
  | "teal"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple"
  | "gray";

export type LocalEvent = {
  id: string;
  title: string;

  allDay: boolean;
  startDate: YMD;
  startTime: HM;
  endDate: YMD;
  endTime: HM;

  timezone?: string; // placeholder for later
  location?: string;
  notes?: string;

  color: EventColorKey;
  reminder: "none" | "at_time" | "5min" | "10min" | "30min" | "1h" | "1d";
  recurrence?: "none" | "daily" | "weekly" | "monthly" | "yearly"; // recurrence pattern

  calendarSource: "local" | "google"; // placeholder
  googleCalendarId?: string; // placeholder
  
  eventType?: "event" | "birthday"; // distinguish birthdays from regular events
};

export type CalItem = {
  id: string;
  type: ItemType;
  title: string;

  date: YMD; // grouping day (start day for events)
  allDay?: boolean;
  startTime?: HM; // for sorting
  endTime?: HM;

  colorKey?: EventColorKey; // for events
  location?: string;

  completed?: boolean; // tasks/objectives
};
