// src/components/ui/DatePickerSheet.tsx
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { useTheme } from "../theme/theme";
import { s } from "react-native-size-matters";

function toKey(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromKey(k: string) {
  const [y, m, d] = k.split("-").map((x) => Number(x));
  return new Date(y, (m || 1) - 1, d || 1);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function DatePickerSheet({
  visible,
  onClose,
  value,
  onChange,
  title = "Select date",
}: {
  visible: boolean;
  onClose: () => void;
  value?: string; // YYYY-MM-DD
  onChange: (next?: string) => void;
  title?: string;
}) {
  const { colors, radius, spacing } = useTheme();

  const initial = useMemo(() => (value ? fromKey(value) : new Date()), [value]);
  const [cursor, setCursor] = useState<Date>(initial);

  const monthLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
    return fmt.format(cursor);
  }, [cursor]);

  const grid = useMemo(() => {
    const first = startOfMonth(cursor);
    const offset = first.getDay(); // 0..6 (Sun..Sat)
    const total = daysInMonth(cursor);

    const cells: Array<{ key: string; label: string; dateKey?: string; muted?: boolean }> = [];

    for (let i = 0; i < offset; i++) cells.push({ key: `b_${i}`, label: "", muted: true });

    for (let day = 1; day <= total; day++) {
      const dk = toKey(new Date(cursor.getFullYear(), cursor.getMonth(), day));
      cells.push({ key: dk, label: `${day}`, dateKey: dk });
    }

    while (cells.length % 7 !== 0) cells.push({ key: `p_${cells.length}`, label: "", muted: true });

    return cells;
  }, [cursor]);

  const selected = value;
  const today = toKey(new Date());

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}>{title}</Text>
        <Pressable onPress={onClose} style={({ pressed }) => [{ padding: s(8), opacity: pressed ? 0.8 : 1 }]}>
          <Ionicons name="close" size={s(20)} color={colors.text} />
        </Pressable>
      </View>

      {/* calendar card */}
      <View
        style={{
          marginTop: spacing.md,
          padding: s(12),
          borderRadius: radius.xl,
          borderWidth: s(1),
          borderColor: colors.border,
          backgroundColor: colors.surface2,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={goPrev} style={({ pressed }) => [{ padding: s(8), opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="chevron-back" size={s(18)} color={colors.text} />
          </Pressable>

          <Text style={{ color: colors.text, fontWeight: "900", fontSize: s(14) }}>{monthLabel}</Text>

          <Pressable onPress={goNext} style={({ pressed }) => [{ padding: s(8), opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="chevron-forward" size={s(18)} color={colors.text} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: s(10) }}>
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <Text
              key={d}
              style={{
                width: "14.28%",
                textAlign: "center",
                color: colors.muted,
                fontWeight: "900",
                fontSize: s(12),
              }}
            >
              {d}
            </Text>
          ))}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: s(6) }}>
          {grid.map((c) => {
            const isSelected = !!c.dateKey && c.dateKey === selected;
            const isToday = !!c.dateKey && c.dateKey === today;

            return (
              <Pressable
                key={c.key}
                onPress={() => {
                  if (!c.dateKey) return;
                  onChange(c.dateKey);
                  onClose();
                }}
                disabled={!c.dateKey}
                style={({ pressed }) => [
                  {
                    width: "14.28%",
                    paddingVertical: s(10),
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View
                  style={{
                    width: s(36),
                    height: s(36),
                    borderRadius: s(12),
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: isToday ? s(1) : s(0),
                    borderColor: isToday ? colors.border : "transparent",
                    backgroundColor: isSelected ? colors.accent : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? colors.bg : c.muted ? colors.muted : colors.text,
                      fontWeight: "900",
                      fontSize: s(13),
                    }}
                  >
                    {c.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* footer actions */}
        <View style={{ flexDirection: "row", gap: s(10), marginTop: s(12) }}>
          <Pressable
            onPress={() => {
              onChange(undefined);
              onClose();
            }}
            style={({ pressed }) => [
              {
                flex: 1,
                height: s(46),
                borderRadius: radius.xl,
                borderWidth: s(1),
                borderColor: colors.border,
                backgroundColor: "rgba(0,0,0,0.16)",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>Clear</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              onChange(today);
              onClose();
            }}
            style={({ pressed }) => [
              {
                flex: 1,
                height: s(46),
                borderRadius: radius.xl,
                borderWidth: s(1),
                borderColor: colors.border,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.bg, fontWeight: "900" }}>Today</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ height: s(12) }} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({});
