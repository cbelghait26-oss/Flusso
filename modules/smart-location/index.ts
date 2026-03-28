import { Platform } from "react-native";

// ─── Public types ─────────────────────────────────────────────────────────────

export type LocationSuggestion = {
  /** Primary display text, e.g. "Bell Centre" */
  title: string;
  /** Secondary hint text, e.g. "1909 Av des Canadiens-de-Montréal, Montréal" */
  subtitle: string;
};

export type ResolvedPlace = {
  /** Place name resolved by MapKit, e.g. "Bell Centre" */
  name: string;
  /** The completer suggestion title — used for de-duplication */
  title: string;
  subtitle: string;
  /** Formatted address string, if MapKit returned one */
  address?: string;
  latitude?: number;
  longitude?: number;
};

// ─── Native module bridge ──────────────────────────────────────────────────────

interface NativeSmartLocation {
  getSuggestions(query: string): Promise<LocationSuggestion[]>;
  resolvePlace(title: string, subtitle: string): Promise<ResolvedPlace>;
}

let _mod: NativeSmartLocation | null | undefined; // undefined = not yet attempted

function getNative(): NativeSmartLocation | null {
  if (Platform.OS !== "ios") return null;
  if (_mod !== undefined) return _mod;

  try {
    // expo-modules-core is a transitive dep of expo; always available in dev builds
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireNativeModule } = require("expo-modules-core");
    _mod = requireNativeModule("SmartLocation") as NativeSmartLocation;
  } catch {
    // Running in Expo Go or native module not yet linked
    _mod = null;
  }
  return _mod;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns up to 5 Apple Maps location suggestions for the given query string.
 * Returns [] on Android, in Expo Go, or if MapKit fails.
 */
export async function getSuggestions(
  query: string
): Promise<LocationSuggestion[]> {
  const mod = getNative();
  if (!mod) return [];
  try {
    return await mod.getSuggestions(query);
  } catch {
    return [];
  }
}

/**
 * Resolves a completer suggestion into full place data (address + coordinates).
 * Falls back to a minimal object with just the text if MapKit can't resolve it.
 */
export async function resolvePlace(
  title: string,
  subtitle: string
): Promise<ResolvedPlace | null> {
  const mod = getNative();
  if (!mod) return null;
  try {
    return await mod.resolvePlace(title, subtitle);
  } catch {
    return null;
  }
}

/** Returns true only on iOS where the native SmartLocation module is available. */
export function isSmartLocationAvailable(): boolean {
  return Platform.OS === "ios" && getNative() !== null;
}
