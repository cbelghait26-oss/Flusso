import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { useTheme } from "../theme/theme";
import { s } from "react-native-size-matters";

export function PrimaryButton({
  title,
  onPress,
  leftIcon,
  style,
}: {
  title: string;
  onPress: () => void;
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors, radius, isDark } = useTheme();
  const bg = isDark ? colors.accent : colors.accent;
  const textColor = isDark ? colors.bg : "#FFFFFF";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderRadius: radius.xl, opacity: pressed ? 0.9 : 1 },
        style,
      ]}
    >
      {leftIcon}
      <Text style={[styles.text, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: s(54),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: s(10),
  },
  text: { fontSize: s(16), fontWeight: "900" },
});
