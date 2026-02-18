import React from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../theme/theme";
import { s } from "react-native-size-matters";

export function IconCircleButton({
  children,
  onPress,
  size = s(46),
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  size?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.overlay,
          borderColor: colors.border,
          opacity: pressed ? 0.82 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: s(1),
  },
});
