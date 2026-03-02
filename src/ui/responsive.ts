/**
 * responsive.ts
 * Tablet-responsive layout helpers for FlowApp (iOS-first).
 *
 * Rule: a device is "tablet" when its SHORTEST side is ≥ 768 pt.
 * This covers every common iPad size in both portrait and landscape,
 * while excluding all iPhones (max short side ~430 pt on Pro Max).
 *
 * Do NOT use Platform.OS checks here – width/height is the authority.
 */

import { useWindowDimensions } from "react-native";

// ─── Device-class detection ───────────────────────────────────────────────────

/** Returns true when the device short side is ≥ 768 pt (all iPads). */
export function isTabletDimensions(width: number, height: number): boolean {
  return Math.min(width, height) >= 768;
}

export interface DeviceClass {
  width: number;
  height: number;
  isTablet: boolean;
}

/** Hook – re-renders on orientation change. */
export function useDeviceClass(): DeviceClass {
  const { width, height } = useWindowDimensions();
  return { width, height, isTablet: isTabletDimensions(width, height) };
}

// ─── Layout constants ─────────────────────────────────────────────────────────

/** Horizontal gutter on phone screens. */
export const PHONE_GUTTER = 16;

/** Horizontal gutter on tablet screens. */
export const TABLET_GUTTER = 28;

/**
 * Max content width for single-column form/settings screens on tablet.
 * 560 pt centres naturally on iPad 9th-gen (768 pt wide) with 104 pt of air
 * on each side, and on iPad Pro 12.9" (1024 pt wide) with 232 pt of air.
 */
export const CONTENT_MAX_WIDTH = 560;

/**
 * Wider max-width for data-heavy screens (Calendar, Dashboard, Tasks).
 * 720 pt feels natural on the 11" and 12.9" Pro without being stretched.
 */
export const WIDE_MAX_WIDTH = 720;

// ─── Utility helpers ─────────────────────────────────────────────────────────

/** Clamp n to [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Returns an appropriate font size for the given base size.
 * On tablet the increase is modest (+8% capped at base+4) so text stays
 * readable without ballooning on large screens.
 */
export function scaleFont(base: number, isTablet: boolean): number {
  if (!isTablet) return base;
  return clamp(Math.round(base * 1.08), base, base + 4);
}

/**
 * Returns the correct horizontal gutter (padding) for the current device.
 */
export function gutter(isTablet: boolean): number {
  return isTablet ? TABLET_GUTTER : PHONE_GUTTER;
}

/**
 * Returns the maxWidth to use for a content column.
 * Pass `wide = true` for dashboard / calendar screens.
 */
export function contentMaxWidth(isTablet: boolean, wide = false): number | undefined {
  if (!isTablet) return undefined;
  return wide ? WIDE_MAX_WIDTH : CONTENT_MAX_WIDTH;
}

/**
 * Horizontal offset to centred a position:absolute panel (e.g. bottom sheets)
 * on tablet so it is not full-screen-wide.
 *
 * Usage:
 *   const { left, right } = sheetInsets(isTablet, width, CONTENT_MAX_WIDTH);
 *   <Animated.View style={[styles.sheet, { left, right }]} />
 */
export function sheetHorizontalInsets(
  isTablet: boolean,
  screenWidth: number,
  maxWidth: number = CONTENT_MAX_WIDTH,
  phoneInset: number = 16
): { left: number; right: number } {
  if (!isTablet) return { left: phoneInset, right: phoneInset };
  const inset = Math.max(phoneInset, (screenWidth - maxWidth) / 2);
  return { left: inset, right: inset };
}
