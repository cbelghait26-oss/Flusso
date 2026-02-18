import React, { useMemo, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CalItem, YMD } from "./types";
import { formatDayHeader, timeLabel, ymdCompare } from "./date";
import { eventColor } from "./eventColors";
import { s } from "react-native-size-matters";

export function AgendaList(props: {
  theme: any;
  selected: YMD;
  onSelect: (d: YMD) => void;

  itemsByDay: Map<YMD, CalItem[]>;
  dayKeys: YMD[];

  loading: boolean;

  onNew: () => void;
  onEditEvent?: (event: CalItem) => void;
}) {
  const { theme, selected, onSelect, itemsByDay, dayKeys, loading, onNew, onEditEvent } = props;

  const listRef = useRef<ScrollView>(null);

  const keys = useMemo(() => {
    // show a “window” around selected even if no items that day
    const min = selected;
    const max = selected;
    const all = Array.from(new Set([selected, ...dayKeys])).sort(ymdCompare);
    return all;
  }, [dayKeys, selected]);

  return (
    <ScrollView
      ref={listRef}
      contentContainerStyle={{ paddingHorizontal: s(14), paddingBottom: s(160) }}
      showsVerticalScrollIndicator={false}
    >
      {loading ? (
        <Text style={{ color: theme.colors.muted, fontWeight: "800", marginTop: s(8) }}>Loading…</Text>
      ) : null}

      {keys.map((k) => {
        const dayItems = itemsByDay.get(k) ?? [];
        const isSel = k === selected;

        return (
          <View key={k} style={{ marginTop: s(12) }}>
            <Pressable
              onPress={() => onSelect(k)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: s(8),
                paddingHorizontal: s(10),
                borderRadius: s(14),
                backgroundColor: isSel ? theme.colors.card2 : "transparent",
                borderWidth: s(1),
                borderColor: isSel ? theme.colors.border : "transparent",
              }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(14) }}>
                {formatDayHeader(k)}
              </Text>
              <Text style={{ color: theme.colors.muted, fontWeight: "800", fontSize: s(12) }}>
                {dayItems.length ? `${dayItems.length} items` : "Empty"}
              </Text>
            </Pressable>

            {dayItems.length ? (
              <View style={{ marginTop: s(8), gap: s(8) }}>
                {dayItems.map((it) => {
                  const accent =
                    it.type === "event"
                      ? eventColor(theme, it.colorKey)
                      : it.type === "task"
                        ? eventColor(theme, it.colorKey)
                        : theme.colors.objective;

                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => {
                        if (it.type === "event" && onEditEvent) {
                          onEditEvent(it);
                        }
                      }}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? theme.colors.card2 : theme.colors.card,
                        borderRadius: s(16),
                        borderWidth: s(1),
                        borderColor: theme.colors.border,
                        padding: s(12),
                        flexDirection: "row",
                        gap: s(10),
                        alignItems: "center",
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <View style={{ width: s(10), height: s(36), borderRadius: s(999), backgroundColor: accent, opacity: it.completed ? 0.5 : 1 }} />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: theme.colors.text,
                            fontWeight: "900",
                            fontSize: s(13),
                            textDecorationLine: it.completed ? "line-through" : "none",
                            opacity: it.completed ? 0.7 : 1,
                          }}
                          numberOfLines={1}
                        >
                          {it.type === "event" ? `${timeLabel(!!it.allDay, it.startTime, it.endTime)} · ` : ""}
                          {it.title}
                        </Text>
                        <Text style={{ color: theme.colors.muted, fontWeight: "800", fontSize: s(12), marginTop: s(3) }} numberOfLines={1}>
                          {it.type === "event"
                            ? it.location
                              ? `Event · ${it.location}`
                              : "Event"
                            : it.type === "task"
                              ? "Task"
                              : "Objective"}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={s(16)} color={theme.colors.muted} />
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Pressable
                onPress={onNew}
                style={{
                  marginTop: s(8),
                  paddingVertical: s(12),
                  borderRadius: s(16),
                  borderWidth: s(1),
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: theme.colors.muted, fontWeight: "900", fontSize: s(13) }}>Add something for this day</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
