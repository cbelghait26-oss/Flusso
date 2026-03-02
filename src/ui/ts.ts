/**
 * ts.ts — Tablet-safe drop-in replacement for react-native-size-matters `s()`.
 *
 * Problem: on iPad portrait (768 pt wide), react-native-size-matters scales by
 * 768 / 350 ≈ 2.19× — fonts, icons and padding appear more than double their
 * designed size, making the app completely unusable.
 *
 * Solution: detect tablets (short side ≥ 768 pt) at startup and cap the
 * multiplier at MAX_SCALE (1.2). Elements are at most 20% larger than the
 * phone design — comfortable and proportionate.
 *
 * Usage — replace the size-matters import with this one, nothing else changes:
 *
 *   // before
 *   import { s } from "react-native-size-matters";
 *   // after  (adjust relative path as needed)
 *   import { s } from "../../ui/ts";
 */

import { Dimensions } from "react-native";
import { s as _s } from "react-native-size-matters";

/** All iPads in any orientation. */
const TABLET_SHORT_SIDE = 768;

/**
 * Maximum scale factor applied on tablet.
 * 1.2 = 20% larger than the 350 pt phone design baseline.
 * Keeps type and spacing readable without blowing up.
 */
const MAX_SCALE = 1.2;

/** react-native-size-matters design baseline (same default they use). */
const DESIGN_WIDTH = 350;

function buildScaleFn(): (size: number) => number {
  const { width, height } = Dimensions.get("window");
  // Use the short side so portrait and landscape both trigger for iPads.
  const isTablet = Math.min(width, height) >= TABLET_SHORT_SIDE;
  if (!isTablet) {
    // Phone: delegate directly to react-native-size-matters (no change).
    return _s;
  }
  // Tablet: clamp the scale so nothing exceeds MAX_SCALE × design value.
  const scale = Math.min(width / DESIGN_WIDTH, MAX_SCALE);
  return (size: number) => Math.round(size * scale);
}

/**
 * Tablet-safe scale function.
 * - On iPhone: identical to `s()` from react-native-size-matters.
 * - On iPad:   capped at 1.2× the design value (no more 2× blown-up UI).
 */
export const s = buildScaleFn();
