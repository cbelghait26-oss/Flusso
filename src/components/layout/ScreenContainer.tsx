/**
 * ScreenContainer
 *
 * A transparent layout wrapper that, on iPad, centres the content column and
 * enforces a maximum width so form/list screens do not stretch edge-to-edge.
 * On iPhone it is a pass-through (zero overhead).
 *
 * Props
 * ─────
 * maxWidth    – Override the default CONTENT_MAX_WIDTH. Pass WIDE_MAX_WIDTH
 *               for dashboard/calendar screens.
 * padded      – When true (default) adds horizontal gutter padding.
 * style       – Extra styles applied to the outer flex:1 wrapper.
 * innerStyle  – Extra styles applied to the inner content column.
 */

import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import {
  useDeviceClass,
  CONTENT_MAX_WIDTH,
  PHONE_GUTTER,
  TABLET_GUTTER,
} from "../../ui/responsive";

interface ScreenContainerProps {
  children: React.ReactNode;
  /** Max-width for the content column on tablet. Defaults to CONTENT_MAX_WIDTH. */
  maxWidth?: number;
  /** Whether to apply horizontal padding. Default true. */
  padded?: boolean;
  /** Extra style for the outer full-width wrapper. */
  style?: ViewStyle;
  /** Extra style for the inner content column. */
  innerStyle?: ViewStyle;
}

export function ScreenContainer({
  children,
  maxWidth,
  padded = true,
  style,
  innerStyle,
}: ScreenContainerProps) {
  const { isTablet } = useDeviceClass();
  const resolvedMaxWidth = maxWidth ?? (isTablet ? CONTENT_MAX_WIDTH : undefined);
  const horizontalPad = padded ? (isTablet ? TABLET_GUTTER : PHONE_GUTTER) : 0;

  return (
    // Outer: fills parent - keeps backgrounds full-bleed
    <View style={[styles.outer, style]}>
      {/* Middle: centres the column horizontally */}
      <View style={styles.middle}>
        {/* Inner: constrained width + padding */}
        <View
          style={[
            styles.inner,
            resolvedMaxWidth ? { maxWidth: resolvedMaxWidth } : undefined,
            { paddingHorizontal: horizontalPad },
            innerStyle,
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  middle: {
    flex: 1,
    alignItems: "center",
  },
  inner: {
    flex: 1,
    width: "100%",
  },
});
