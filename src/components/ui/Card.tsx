import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../theme/theme";
import { s } from "react-native-size-matters";

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors, radius } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius.xl,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: s(1),
    padding: s(16),
  },
});
