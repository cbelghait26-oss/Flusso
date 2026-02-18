// src/components/ui/SelectSheet.tsx
import React from "react";
import { Modal, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/theme";
import { s } from "react-native-size-matters";

export type SelectItem<T extends string | number> = {
  label: string;
  value: T;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function SelectSheet<T extends string | number>({
  visible,
  title,
  items,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  items: SelectItem<T>[];
  value: T | null;
  onClose: () => void;
  onSelect: (v: T) => void;
}) {
  const { colors, radius } = useTheme();

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
            },
          ]}
          pointerEvents="auto"
        >
          <View style={styles.header}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}>{title}</Text>
            <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
              <Ionicons name="close" size={s(22)} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ marginTop: s(10) }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ gap: s(10), paddingBottom: s(8) }}>
              {items.map((it) => {
                const active = value === it.value;
                return (
                  <Pressable
                    key={String(it.value)}
                    onPress={() => onSelect(it.value)}
                    style={({ pressed }) => [
                      {
                        padding: s(12),
                        borderRadius: radius.lg,
                        backgroundColor: active ? "rgba(255,255,255,0.16)" : colors.overlay,
                        borderWidth: s(1),
                        borderColor: colors.border,
                        opacity: pressed ? 0.88 : 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: s(10),
                      },
                    ]}
                  >
                    {it.icon ? <Ionicons name={it.icon} size={s(18)} color={colors.text} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "900" }}>{it.label}</Text>
                      {it.subtitle ? (
                        <Text style={{ color: colors.muted, fontWeight: "800", fontSize: s(12), marginTop: s(3) }}>
                          {it.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {active ? <Ionicons name="checkmark" size={s(20)} color={colors.text} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: { borderWidth: s(1), padding: s(16), maxHeight: "75%" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
