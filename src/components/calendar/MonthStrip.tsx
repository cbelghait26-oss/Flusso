import React, { useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CalItem, YMD } from "./types";
import { addDays, dowShort, monthLabel, parseYMD, sameDay, startOfMonth, startOfWeekSunday, ymd } from "./date";
import { eventColor } from "./eventColors";
import { s } from "../../ui/ts";

const MAX_BARS = 3;

const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

/** Resolve the color hex for a CalItem using its colorKey. */
function itemColor(theme: any, it: CalItem): string {
  return eventColor(theme, it.colorKey);
}

export function MonthStrip(props: {
  theme: any;
  anchorMonth: Date;
  selected: YMD;
  onSelect: (d: YMD) => void;
  onChangeMonth: (d: Date) => void;

  collapsed: boolean;
  onToggleCollapsed: () => void;

  itemsByDay: Map<YMD, CalItem[]>;
}) {
  const { theme, anchorMonth, selected, onSelect, onChangeMonth, collapsed, onToggleCollapsed, itemsByDay } = props;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(anchorMonth.getFullYear());

  const openPicker = () => {
    setPickerYear(anchorMonth.getFullYear());
    setPickerOpen(true);
  };

  const selectMonth = (monthIndex: number) => {
    setPickerOpen(false);
    onChangeMonth(new Date(pickerYear, monthIndex, 1, 12, 0, 0, 0));
  };

  const currentMonth = anchorMonth.getMonth();
  const currentYear = anchorMonth.getFullYear();

  const monthStart = useMemo(() => startOfMonth(anchorMonth), [anchorMonth]);
  const gridStart = useMemo(() => startOfWeekSunday(monthStart), [monthStart]);

  const rows = collapsed ? 1 : 6;

  const cells = useMemo(() => {
    const out: Date[] = [];
    let cur = gridStart;
    for (let i = 0; i < rows * 7; i++) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }, [gridStart, rows]);

  return (
    <View
      style={{
        marginHorizontal: s(14),
        marginBottom: s(10),
        backgroundColor: theme.colors.card,
        borderRadius: s(18),
        borderWidth: s(1),
        borderColor: theme.colors.border,
        overflow: "hidden",
      }}
    >
      {/* ── Month / Year Picker Modal ── */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" }}
          onPress={() => setPickerOpen(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: s(20),
              borderWidth: s(1),
              borderColor: theme.colors.border,
              padding: s(20),
              width: s(300),
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: s(12),
              shadowOffset: { width: 0, height: s(6) },
              elevation: 10,
            }}
          >
            {/* Year navigation */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: s(18) }}>
              <Pressable
                onPress={() => setPickerYear((y) => y - 1)}
                style={{
                  width: s(36), height: s(36), borderRadius: s(999),
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: theme.colors.card2 ?? theme.colors.border,
                }}
              >
                <Ionicons name="chevron-back" size={s(18)} color={theme.colors.text} />
              </Pressable>

              <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(18) }}>
                {pickerYear}
              </Text>

              <Pressable
                onPress={() => setPickerYear((y) => y + 1)}
                style={{
                  width: s(36), height: s(36), borderRadius: s(999),
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: theme.colors.card2 ?? theme.colors.border,
                }}
              >
                <Ionicons name="chevron-forward" size={s(18)} color={theme.colors.text} />
              </Pressable>
            </View>

            {/* Month grid (4 × 3) */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(8) }}>
              {MONTH_NAMES.map((name, idx) => {
                const isActive = idx === currentMonth && pickerYear === currentYear;
                return (
                  <Pressable
                    key={name}
                    onPress={() => selectMonth(idx)}
                    style={{
                      width: `${100 / 4 - 3}%`,
                      paddingVertical: s(10),
                      borderRadius: s(12),
                      alignItems: "center",
                      backgroundColor: isActive ? theme.colors.accent : theme.colors.card2 ?? theme.colors.border,
                      borderWidth: s(1),
                      borderColor: isActive ? theme.colors.accent : theme.colors.border,
                    }}
                  >
                    <Text style={{ color: isActive ? "#fff" : theme.colors.text, fontWeight: "800", fontSize: s(12) }}>
                      {name.slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Cancel */}
            <Pressable
              onPress={() => setPickerOpen(false)}
              style={{
                marginTop: s(18),
                paddingVertical: s(12),
                borderRadius: s(12),
                alignItems: "center",
                borderWidth: s(1),
                borderColor: theme.colors.border,
              }}
            >
              <Text style={{ color: theme.colors.muted, fontWeight: "800", fontSize: s(13) }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Header: tapping month/year opens picker; right side toggles collapse ── */}
      <View
        style={{
          paddingHorizontal: s(14),
          paddingVertical: s(10),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: theme.colors.card,
        }}
      >
        <Pressable
          onPress={openPicker}
          style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
        >
          <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(15) }}>
            {monthLabel(anchorMonth)}
          </Text>
          <Ionicons name="chevron-down" size={s(13)} color={theme.colors.muted} />
        </Pressable>

        <Pressable onPress={onToggleCollapsed}>
          <Text style={{ color: theme.colors.muted, fontWeight: "800", fontSize: s(12) }}>
            {collapsed ? "Expand" : "Collapse"}
          </Text>
        </Pressable>
      </View>

      {/* ── Day-of-week header row ── */}
      <View style={{ flexDirection: "row", paddingBottom: s(4) }}>
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i} style={{ flex: 1, textAlign: "center", color: theme.colors.muted, fontWeight: "900", fontSize: s(11) }}>
            {dowShort(i)}
          </Text>
        ))}
      </View>

      {/* ── Day cells ── */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", paddingBottom: s(10) }}>
        {cells.map((d) => {
          const k = ymd(d);
          const inMonth = d.getMonth() === anchorMonth.getMonth();
          const isSel = k === selected;
          const isTod = sameDay(d, new Date());
          const dayItems = itemsByDay.get(k) ?? [];
          const hasMore = dayItems.length > MAX_BARS;
          const visibleItems = dayItems.slice(0, MAX_BARS);

          return (
            <Pressable
              key={k}
              onPress={() => onSelect(k)}
              style={{
                width: `${100 / 7}%`,
                paddingVertical: s(6),
                alignItems: "center",
                opacity: inMonth ? 1 : 0.3,
              }}
            >
              {/* Date circle */}
              <View
                style={{
                  width: s(28),
                  height: s(28),
                  borderRadius: s(999),
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: s(1.5),
                  borderColor: isSel ? theme.colors.accent : isTod ? theme.colors.accent : "transparent",
                  backgroundColor: isSel ? theme.colors.accent : "transparent",
                }}
              >
                <Text style={{ color: isSel ? "#fff" : theme.colors.text, fontWeight: "900", fontSize: s(11) }}>
                  {d.getDate()}
                </Text>
              </View>

              {/* Colored event bars — stacked, max 3, with "+" when there are more */}
              <View style={{ marginTop: s(3), width: s(26), gap: s(2) }}>
                {visibleItems.length === 0 ? (
                  /* placeholder to keep cell height consistent */
                  <View style={{ height: s(3) }} />
                ) : (
                  visibleItems.map((it, idx) => {
                    const isLast = idx === visibleItems.length - 1;
                    return (
                      <View
                        key={it.id ?? idx}
                        style={{ flexDirection: "row", alignItems: "center", gap: s(2) }}
                      >
                        <View
                          style={{
                            flex: 1,
                            height: s(3),
                            borderRadius: s(999),
                            backgroundColor: itemColor(theme, it),
                          }}
                        />
                        {/* "+" indicator on the last visible bar when there are hidden items */}
                        {isLast && hasMore ? (
                          <Text style={{ color: theme.colors.muted, fontSize: s(8), fontWeight: "900", lineHeight: s(10) }}>
                            +
                          </Text>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
