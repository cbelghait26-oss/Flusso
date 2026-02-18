// src/components/ui/SegmentedControl.tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/theme";
import { s } from "react-native-size-matters";

type Item<T extends string> = { key: T; label: string };

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Item<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors, radius } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surface2,
          borderColor: colors.border,
          borderRadius: radius.xl,
        },
      ]}
    >
      {items.map((it) => {
        const active = it.key === value;

        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: active ? "rgba(255,255,255,0.14)" : "transparent",
                borderRadius: radius.xl,
                borderColor: active ? "rgba(255,255,255,0.22)" : "transparent",
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text style={{ color: active ? colors.text : colors.muted, fontWeight: "900", fontSize: s(13) }}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderWidth: s(1),
    padding: s(4),
    gap: s(6),
  },
  item: {
    flex: 1,
    paddingVertical: s(10),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: s(1),
  },
});
