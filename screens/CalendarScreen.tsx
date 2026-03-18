// CalendarScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  InteractionManager,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { s } from "../src/ui/ts";

import { useTheme } from "../src/components/theme/theme";
import { monthLabel, parseYMD, startOfMonth, ymd } from "../src/components/calendar/date";
import type { YMD, CalItem } from "../src/components/calendar/types";
import { useCalendarItems } from "../src/components/calendar/useCalendarItems";
import { loadLocalEvents, saveLocalEvents, STORAGE_MODULE_ID, loadContactItems, loadContactsSettings, loadCloudContactEvents, saveCloudContactEvents } from "../src/data/storage";
import { eventColor } from "../src/components/calendar/eventColors";
import type { LocalEvent } from "../src/components/calendar/types";
import { buildContactEventsForDefaultWindow } from "../src/services/contactsDates";

import { TopAppBar } from "../src/components/calendar/TopAppBar";
import { MonthStrip } from "../src/components/calendar/MonthStrip";
import { CreateSheet } from "../src/components/calendar/CreateSheet";
import { SideDrawer } from "../src/components/calendar/SideDrawer";
import { generateDefaultHolidays } from "../src/data/holidays";
import { useDeviceClass, WIDE_MAX_WIDTH } from "../src/ui/responsive";
import { rescheduleAllNotifications } from "../src/services/notifications";
import { auth } from "../src/services/firebase";
import { getFriends, createSharedEvent, getMySharedEvents, leaveSharedEvent, kickParticipantFromEvent, setHideParticipants, updateSharedEvent, sendFriendRequest, type SharedEvent } from "../src/services/SocialService";

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

function itemIconName(type?: string, contactDateKind?: string) {
  // Contact date overrides come first so the correct icon is shown even
  // though the CalItem type is always "event".
  if (contactDateKind === "birthday") return "gift-outline";
  if (contactDateKind === "anniversary") return "heart-outline";
  if (contactDateKind === "other")      return "calendar-outline";

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
  }, []);

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { width } = useWindowDimensions();
  const { isTablet } = useDeviceClass();

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

  /** In-memory contact events derived from stored ContactDateItem[]. Never persisted to localEvents. */
  const [contactEvents, setContactEvents] = useState<LocalEvent[]>([]);

  const [calFriends, setCalFriends] = useState<{ uid: string; displayName: string; friendTag: string }[]>([]);
  const friendUids = useMemo(() => new Set(calFriends.map((f) => f.uid)), [calFriends]);

  const [myUid, setMyUid] = useState(auth.currentUser?.uid ?? "");
  useEffect(() => {
    return auth.onAuthStateChanged((u) => setMyUid(u?.uid ?? ""));
  }, []);
  const sharedEventMapRef = useRef<Map<string, SharedEvent>>(new Map());
  const [editingSharedEvent, setEditingSharedEvent] = useState<SharedEvent | null>(null);

  useEffect(() => {
    getFriends().then((fs) => {
      setCalFriends(fs.map((f) => ({
        uid: f.profile.uid,
        displayName: f.profile.displayName,
        friendTag: f.profile.friendTag ?? "",
      })));
    }).catch(() => {});
  }, []);

  const { loading, reload, items, itemsByDay, events, setEvents } = useCalendarItems({
    query,
    showEvents,
    showTasks,
    showBirthdays,
    showHolidays,
    contactEvents,
  });

  const sharedEventsRef = useRef<LocalEvent[]>([]);

  function sharedEvtToLocal(e: SharedEvent): LocalEvent {
    const isMine = e.creator_id === (auth.currentUser?.uid ?? "");
    return {
      id: `shared_${e.id}`,
      title: isMine ? e.title : `${e.title}${e.creator_name ? " · " + e.creator_name : ""}`,
      allDay: true,
      startDate: e.date,
      startTime: "00:00",
      endDate: e.date,
      endTime: "23:59",
      color: "teal",
      reminder: "none",
      calendarSource: "local",
    };
  }

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

        // Load shared events (events friends have shared with me)
        try {
          const shared = await getMySharedEvents();
          sharedEventMapRef.current = new Map(shared.map((e) => [e.id, e]));
          const uid = auth.currentUser?.uid ?? "";
          sharedEventsRef.current = shared.filter((e) => e.creator_id !== uid).map(sharedEvtToLocal);
        } catch {}

        setEvents([...userEvents, ...newHolidays, ...sharedEventsRef.current]);
      } catch (error) {
        console.error("Failed to load events:", error);
      }
    };
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load contact events whenever the screen comes into focus (not just on mount).
  // This ensures that after the user enables the feature in Settings and navigates
  // back to the calendar, contact dates appear immediately without needing an
  // app restart. Contact events are intentionally kept separate from `events`
  // so they are never accidentally synced to the cloud or saved to localEvents.
  useFocusEffect(
    React.useCallback(() => {
      const loadContactEventsFromStorage = async () => {
        try {
          const settings = await loadContactsSettings();
          if (settings.enabled) {
            // This device has contacts sync — generate events from local contacts
            const items = await loadContactItems();
            if (items.length > 0) {
              const generated = buildContactEventsForDefaultWindow(items);
              setContactEvents(generated);
              // Push to cloud so other devices (without contacts sync) can display them
              saveCloudContactEvents(generated).catch(() => {});
            } else {
              setContactEvents([]);
            }
          } else {
            // No contacts on this device — pull whatever another device has uploaded
            const cloudEvents = await loadCloudContactEvents();
            setContactEvents(cloudEvents);
          }
        } catch (error) {
          console.error("Failed to load contact events:", error);
        }
      };
      loadContactEventsFromStorage();
    }, [])
  );

  // Reload tasks/objectives when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      reload();
    }, [reload])
  );

  // Refresh shared events when screen comes into focus (new shares may have arrived)
  useFocusEffect(
    React.useCallback(() => {
      getMySharedEvents().then((shared) => {
        sharedEventMapRef.current = new Map(shared.map((e) => [e.id, e]));
        const uid = auth.currentUser?.uid ?? "";
        sharedEventsRef.current = shared.filter((e) => e.creator_id !== uid).map(sharedEvtToLocal);
        setEvents((prev) => {
          const withoutShared = prev.filter((e) => !e.id?.startsWith("shared_"));
          return [...withoutShared, ...sharedEventsRef.current];
        });
      }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
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

  // ── Search helpers ──────────────────────────────────────────────────────────
  const queryTrimmed = query.trim();

  /**
   * Pending date to scroll to once the search list closes and the calendar
   * FlatList has had a chance to remount.
   */
  const pendingScrollDate = useRef<YMD | null>(null);

  useEffect(() => {
    if (!queryTrimmed && pendingScrollDate.current) {
      const target = pendingScrollDate.current;
      pendingScrollDate.current = null;
      // Wait for the calendar FlatList to fully remount before scrolling
      setTimeout(() => onSelectDay(target), 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryTrimmed]);

  /**
   * Pick the better of two occurrences of the same recurring event:
   * prefer the closest future date; if both past keep the most recent.
   */
  const pickBetter = (existing: CalItem, candidate: CalItem, todayStr: YMD): CalItem => {
    const existFuture = existing.date >= todayStr;
    const candFuture = candidate.date >= todayStr;
    if (existFuture && candFuture) return candidate.date <= existing.date ? candidate : existing;
    if (candFuture) return candidate;
    if (existFuture) return existing;
    return candidate.date >= existing.date ? candidate : existing;
  };

  /**
   * Deduplicated search results: recurring events and yearly contact events
   * (birthdays, anniversaries) are collapsed to a single row showing the
   * next upcoming occurrence. Sorted ascending by date.
   */
  const searchItems = useMemo(() => {
    if (!queryTrimmed) return [];
    const todayStr = ymd(new Date());

    const byKey = new Map<string, CalItem>();
    for (const it of items) {
      // Standard recurrence pattern: "event:abc_r2026-03-15" → base key "event:abc"
      const afterColon = it.id.replace(/^[^:]+:/, "");
      const baseId = afterColon.split("_r")[0];
      // Contact birthday/anniversary events repeat yearly — key by kind + person name
      const key = it.contactDateKind
        ? `${it.contactDateKind}:${it.title}`
        : `${it.type}:${baseId}`;

      const existing = byKey.get(key);
      byKey.set(key, existing ? pickBetter(existing, it, todayStr) : it);
    }

    const deduped = Array.from(byKey.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // For training-plan tasks, keep only the earliest upcoming one per plan
    const planMap = new Map<string, CalItem>();
    const nonPlan: CalItem[] = [];
    for (const it of deduped) {
      if (!it.trainingPlanId) { nonPlan.push(it); continue; }
      const ex = planMap.get(it.trainingPlanId);
      if (!ex || it.date < ex.date) planMap.set(it.trainingPlanId, it);
    }
    return [...nonPlan, ...planMap.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [items, queryTrimmed]);

  const formatResultDate = (d: YMD): string => {
    if (d === todayKey) return "Today";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = ymd(tomorrow);
    if (d === tomorrowKey) return "Tomorrow";
    return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const kindLabel = (it: CalItem): string => {
    if (it.colorKey === "birthday" || it.contactDateKind === "birthday") return "Birthday";
    if (it.contactDateKind === "anniversary") return "Anniversary";
    if (it.id?.startsWith("event:holiday_")) return "Holiday";
    if (it.type === "event") return "Event";
    if (it.type === "task") return "Task";
    return "Objective";
  };

  const renderSearchRow = ({ item: it }: { item: CalItem }) => {
    const accent = it.colorKey
      ? eventColor(theme, it.colorKey)
      : theme.colors.accent;
    const label = kindLabel(it);
    const dateStr = formatResultDate(it.date);
    const subtitle = it.location ? `${dateStr} · ${it.location}` : dateStr;
    return (
      <Pressable
        onPress={() => {
          const targetDate = it.date as YMD;

          // Open the event sheet if it's a user-created event
          if (it.type === "event") {
            const ev = events.find((e) => `event:${e.id}` === it.id);
            if (ev) {
              setEditingEvent(ev);
              if (ev.id?.startsWith("shared_")) {
                const firestoreId = ev.id.replace(/^shared_/, "").split("_r")[0];
                setEditingSharedEvent(sharedEventMapRef.current.get(firestoreId) ?? null);
              } else {
                const matchingShared = [...sharedEventMapRef.current.values()].find(
                  (e) => e.creator_id === myUid && e.title === ev.title && e.date === ev.startDate
                );
                setEditingSharedEvent(matchingShared ?? null);
              }
              setCreateOpen(true);
            }
          }

          // Store target date then close search — the useEffect above will
          // call onSelectDay once the calendar FlatList has remounted.
          pendingScrollDate.current = targetDate;
          setSearchOpen(false);
          setQuery("");
        }}
        style={({ pressed }) => ([
          styles.itemRow,
          {
            borderRadius: s(12),
            borderColor: theme.colors.border,
            backgroundColor: pressed ? theme.colors.card2 : theme.colors.card,
            opacity: pressed ? 0.85 : 1,
          },
        ])}
      >
        <View style={[styles.itemBar, { backgroundColor: accent }]} />
        <View style={styles.itemMain}>
          <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={1}>{it.title}</Text>
          <Text style={[styles.itemSubtitle, { color: theme.colors.muted }]} numberOfLines={1}>{subtitle}</Text>
        </View>
        <View
          style={{
            paddingHorizontal: s(8),
            paddingVertical: s(3),
            borderRadius: s(999),
            borderWidth: s(1),
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.chip,
          }}
        >
          <Text style={{ color: theme.colors.text, fontSize: s(11), fontWeight: "800" }}>{label}</Text>
        </View>
      </Pressable>
    );
  };

  const onSelectDay = (k: YMD) => {
    setSelected(k);
    setAnchorMonth(startOfMonth(parseYMD(k)));
    const idx = dayKeys.findIndex((d) => d === k);
    if (idx >= 0) {
      scrollMainToIndex(idx);
      scrollStripToIndex(idx);
    }
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

    // If creator is editing a shared event, sync title/date to Firestore
    if (editingSharedEvent && editingSharedEvent.creator_id === myUid) {
      const cleanTitle = firstEvent.title.replace(/\s*[·].*$/i, "").trim();
      updateSharedEvent(editingSharedEvent.id, { title: cleanTitle, date: firstEvent.startDate })
        .then(() => {
          const updated = { ...editingSharedEvent, title: cleanTitle, date: firstEvent.startDate };
          sharedEventMapRef.current.set(editingSharedEvent.id, updated);
        })
        .catch(() => {});
    }

    try {
      const userEvents = updatedEvents.filter((e) => !e.id?.startsWith("holiday_") && !e.id?.startsWith("shared_"));
      await saveLocalEvents(userEvents);
      rescheduleAllNotifications().catch(() => {});
    } catch (error) {
      console.error("Failed to save events:", error);
    }
  };

  // Delete an event (and all its recurrence instances) by base ID
  const deleteEvent = async (eventToDelete: any) => {
    const rawId: string = eventToDelete?.id ?? "";
    const baseId = rawId.split("_r")[0];

    // Shared events: remove self from participants on Firestore; deletion is local only
    if (rawId.startsWith("shared_")) {
      const firestoreId = rawId.replace(/^shared_/, "");
      leaveSharedEvent(firestoreId).catch(() => {});
    }

    const updatedEvents = events.filter((e) => {
      if (!e.id) return true;
      const eBaseId = e.id.split("_r")[0];
      return eBaseId !== baseId;
    });

    setEvents(updatedEvents);
    setCreateOpen(false);
    setEditingEvent(null);

    try {
      const userEvents = updatedEvents.filter((e) => !e.id?.startsWith("holiday_") && !e.id?.startsWith("shared_"));
      await saveLocalEvents(userEvents);
      rescheduleAllNotifications().catch(() => {});
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

  // Agenda window: 3 months back → 6 months forward.
  // FlatList (one item = one day) + initialScrollIndex lands exactly on today,
  // and the user can freely scroll past or future.
  const todayKey = useMemo(() => ymd(new Date()), []);
  const dayKeys = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = addMonths(now, -3);
    const end = addMonths(now, 6);
    return buildDayKeysBetweenInclusive(start, end);
  }, []);

  const listRef = useRef<FlatList<YMD>>(null);
  const weekStripRef = useRef<FlatList<YMD>>(null);

  // Measured row height: header (s38) + body with 1 item (s68) ≈ s(106).
  // The ListHeaderComponent (s8) must also be added to every item's offset.
  const DAY_ROW_H = s(97);
  const LIST_HEADER_H = s(8);

  const todayIndex = useMemo(() => {
    const idx = dayKeys.findIndex((k) => k === todayKey);
    return idx >= 0 ? idx : 0;
  }, [dayKeys, todayKey]);

  // Scroll the main agenda list to a given index.
  const scrollMainToIndex = (index: number, animated = true) => {
    InteractionManager.runAfterInteractions(() => {
      try {
        listRef.current?.scrollToIndex({ index, viewPosition: 0, animated });
      } catch {}
    });
  };

  // Scroll the horizontal day strip to a given index, centering it.
  const scrollStripToIndex = (index: number, animated = true) => {
    try {
      weekStripRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated });
    } catch {}
  };

  const scrollToToday = (animated = true) => {
    scrollMainToIndex(todayIndex, animated);
    scrollStripToIndex(todayIndex, animated);
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

  // Combined FlatList renderItem: header + body in one cell
  const renderDayItem = ({ item: k }: { item: YMD }) => (
    <View>
      {renderDayHeader({ key: k, title: fmtDayHeader(parseYMD(k)) })}
      {renderDayBody(k)}
    </View>
  );

  // ====== Week/Month header strip ======
  const WeekStrip = useMemo(() => {
    // slot width: 7 items fill the strip exactly, same visual density as before
    const innerW = isTablet ? Math.min(width, WIDE_MAX_WIDTH) : width;
    const slotW = Math.floor((innerW - s(24)) / 7);

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
          <FlatList
            ref={weekStripRef}
            horizontal
            data={dayKeys}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={todayIndex}
            getItemLayout={(_, index) => ({
              length: slotW,
              offset: slotW * index,
              index,
            })}
            renderItem={({ item: k }) => {
              const d = parseYMD(k);
              const count = getDayItemsFrom(itemsByDay, k).length;
              const isSel = k === selected;
              return (
                <Pressable
                  onPress={() => onSelectDay(k)}
                  style={[
                    styles.weekDay,
                    { width: slotW },
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
            }}
            onScrollToIndexFailed={() => {}}
          />
        ) : (
          <View style={{ paddingTop: s(8) }}>
            <MonthStrip
              theme={theme}
              anchorMonth={anchorMonth}
              selected={selected}
              onSelect={onSelectDay}
              onChangeMonth={(d) => {
                setAnchorMonth(d);
                const k = ymd(d);
                const idx = dayKeys.findIndex((x) => x === k);
                if (idx >= 0) scrollMainToIndex(idx);
              }}
              collapsed={monthCollapsed}
              onToggleCollapsed={() => setMonthCollapsed((v) => !v)}
              itemsByDay={itemsByDay}
            />
          </View>
        )}
      </View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, calView, selected, anchorMonth, monthCollapsed, itemsByDay, loading, dayKeys, todayIndex, width, isTablet]);

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

                // Track shared event metadata for participant management
                if (fullEvent.id?.startsWith("shared_")) {
                  const firestoreId = fullEvent.id.replace(/^shared_/, "").split("_r")[0];
                  setEditingSharedEvent(sharedEventMapRef.current.get(firestoreId) ?? null);
                } else {
                  const matchingShared = [...sharedEventMapRef.current.values()].find(
                    (e) => e.creator_id === myUid && e.title === fullEvent.title && e.date === fullEvent.startDate
                  );
                  setEditingSharedEvent(matchingShared ?? null);
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
                  <Ionicons
                    name={itemIconName(type, it?.contactDateKind)}
                    size={s(16)}
                    color={it?.contactDateKind === "anniversary" ? "#FF3B30" : theme.colors.text}
                  />
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
      <View style={[{ flex: 1 }, isTablet && { maxWidth: WIDE_MAX_WIDTH, alignSelf: "center" as const, width: "100%" }]}>
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

      {queryTrimmed ? (
        <FlatList
          data={searchItems}
          keyExtractor={(it) => it.id}
          renderItem={renderSearchRow}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: s(12), paddingTop: s(8), paddingBottom: s(140) + insets.bottom, gap: s(8) }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            loading ? (
              <Text style={{ color: theme.colors.muted, fontWeight: "800", marginTop: s(16), textAlign: "center" }}>Loading…</Text>
            ) : (
              <View style={{ marginTop: s(32), alignItems: "center", gap: s(8) }}>
                <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(16) }}>No results</Text>
                <Text style={{ color: theme.colors.muted, fontWeight: "700", fontSize: s(13), textAlign: "center" }}>
                  Try "holiday", "birthday", a name, or a date like "March 15".
                </Text>
              </View>
            )
          }
        />
      ) : (
        <>
      {WeekStrip}

      <FlatList
        ref={listRef}
        data={dayKeys}
        keyExtractor={(item) => item}
        renderItem={renderDayItem}
        getItemLayout={(_, index) => ({
          length: DAY_ROW_H,
          offset: LIST_HEADER_H + DAY_ROW_H * index,
          index,
        })}
        initialScrollIndex={todayIndex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: s(140) + insets.bottom }}
        ListHeaderComponent={<View style={{ height: LIST_HEADER_H }} />}
        onScrollToIndexFailed={(info) => {
          // Fallback: scroll to the closest safe index, then retry to today
          const safeIndex = Math.min(info.index, info.highestMeasuredFrameIndex ?? 0);
          listRef.current?.scrollToIndex({ index: safeIndex, animated: false });
          setTimeout(() => scrollToToday(false), 300);
        }}
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={8}
        initialNumToRender={15}
        updateCellsBatchingPeriod={50}
      />
        </>
      )}

      {/* FAB */}
      <Pressable
        onPress={() => {
          setEditingEvent(null);
          setEditingSharedEvent(null);
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
      </View>{/* end centering column */}

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
          setEditingSharedEvent(null);
        }}
        onSaveEvent={saveEvent}
        onDeleteEvent={deleteEvent}
        editingEvent={editingEvent}
        friends={calFriends}
        onShare={(inviteeUids, title, date) => {
          createSharedEvent(title, date, inviteeUids).catch(() => {});
        }}
        myUid={myUid}
        friendUids={friendUids}
        sharedEventData={editingSharedEvent ? {
          creator_id: editingSharedEvent.creator_id,
          participants: editingSharedEvent.participants,
          hideParticipants: editingSharedEvent.hideParticipants,
        } : null}
        onKickParticipant={(targetUid) => {
          if (!editingSharedEvent) return;
          kickParticipantFromEvent(editingSharedEvent.id, targetUid)
            .then(() => {
              // Update local map
              const updated = {
                ...editingSharedEvent,
                participantUids: editingSharedEvent.participantUids.filter((u) => u !== targetUid),
                participants: editingSharedEvent.participants.filter((p) => p.uid !== targetUid),
              };
              sharedEventMapRef.current.set(editingSharedEvent.id, updated);
              setEditingSharedEvent(updated);
            })
            .catch(() => {});
        }}
        onToggleHideParticipants={(hide) => {
          if (!editingSharedEvent) return;
          setHideParticipants(editingSharedEvent.id, hide)
            .then(() => {
              const updated = { ...editingSharedEvent, hideParticipants: hide };
              sharedEventMapRef.current.set(editingSharedEvent.id, updated);
              setEditingSharedEvent(updated);
            })
            .catch(() => {});
        }}
        onLeaveSharedEvent={() => {
          if (editingEvent) deleteEvent(editingEvent);
        }}
        onAddFriend={(uid) => {
          sendFriendRequest(uid)
            .then((res) => {
              if (res.ok) Alert.alert("Request sent", "Friend request sent!");
              else Alert.alert("Already connected", res.error ?? "Request already sent.");
            })
            .catch(() => {});
        }}
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
    // width is set inline per item so the strip scrolls correctly
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