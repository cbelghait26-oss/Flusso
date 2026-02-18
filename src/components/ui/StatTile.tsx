import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { useTheme } from "../theme/theme";
import { s } from "react-native-size-matters";

export function StatTile({
  value,
  label,
  onPress,
  style,
}: {
  value: string;
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const { colors, radius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors.overlay,
          borderColor: colors.border,
          borderRadius: radius.lg,
          opacity: onPress && pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { padding: s(14), borderWidth: s(1), flex: 1 },
  value: { fontSize: s(20), fontWeight: "900" },
  label: { marginTop: s(6), fontSize: s(12), fontWeight: "800" },
});
