import type { EventColorKey } from "./types";

// Use consistent BRAND colors for all event colors
const EVENT_COLORS = {
  blue: "#007AFF",
  teal: "#21afa1",
  green: "#34C759",
  yellow: "#FFCC00",
  orange: "#FF9500",
  red: "#FF3B30",
  purple: "#AF52DE",
  gray: "#8E8E93",
};

export function eventColor(theme: any, key: EventColorKey | undefined) {
  // Return BRAND colors directly for consistency
  switch (key) {
    case "teal":
      return EVENT_COLORS.teal;
    case "green":
      return EVENT_COLORS.green;
    case "yellow":
      return EVENT_COLORS.yellow;
    case "orange":
      return EVENT_COLORS.orange;
    case "red":
      return EVENT_COLORS.red;
    case "purple":
      return EVENT_COLORS.purple;
    case "gray":
      return EVENT_COLORS.gray;
    case "blue":
    default:
      return EVENT_COLORS.blue;
  }
}
