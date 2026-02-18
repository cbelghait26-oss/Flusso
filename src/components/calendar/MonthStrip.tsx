import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import type { CalItem, YMD } from "./types";
import { addDays, dowShort, parseYMD, sameDay, startOfMonth, startOfWeekSunday, ymd } from "./date";
import { s } from "react-native-size-matters";

export function MonthStrip(props: {
  theme: any;
  anchorMonth: Date;
  selected: YMD;
  onSelect: (d: YMD) => void;

  collapsed: boolean;
  onToggleCollapsed: () => void;

  itemsByDay: Map<YMD, CalItem[]>;
}) {
  const { theme, anchorMonth, selected, onSelect, collapsed, onToggleCollapsed, itemsByDay } = props;

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
      <Pressable
        onPress={onToggleCollapsed}
        style={{
          paddingHorizontal: s(12),
          paddingVertical: s(10),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: theme.colors.card,
        }}
      >
        <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(13) }}>
          {collapsed ? "Month" : "Month (tap to collapse)"}
        </Text>
        <Text style={{ color: theme.colors.muted, fontWeight: "800", fontSize: s(12) }}>
          {collapsed ? "Expand" : "Collapse"}
        </Text>
      </Pressable>

      <View style={{ flexDirection: "row", paddingBottom: s(6) }}>
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i} style={{ flex: 1, textAlign: "center", color: theme.colors.muted, fontWeight: "900", fontSize: s(11) }}>
            {dowShort(i)}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", paddingBottom: s(10) }}>
        {cells.map((d) => {
          const k = ymd(d);
          const inMonth = d.getMonth() === anchorMonth.getMonth();
          const isSel = k === selected;
          const isTod = sameDay(d, new Date());
          const count = (itemsByDay.get(k) ?? []).length;

          return (
            <Pressable
              key={k}
              onPress={() => onSelect(k)}
              style={{
                width: `${100 / 7}%`,
                paddingVertical: s(8),
                alignItems: "center",
                opacity: inMonth ? 1 : 0.35,
              }}
            >
              <View
                style={{
                  width: s(30),
                  height: s(30),
                  borderRadius: s(999),
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: s(1),
                  borderColor: isSel ? theme.colors.accent : isTod ? theme.colors.accent : "transparent",
                  backgroundColor: isSel ? theme.colors.accent : "transparent",
                }}
              >
                <Text style={{ color: isSel ? "#fff" : theme.colors.text, fontWeight: "900", fontSize: s(12) }}>
                  {d.getDate()}
                </Text>
              </View>

              {/* subtle busy indicator */}
              <View style={{ marginTop: s(6), width: s(22), height: s(4), borderRadius: s(999), backgroundColor: theme.colors.border, opacity: count ? 1 : 0.25 }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
