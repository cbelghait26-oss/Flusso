// CalendarScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  InteractionManager,
  LayoutAnimation,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { s } from "react-native-size-matters";

import { useTheme } from "../src/components/theme/theme";
import { monthLabel, parseYMD, startOfMonth, ymd } from "../src/components/calendar/date";
import type { YMD } from "../src/components/calendar/types";
import { useCalendarItems } from "../src/components/calendar/useCalendarItems";
import { loadLocalEvents, saveLocalEvents, STORAGE_MODULE_ID } from "../src/data/storage";
import { eventColor } from "../src/components/calendar/eventColors";

import { TopAppBar } from "../src/components/calendar/TopAppBar";
import { MonthStrip } from "../src/components/calendar/MonthStrip";
import { CreateSheet } from "../src/components/calendar/CreateSheet";
import { SideDrawer } from "../src/components/calendar/SideDrawer";
import { generateDefaultHolidays } from "../src/data/holidays";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CalViewMode = "week" | "month";

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number) {
  const x = new Date(d);
  const originalDay = x.getDate();
  x.setMonth(x.getMonth() + n);
  if (x.getDate() !== originalDay) x.setDate(0);
  return x;
}

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + delta);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtWeekdayShort(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function fmtDayHeader(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function buildDayKeysBetweenInclusive(a: Date, b: Date): YMD[] {
  const start = new Date(a);
  const end = new Date(b);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const out: YMD[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(ymd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function itemIconName(type?: string) {
  switch (type) {
    case "event":      return "calendar-outline";
    case "task":       return "checkbox-outline";
    case "objective":  return "flag-outline";
    case "birthday":   return "gift-outline";
    case "holiday":    return "sparkles-outline";
    default:           return "ellipse-outline";
  }
}

// Resolve the correct hex color for any CalItem.
// CalItem.colorKey is an EventColorKey string ("blue", "red", "birthday", etc.)
// — it must go through eventColor() to get a hex value.
// Tasks use their objective's colorKey. Holidays use "purple". Birthdays use "birthday".
function resolveItemColor(theme: any, it: any): string {
  const type = it?.type as string | undefined;

  // Events and birthdays: colorKey is stored on the item
  if (type === "event") {
    // it.colorKey comes from useCalendarItems which sets colorKey: e.color (user chosen)
    // or colorKey: "birthday" for birthdays
    return eventColor(theme, it?.colorKey);
  }

  // Tasks: colorKey is the objective's color, stored on the CalItem
  if (type === "task") {
    return eventColor(theme, it?.colorKey);
  }

  // Objectives
  if (type === "objective") {
    return eventColor(theme, it?.colorKey);
  }

  return theme.colors.border;
}

function isEventAgendaItem(it: any) {
  return it?.type === "event" && typeof it?.id === "string" && it.id.startsWith("event:");
}

// Helper: itemsByDay from useCalendarItems is a Map — support both Map and plain object
function getDayItemsFrom(itemsByDay: any, k: YMD): any[] {
  if (!itemsByDay) return [];
  if (typeof itemsByDay.get === "function") return itemsByDay.get(k) ?? [];
  return itemsByDay[k] ?? [];
}

export default function CalendarScreenV2() {
  useEffect(() => {
    console.log("USING STORAGE MODULE (calendar):", STORAGE_MODULE_ID);
  }, []);

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { width } = useWindowDimensions();

  const canGoBack = typeof nav?.canGoBack === "function" ? nav.canGoBack() : false;

  const [selected, setSelected] = useState<YMD>(ymd(new Date()));
  const [anchorMonth, setAnchorMonth] = useState<Date>(startOfMonth(new Date()));

  const [calView, setCalView] = useState<CalViewMode>("week");
  const [monthCollapsed, setMonthCollapsed] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const [showEvents, setShowEvents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showBirthdays, setShowBirthdays] = useState(true);
  const [showHolidays, setShowHolidays] = useState(true);

  const { loading, reload, itemsByDay, events, setEvents } = useCalendarItems({
    query,
    showEvents,
    showTasks,
    showBirthdays,
    showHolidays,
  });

  // Load events from storage on mount
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const loadedEvents = await loadLocalEvents();
        const userEvents = loadedEvents || [];

        const holidays = generateDefaultHolidays();
        const existingHolidayIds = new Set(
          userEvents.filter((e) => e.id?.startsWith("holiday_")).map((e) => e.id)
        );
        const newHolidays = holidays.filter((h) => !existingHolidayIds.has(h.id));

        setEvents([...userEvents, ...newHolidays]);
      } catch (error) {
        console.error("Failed to load events:", error);
      }
    };
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload tasks/objectives when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      reload();
    }, [reload])
  );

  // Search animation
  const searchAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(searchAnim, {
      toValue: searchOpen ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [searchOpen, searchAnim]);
  const searchH = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, s(48)] });
  const searchOpacity = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const title = useMemo(() => monthLabel(anchorMonth), [anchorMonth]);

  const subtitle = useMemo(() => {
    const d = parseYMD(selected);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }, [selected]);

  const onSelectDay = (k: YMD) => {
    setSelected(k);
    setAnchorMonth(startOfMonth(parseYMD(k)));
  };

  const saveEvent = async (evOrEvents: any | any[]) => {
    const eventsToSave = Array.isArray(evOrEvents) ? evOrEvents : [evOrEvents];
    const firstEvent = eventsToSave[0];

    let updatedEvents: any[];
    if (editingEvent) {
      const baseId = firstEvent.id ? firstEvent.id.split("_r")[0] : firstEvent.id;
      updatedEvents = events.filter((e) => {
        if (!e.id) return true;
        const eBaseId = e.id.split("_r")[0];
        return eBaseId !== baseId;
      });
      updatedEvents = [...eventsToSave, ...updatedEvents];
    } else {
      updatedEvents = [...eventsToSave, ...events];
    }

    setEvents(updatedEvents);

    try {
      const userEvents = updatedEvents.filter((e) => !e.id?.startsWith("holiday_"));
      await saveLocalEvents(userEvents);
    } catch (error) {
      console.error("Failed to save events:", error);
    }
  };

  // Delete an event (and all its recurrence instances) by base ID
  const deleteEvent = async (eventToDelete: any) => {
    const baseId = eventToDelete?.id?.split("_r")[0] ?? eventToDelete?.id;
    const updatedEvents = events.filter((e) => {
      if (!e.id) return true;
      const eBaseId = e.id.split("_r")[0];
      return eBaseId !== baseId;
    });

    setEvents(updatedEvents);
    setCreateOpen(false);
    setEditingEvent(null);

    try {
      const userEvents = updatedEvents.filter((e) => !e.id?.startsWith("holiday_"));
      await saveLocalEvents(userEvents);
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  };

  const saveTask = async (title: string, date: YMD) => {
    try {
      const { addTask, ensureDefaultObjective } = require("../src/data/storage");
      const misc = await ensureDefaultObjective();
      await addTask({
        title,
        deadline: date,
        objectiveId: misc.id,
        importance: 2,
        status: "not-started",
      });
    } catch {}
    await reload();
  };

  const saveObjective = async (title: string, date: YMD) => {
    try {
      const { addObjective } = require("../src/data/storage");
      await addObjective({
        title,
        deadline: date,
        category: "Misc",
        color: "blue",
      });
    } catch {}
    await reload();
  };

  // Agenda window: 1 month before today → 2 months after today.
  // todayIndex points into sections[] so scrollToToday always lands exactly right.
  const todayKey = useMemo(() => ymd(new Date()), []);
  const dayKeysAll = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = addMonths(now, -1); // 1 month back
    const end   = addMonths(now,  2); // 2 months forward
    return buildDayKeysBetweenInclusive(start, end);
  }, []);

  const sections = useMemo(() => {
    return dayKeysAll.map((k) => ({ key: k, title: fmtDayHeader(parseYMD(k)), data: [k] }));
  }, [dayKeysAll]);

  const listRef = useRef<SectionList<any>>(null);

  const todayIndex = useMemo(() => {
    const idx = sections.findIndex((s) => s.key === todayKey);
    return idx >= 0 ? idx : 0;
  }, [sections, todayKey]);

  const scrollToToday = (animated = true) => {
    InteractionManager.runAfterInteractions(() => {
      // When today is not section 0, RN needs a tick to render enough cells
      // before scrollToLocation can reach that index reliably.
      setTimeout(
        () => {
          try {
            listRef.current?.scrollToLocation({
              sectionIndex: todayIndex,
              itemIndex: 0,
              viewPosition: 0,
              animated,
            });
          } catch {}
        },
        animated ? 0 : 100,
      );
    });
  };

  const onToday = () => {
    const now = new Date();
    const k = ymd(now);
    setSelected(k);
    setAnchorMonth(startOfMonth(now));
    scrollToToday(true);
  };

  useEffect(() => {
    scrollToToday(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayIndex]);

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const toggleExpanded = (k: YMD) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDays((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  // ====== Week/Month header strip ======
  const WeekStrip = useMemo(() => {
    const sel = parseYMD(selected);
    const weekStart = startOfWeekMonday(sel);

    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(weekStart, i);
      const k = ymd(d);
      const count = getDayItemsFrom(itemsByDay, k).length;
      return { d, k, count };
    });

    return (
      <View style={[styles.weekWrap, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.viewToggleRow}>
          <View style={[styles.segment, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Pressable
              onPress={() => setCalView("week")}
              style={[styles.segmentBtn, calView === "week" && { backgroundColor: theme.colors.accent }]}
            >
              <Text style={[styles.segmentText, { color: calView === "week" ? "#fff" : theme.colors.text }]}>
                Week
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setCalView("month")}
              style={[styles.segmentBtn, calView === "month" && { backgroundColor: theme.colors.accent }]}
            >
              <Text style={[styles.segmentText, { color: calView === "month" ? "#fff" : theme.colors.text }]}>
                Month
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={onToday} style={[styles.todayBtn, { borderColor: theme.colors.border }]} disabled={loading}>
            <Ionicons name="locate-outline" size={s(16)} color={theme.colors.text} />
            <Text style={[styles.todayBtnText, { color: theme.colors.text }]}>Today</Text>
          </Pressable>
        </View>

        {calView === "week" ? (
          <View style={styles.weekRow}>
            {days.map(({ d, k, count }) => {
              const isSel = k === selected;
              return (
                <Pressable
                  key={k}
                  onPress={() => onSelectDay(k)}
                  style={[
                    styles.weekDay,
                    isSel && { backgroundColor: theme.colors.card, borderColor: theme.colors.accent },
                    !isSel && { borderColor: theme.colors.border },
                  ]}
                >
                  <Text style={[styles.weekNum, { color: isSel ? theme.colors.accent : theme.colors.text }]}>
                    {d.getDate()}
                  </Text>
                  <Text style={[styles.weekName, { color: theme.colors.muted ?? theme.colors.text }]}>
                    {fmtWeekdayShort(d)}
                  </Text>

                  <View style={styles.weekIndicatorRow}>
                    {count > 0 ? (
                      <>
                        <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />
                        {count > 1 ? (
                          <Text style={[styles.countText, { color: theme.colors.muted ?? theme.colors.text }]}>
                            {count}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <View style={[styles.dotHollow, { borderColor: theme.colors.border }]} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={{ paddingTop: s(8) }}>
            <MonthStrip
              theme={theme}
              anchorMonth={anchorMonth}
              selected={selected}
              onSelect={onSelectDay}
              collapsed={monthCollapsed}
              onToggleCollapsed={() => setMonthCollapsed((v) => !v)}
              itemsByDay={itemsByDay}
            />
          </View>
        )}
      </View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, calView, selected, anchorMonth, monthCollapsed, itemsByDay, loading]);

  // ====== Day renderers ======
  const renderDayHeader = (section: any) => {
    const k: YMD = section.key;
    const dayItems = getDayItemsFrom(itemsByDay, k);
    const hasItems = dayItems.length > 0;
    const isSel = k === selected;

    return (
      <Pressable
        onPress={() => onSelectDay(k)}
        style={[
          styles.dayHeader,
          { borderBottomColor: theme.colors.border },
          isSel && { backgroundColor: theme.colors.card },
        ]}
      >
        <View style={styles.dayHeaderLeft}>
          <Text style={[styles.dayHeaderText, { color: theme.colors.text }]}>{section.title}</Text>
          {k === todayKey ? (
            <View style={[styles.todayPill, { backgroundColor: theme.colors.accent }]}>
              <Text style={styles.todayPillText}>Today</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.dayHeaderRight}>
          {hasItems ? (
            <View style={[styles.countPill, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />
              <Text style={[styles.countPillText, { color: theme.colors.text }]}>{dayItems.length}</Text>
            </View>
          ) : (
            <Text style={[styles.noEventMini, { color: theme.colors.muted ?? theme.colors.text }]}>No event</Text>
          )}
          <Ionicons name="chevron-forward" size={s(16)} color={theme.colors.muted ?? theme.colors.text} />
        </View>
      </Pressable>
    );
  };

  const renderDayBody = (k: YMD) => {
    const dayItems = getDayItemsFrom(itemsByDay, k);

    if (dayItems.length === 0) {
      return (
        <View style={styles.dayBody}>
          <Text style={[styles.noEventText, { color: theme.colors.muted ?? theme.colors.text }]}>No event</Text>
        </View>
      );
    }

    const expanded = !!expandedDays[k];
    const shown = expanded ? dayItems : dayItems.slice(0, 2);
    const hiddenCount = dayItems.length - shown.length;

    return (
      <View style={styles.dayBody}>
        {shown.map((it, idx) => {
          const type = it?.type;
          const titleText = it?.title ?? it?.name ?? it?.label ?? "Untitled";
          const subtitleText = it?.time ?? it?.timeLabel ?? it?.subtitle ?? it?.location ?? "";
          // FIX: resolve the actual hex color via eventColor(), not raw it.color string
          const barColor = resolveItemColor(theme, it);

          return (
            <Pressable
              key={`${k}:${it?.id ?? idx}`}
              onPress={() => {
                if (!isEventAgendaItem(it)) return;

                const eventId = it.id.substring(6);
                const fullEvent = events.find((e) => e.id === eventId);
                if (!fullEvent) return;

                if (fullEvent.eventType === "birthday") {
                  const baseId = fullEvent.id?.split("_r")[0] ?? fullEvent.id;
                  const baseEvent = baseId ? events.find((e) => e.id === baseId) : undefined;
                  const [yearStr] = (baseEvent?.startDate || fullEvent.startDate || "").split("-");
                  const inferredBirthYear = Number(yearStr);
                  const birthYear = Number.isFinite(fullEvent.birthYear)
                    ? fullEvent.birthYear
                    : Number.isFinite(baseEvent?.birthYear)
                      ? baseEvent?.birthYear
                      : Number.isFinite(inferredBirthYear)
                        ? inferredBirthYear
                        : undefined;

                  setEditingEvent({ ...fullEvent, birthYear });
                } else {
                  setEditingEvent(fullEvent);
                }

                setCreateOpen(true);
              }}
              style={[
                styles.itemRow,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius?.lg ?? s(14),
                },
              ]}
            >
              <View style={[styles.itemBar, { backgroundColor: barColor }]} />
              <View style={styles.itemMain}>
                <View style={styles.itemTop}>
                  <Ionicons name={itemIconName(type)} size={s(16)} color={theme.colors.text} />
                  <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={1}>
                    {titleText}
                  </Text>
                </View>
                {subtitleText ? (
                  <Text style={[styles.itemSubtitle, { color: theme.colors.muted ?? theme.colors.text }]} numberOfLines={1}>
                    {subtitleText}
                  </Text>
                ) : null}
              </View>

              {isEventAgendaItem(it) ? (
                <Ionicons name="create-outline" size={s(18)} color={theme.colors.muted ?? theme.colors.text} />
              ) : null}
            </Pressable>
          );
        })}

        {dayItems.length > 2 ? (
          <Pressable onPress={() => toggleExpanded(k)} style={[styles.expandBtn, { borderColor: theme.colors.border }]}>
            <Text style={[styles.expandBtnText, { color: theme.colors.text }]}>
              {expanded ? "Collapse" : `Expand (${hiddenCount} more)`}
            </Text>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={s(16)}
              color={theme.colors.muted ?? theme.colors.text}
            />
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={["top", "left", "right"]}>
      <TopAppBar
        theme={theme}
        title={title}
        subtitle={subtitle}
        canGoBack={canGoBack}
        onBack={() => nav.goBack()}
        onOpenDrawer={() => setDrawerOpen(true)}
        onToday={onToday}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        query={query}
        setQuery={setQuery}
        searchH={searchH}
        searchOpacity={searchOpacity}
      />

      {WeekStrip}

      <SectionList
        ref={listRef as any}
        sections={sections as any}
        keyExtractor={(item, index) => `${item}:${index}`}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section }) => renderDayHeader(section)}
        renderItem={({ item }) => renderDayBody(item as YMD)}
        contentContainerStyle={{ paddingBottom: s(140) + insets.bottom }}
        ListHeaderComponent={<View style={{ height: s(8) }} />}
        onScrollToIndexFailed={() => {
          // RN couldn't reach the index yet — wait for more cells and retry
          setTimeout(() => scrollToToday(false), 200);
        }}
        removeClippedSubviews
        windowSize={15}
        maxToRenderPerBatch={20}
        initialNumToRender={62} // enough to always cover 1 month back (~31 days) + some forward
        updateCellsBatchingPeriod={16}
      />

      {/* FAB */}
      <Pressable
        onPress={() => {
          setEditingEvent(null);
          setCreateOpen(true);
        }}
        onLongPress={() => setDrawerOpen(true)}
        delayLongPress={220}
        style={{
          position: "absolute",
          right: s(16),
          bottom: s(90) + insets.bottom,
          width: s(56),
          height: s(56),
          borderRadius: s(999),
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.accent,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: s(10),
          shadowOffset: { width: s(0), height: s(8) },
          elevation: s(10),
        }}
      >
        <Ionicons name="add" size={s(28)} color="#fff" />
      </Pressable>

      <SideDrawer
        theme={theme}
        visible={drawerOpen}
        width={width}
        insets={insets}
        showEvents={showEvents}
        setShowEvents={setShowEvents}
        showTasks={showTasks}
        setShowTasks={setShowTasks}
        showBirthdays={showBirthdays}
        setShowBirthdays={setShowBirthdays}
        showHolidays={showHolidays}
        setShowHolidays={setShowHolidays}
        onClose={() => setDrawerOpen(false)}
        onLinkGoogle={() => {}}
      />

      <CreateSheet
        theme={theme}
        visible={createOpen}
        insets={insets}
        defaultDate={selected}
        onClose={() => {
          setCreateOpen(false);
          setEditingEvent(null);
        }}
        onSaveEvent={saveEvent}
        onDeleteEvent={deleteEvent}
        editingEvent={editingEvent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  weekWrap: {
    borderBottomWidth: 1,
    paddingHorizontal: s(12),
    paddingTop: s(10),
    paddingBottom: s(10),
  },
  viewToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: s(10),
    marginBottom: s(10),
  },
  segment: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: s(999),
    padding: s(3),
    gap: s(3),
  },
  segmentBtn: {
    paddingVertical: s(8),
    paddingHorizontal: s(14),
    borderRadius: s(999),
  },
  segmentText: {
    fontSize: s(12),
    fontWeight: "700",
  },
  todayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
    paddingVertical: s(8),
    paddingHorizontal: s(10),
    borderRadius: s(999),
    borderWidth: 1,
  },
  todayBtnText: {
    fontSize: s(12),
    fontWeight: "700",
  },
  weekRow: {
    flexDirection: "row",
    gap: s(8),
  },
  weekDay: {
    flex: 1,
    borderWidth: 1,
    borderRadius: s(14),
    paddingVertical: s(10),
    paddingHorizontal: s(6),
    alignItems: "center",
    justifyContent: "center",
  },
  weekNum: {
    fontSize: s(18),
    fontWeight: "900",
    lineHeight: s(20),
  },
  weekName: {
    fontSize: s(11),
    fontWeight: "700",
    marginTop: s(2),
  },
  weekIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
    marginTop: s(8),
  },
  dot: {
    width: s(7),
    height: s(7),
    borderRadius: s(99),
  },
  dotHollow: {
    width: s(7),
    height: s(7),
    borderRadius: s(99),
    borderWidth: 1,
  },
  countText: {
    fontSize: s(11),
    fontWeight: "800",
  },
  dayHeader: {
    paddingHorizontal: s(12),
    paddingVertical: s(10),
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    flex: 1,
  },
  dayHeaderText: {
    fontSize: s(14),
    fontWeight: "800",
  },
  todayPill: {
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: s(999),
  },
  todayPillText: {
    color: "#fff",
    fontSize: s(11),
    fontWeight: "900",
  },
  dayHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
  },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
    paddingHorizontal: s(8),
    paddingVertical: s(5),
    borderRadius: s(999),
    borderWidth: 1,
  },
  countPillText: {
    fontSize: s(12),
    fontWeight: "900",
  },
  noEventMini: {
    fontSize: s(12),
    fontWeight: "700",
  },
  dayBody: {
    paddingHorizontal: s(12),
    paddingTop: s(10),
    paddingBottom: s(12),
    gap: s(8),
  },
  noEventText: {
    fontSize: s(13),
    fontWeight: "700",
    paddingVertical: s(8),
  },
  itemRow: {
    borderWidth: 1,
    paddingVertical: s(10),
    paddingHorizontal: s(10),
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
  },
  itemBar: {
    width: s(4),
    alignSelf: "stretch",
    borderRadius: s(99),
  },
  itemMain: {
    flex: 1,
    gap: s(3),
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
  },
  itemTitle: {
    flex: 1,
    fontSize: s(13),
    fontWeight: "900",
  },
  itemSubtitle: {
    fontSize: s(12),
    fontWeight: "700",
  },
  expandBtn: {
    marginTop: s(2),
    borderWidth: 1,
    borderRadius: s(12),
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expandBtnText: {
    fontSize: s(12),
    fontWeight: "900",
  },
});