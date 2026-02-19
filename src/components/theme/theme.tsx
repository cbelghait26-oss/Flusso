// src/components/theme/theme.ts
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { s } from "react-native-size-matters";
import { loadThemeMode, saveThemeMode, loadThemeAccent, saveThemeAccent } from "../../data/storage";

// ✅ Updated brand colors - Primary Flow Blue
export const BRAND = {
  BG: "#0F5EA4",
  CARD: "#EAF4FF",
  ACCENT: "#1C7ED6",
  AQUA: "#2EC4B6",
  AQUA_LIGHT: "#5EEAD4",
  BLUE: "#007AFF",
  TEAL: "#21afa1",
  GREEN: "#34C759", 
  YELLOW: "#FFCC00",
  ORANGE: "#FF9500",
  RED: "#FF3B30",
  PURPLE: "#AF52DE",
  GRAY: "#8E8E93",
};

// ✅ legacy aliases
export const BG = BRAND.BG;
export const CARD = BRAND.CARD;
export const ACCENT = BRAND.ACCENT;

export type ThemeMode = "system" | "light" | "dark";

export type Theme = {
  isDark: boolean;
  colors: {
    bg: string;
    surface: string;
    surface2: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    chip: string;
    shadow: string;
    success: string;
    danger: string;

    accentLight: string;
    accentMid: string;
    accentDark: string;

    card: string;
    card2: string;
    overlay: string;

    grid: string;
    task: string;
    taskSoft: string;
    objective: string;
    objectiveSoft: string;

    warn: string;
  };
  radius: { sm: number; md: number; lg: number; xl: number };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  space: { xs: number; sm: number; md: number; lg: number; xl: number };
  // settings controls
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  accent: string;
  setAccent: (hex: string) => void;
};

function buildColors(isDark: boolean, accentHex: string) {
  const accent = accentHex || BRAND.ACCENT;

  return isDark
    ? {
        bg: "#0B1F33",
        surface: "#153250",
        surface2: "rgba(255,255,255,0.08)",
        border: "rgba(255,255,255,0.14)",
        text: "rgba(255,255,255,0.92)",
        muted: "rgba(255,255,255,0.68)",
        accent,
        chip: "rgba(28,126,214,0.20)",
        shadow: "rgba(0,0,0,0.35)",
        success: BRAND.AQUA,
        danger: "#1AAE9F",

        accentLight: "#A5F3FC",
        accentMid: "#38BDF8",
        accentDark: "#0EA5E9",

        card: "#153250",
        card2: "rgba(255,255,255,0.08)",
        overlay: "rgba(28,126,214,0.15)",

        grid: "rgba(255,255,255,0.10)",
        task: BRAND.AQUA,
        taskSoft: "rgba(46,196,182,0.18)",
        objective: accent,
        objectiveSoft: "rgba(28,126,214,0.18)",

        warn: "rgba(255,255,255,0.78)",
      }
    : {
        bg: "#F5FAFF",
        surface: "#EAF4FF",
        surface2: "#FFFFFF",
        border: "#D6E6F5",
        text: "#0B1F33",
        muted: "#5C6F82",
        accent,
        chip: "rgba(28,126,214,0.12)",
        shadow: "rgba(11,31,51,0.10)",
        success: BRAND.AQUA,
        danger: "#1AAE9F",

        accentLight: "#A5F3FC",
        accentMid: "#38BDF8",
        accentDark: "#0EA5E9",

        card: "#EAF4FF",
        card2: "#FFFFFF",
        overlay: "rgba(28,126,214,0.08)",

        grid: "rgba(11,31,51,0.10)",
        task: BRAND.AQUA,
        taskSoft: "rgba(46,196,182,0.14)",
        objective: accent,
        objectiveSoft: "rgba(28,126,214,0.14)",

        warn: "#8A6A00",
      };
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const systemIsDark = systemScheme !== "light";

  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [accent, setAccentState] = useState<string>(BRAND.ACCENT);

  // load persisted prefs
  useEffect(() => {
    (async () => {
      try {
        const [m, a] = await Promise.all([
          loadThemeMode(),
          loadThemeAccent(),
        ]);
        if (m === "system" || m === "light" || m === "dark") setThemeModeState(m as ThemeMode);
        if (a && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(a)) setAccentState(a);
      } catch {
        // ignore
      }
    })();
  }, []);

  const isDark = themeMode === "system" ? systemIsDark : themeMode === "dark";

  const colors = useMemo(() => buildColors(isDark, accent), [isDark, accent]);

  // Design tokens
  const radius = useMemo(() => ({ xs: s(4), sm: s(8), md: s(14), lg: s(18), xl: s(22) }), []);
  const spacing = useMemo(() => ({ xs: s(4), sm: s(8), md: s(16), lg: s(24), xl: s(32) }), []);
  const space = spacing;

  // Card type hierarchy
  const cardTypes = useMemo(() => ({
    primary: { bg: colors.surface, elevation: 3, padding: spacing.lg },
    secondary: { bg: colors.card, elevation: 1, padding: spacing.md },
    destructive: { bg: colors.card, elevation: 0, padding: spacing.md },
  }), [colors, spacing]);

  const setThemeMode = (m: ThemeMode) => {
    setThemeModeState(m);
    saveThemeMode(m).catch(() => {});
  };

  const setAccent = (hex: string) => {
    setAccentState(hex);
    saveThemeAccent(hex).catch(() => {});
  };

  const value: Theme = {
    isDark,
    colors,
    radius,
    spacing,
    space,
    cardTypes,
    themeMode,
    setThemeMode,
    accent,
    setAccent,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // fallback if provider not mounted yet
    const isDark = (useColorScheme() ?? "dark") !== "light";
    return {
      isDark,
      colors: buildColors(isDark, BRAND.ACCENT),
      radius: { sm: s(12), md: s(16), lg: s(20), xl: s(26) },
      spacing: { xs: s(6), sm: s(10), md: s(14), lg: s(18), xl: s(24) },
      space: { xs: s(6), sm: s(10), md: s(14), lg: s(18), xl: s(24) },
      themeMode: "system",
      setThemeMode: () => {},
      accent: BRAND.ACCENT,
      setAccent: () => {},
    };
  }
  return ctx;
}
