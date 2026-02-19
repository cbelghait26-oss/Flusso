import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../theme/theme";
import { s } from "react-native-size-matters";


export type CardType = 'primary' | 'secondary' | 'destructive';

export function Card({
  children,
  style,
  type = 'secondary',
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  type?: CardType;
}) {
  const { colors, radius, cardTypes } = useTheme();
  const card = cardTypes[type] || cardTypes.secondary;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: card.bg,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: card.padding,
          // Elevation for Android, shadow for iOS
          elevation: card.elevation,
          shadowColor: colors.shadow,
          shadowOpacity: card.elevation ? 0.12 : 0,
          shadowRadius: card.elevation ? 8 : 0,
          shadowOffset: { width: 0, height: card.elevation ? 2 : 0 },
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
  },
});
