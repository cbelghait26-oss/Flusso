// CalendarScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { s } from "react-native-size-matters";

import { useTheme } from "../src/components/theme/theme";
import { monthLabel, parseYMD, startOfMonth, ymd } from "../src/components/calendar/date";
import type { YMD } from "../src/components/calendar/types";
import { useCalendarItems } from "../src/components/calendar/useCalendarItems";
import { loadLocalEvents, saveLocalEvents, STORAGE_MODULE_ID } from "../src/data/storage";


import { TopAppBar } from "../src/components/calendar/TopAppBar";
import { MonthStrip } from "../src/components/calendar/MonthStrip";
import { AgendaList } from "../src/components/calendar/AgendaList";
import { CreateSheet } from "../src/components/calendar/CreateSheet";
import { SideDrawer } from "../src/components/calendar/SideDrawer";
import { generateDefaultHolidays } from "../src/data/holidays";

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

  const { loading, reload, itemsByDay, dayKeysSorted, events, setEvents } = useCalendarItems({
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
        
        // Generate holidays for current and next year
        const holidays = generateDefaultHolidays();
        
        // Merge holidays with user events (holidays that don't conflict with user events)
        const existingHolidayIds = new Set(userEvents.filter(e => e.id?.startsWith('holiday_')).map(e => e.id));
        const newHolidays = holidays.filter(h => !existingHolidayIds.has(h.id));
        
        // Combine user events with holidays
        const allEvents = [...userEvents, ...newHolidays];
        setEvents(allEvents);
      } catch (error) {
        console.error("Failed to load events:", error);
      }
    };
    loadEvents();
  }, []);

  // Reload data when screen comes into focus (e.g., after adding tasks in TasksObjectivesScreen)
  useFocusEffect(
    React.useCallback(() => {
      reload();
    }, [reload])
  );

  // Search animation
  const searchAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(searchAnim, { toValue: searchOpen ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [searchOpen, searchAnim]);
  const searchH = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, s(48)] });
  const searchOpacity = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const title = useMemo(() => monthLabel(anchorMonth), [anchorMonth]);

  const subtitle = useMemo(() => {
    const d = parseYMD(selected);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }, [selected]);

  const onToday = () => {
    const now = new Date();
    const k = ymd(now);
    setSelected(k);
    setAnchorMonth(startOfMonth(now));
  };

  const onSelectDay = (k: YMD) => {
    setSelected(k);
    setAnchorMonth(startOfMonth(parseYMD(k)));
  };

  const saveEvent = async (evOrEvents: any | any[]) => {
    const eventsToSave = Array.isArray(evOrEvents) ? evOrEvents : [evOrEvents];
    const firstEvent = eventsToSave[0];
    
    let updatedEvents: any[];
    if (editingEvent) {
      // When editing, remove all instances of this recurring event (base + _r* variants)
      const baseId = firstEvent.id ? firstEvent.id.split('_r')[0] : firstEvent.id;
      updatedEvents = events.filter((e) => {
        if (!e.id) return true;
        const eBaseId = e.id.split('_r')[0];
        return eBaseId !== baseId;
      });
      // Add all the new event instances
      updatedEvents = [...eventsToSave, ...updatedEvents];
    } else {
      // Add all new events
      updatedEvents = [...eventsToSave, ...events];
    }
    
    // Update state
    setEvents(updatedEvents);
    
    // Persist to storage (filter out holidays - they shouldn't be saved)
    try {
      const userEvents = updatedEvents.filter(e => !e.id?.startsWith('holiday_'));
      await saveLocalEvents(userEvents);
    } catch (error) {
      console.error("Failed to save events:", error);
    }
    
    // Reload calendar to reflect changes
    await reload();
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
        status: "not-started"
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
        color: "blue"
      });
    } catch {}
    await reload();
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

      <MonthStrip
        theme={theme}
        anchorMonth={anchorMonth}
        selected={selected}
        onSelect={onSelectDay}
        collapsed={monthCollapsed}
        onToggleCollapsed={() => setMonthCollapsed((v) => !v)}
        itemsByDay={itemsByDay}
      />

      <AgendaList
        theme={theme}
        selected={selected}
        onSelect={onSelectDay}
        itemsByDay={itemsByDay}
        dayKeys={dayKeysSorted}
        loading={loading}
        onNew={() => {
          setEditingEvent(null);
          setCreateOpen(true);
        }}
        onEditEvent={(event) => {
          // Find the full LocalEvent from the events array
          if (event.type === "event" && event.id.startsWith("event:")) {
            const eventId = event.id.substring(6); // Remove "event:" prefix
            const fullEvent = events.find((e) => e.id === eventId);
            if (fullEvent) {
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
            }
          }
        }}
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
        editingEvent={editingEvent}
      />
    </SafeAreaView>
  );
}
