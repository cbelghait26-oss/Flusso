import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Keyboard,
  Platform,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../src/components/theme/theme";
import { s } from "react-native-size-matters";
import { loadTasks, loadObjectives, todayKey } from "../../src/data/storage";
import type { Task, Objective } from "../../src/data/models";
import type { LocalEvent } from "../../src/components/calendar/types";
import { BIRTHDAY_COLOR } from "../../src/components/calendar/eventColors";

type Kind = "task" | "objective" | "event" | "birthday" | "action";
type Item = { 
  id: string; 
  kind: Kind; 
  title: string; 
  subtitle?: string;
  data?: Task | Objective | LocalEvent | ActionItem; // Store original data for navigation
};

type ActionItem = {
  id: string;
  action: "toggle-theme" | "change-accent" | "settings" | "focus" | "calendar" | "profile" | "achievements";
  icon: keyof typeof Ionicons.glyphMap;
};

const label = (k: Kind) => {
  switch (k) {
    case "task": return "Task";
    case "objective": return "Objective";
    case "event": return "Event";
    case "birthday": return "Birthday";
    case "action": return "Action";
    default: return "Item";
  }
};

const icon = (k: Kind): keyof typeof Ionicons.glyphMap => {
  switch (k) {
    case "task": return "checkmark-circle-outline";
    case "objective": return "flag-outline";
    case "event": return "calendar-outline";
    case "birthday": return "gift-outline";
    case "action": return "flash-outline";
    default: return "help-circle-outline";
  }
};

// Get importance color for tasks
function getImportanceColor(importance: Task["importance"]): string {
  switch (importance) {
    case 1: return "rgba(76, 175, 80, 0.2)"; // Low - Green
    case 2: return "rgba(33, 150, 243, 0.2)"; // Medium - Blue
    case 3: return "rgba(255, 152, 0, 0.2)"; // High - Orange
    case 4: return "rgba(244, 67, 54, 0.2)"; // Critical - Red
    default: return "rgba(158, 158, 158, 0.2)";
  }
}

// Get priority color for objectives
function getObjectiveColor(color: Objective["color"]): string {
  switch (color) {
    case "blue": return "rgba(0, 122, 255, 0.2)";
    case "teal": return "rgba(33, 175, 161, 0.2)";
    case "green": return "rgba(52, 199, 89, 0.2)";
    case "yellow": return "rgba(255, 204, 0, 0.2)";
    case "orange": return "rgba(255, 149, 0, 0.2)";
    case "red": return "rgba(255, 59, 48, 0.2)";
    case "purple": return "rgba(175, 82, 222, 0.2)";
    case "gray": return "rgba(142, 142, 147, 0.2)";
    default: return "rgba(0, 122, 255, 0.2)";
  }
}

// Format deadline as subtitle
function formatDeadline(deadline?: string) {
  if (!deadline) return undefined;
  const today = todayKey();
  const d = new Date(deadline + "T00:00:00");
  
  if (deadline < today) {
    return "⚠️ Overdue";
  } else if (deadline === today) {
    return "📌 Today";
  } else {
    const td = new Date(today + "T00:00:00");
    const tm = new Date(td);
    tm.setDate(td.getDate() + 1);
    const tmKey = todayKey(tm);
    if (deadline === tmKey) {
      return "📅 Tomorrow";
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
}

// Calculate objective progress
function calcProgress(objId: string, tasks: Task[]): string {
  const relatedTasks = tasks.filter(t => t.objectiveId === objId);
  if (relatedTasks.length === 0) return "No tasks";
  const completed = relatedTasks.filter(t => t.status === "completed").length;
  const percent = Math.round((completed / relatedTasks.length) * 100);
  return `${completed}/${relatedTasks.length} tasks · ${percent}%`;
}

// Searchable actions for quick access
const ACTIONS: (ActionItem & { title: string; subtitle: string; tags: string[] })[] = [
  { id: "act-1", action: "toggle-theme", icon: "moon-outline", title: "Toggle Dark Mode", subtitle: "Switch between light and dark theme", tags: ["dark", "light", "theme", "mode"] },
  { id: "act-2", action: "change-accent", icon: "color-palette-outline", title: "Change Accent Color", subtitle: "Customize your app theme", tags: ["accent", "color", "theme", "customize"] },
  { id: "act-3", action: "settings", icon: "settings-outline", title: "Settings", subtitle: "App settings and preferences", tags: ["settings", "preferences", "config"] },
  { id: "act-4", action: "focus", icon: "time-outline", title: "Focus Zone", subtitle: "Start a focus session", tags: ["focus", "timer", "pomodoro", "work"] },
  { id: "act-5", action: "calendar", icon: "calendar", title: "Calendar", subtitle: "View your schedule", tags: ["calendar", "schedule", "events"] },
  { id: "act-6", action: "profile", icon: "person-outline", title: "Profile", subtitle: "View your profile", tags: ["profile", "account", "user"] },
  { id: "act-7", action: "achievements", icon: "trophy-outline", title: "Achievements", subtitle: "View your badges and progress", tags: ["achievements", "badges", "progress", "stats"] },
];

export default function SearchScreen({ navigation }: any) {
  const { colors, radius, spacing, isDark, setThemeMode, accent, setAccent } = useTheme();

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Kind | "all">("all");
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data when screen focuses
  useFocusEffect(
    React.useCallback(() => {
      const loadData = async () => {
        setLoading(true);
        try {
          const [loadedTasks, loadedObjectives, loadedEvents] = await Promise.all([
            loadTasks(),
            loadObjectives(),
            loadEventsFromStorage(),
          ]);
          setTasks(loadedTasks);
          setObjectives(loadedObjectives);
          setEvents(loadedEvents);
        } catch (error) {
          console.error("Failed to load search data:", error);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [])
  );

  // Load events from AsyncStorage (where CreateSheet saves them)
  const loadEventsFromStorage = async (): Promise<LocalEvent[]> => {
    try {
      const raw = await AsyncStorage.getItem("calendar:events");
      if (!raw) return [];
      return JSON.parse(raw) as LocalEvent[];
    } catch {
      return [];
    }
  };

  // Convert all data to searchable items
  const allItems = useMemo(() => {
    const items: Item[] = [];
    
    // Add tasks (exclude completed tasks)
    tasks
      .filter(t => t.status !== "completed")
      .forEach(task => {
        const objective = objectives.find(o => o.id === task.objectiveId);
        const subtitle = formatDeadline(task.deadline) || objective?.title || "No deadline";
        items.push({
          id: task.id,
          kind: "task",
          title: task.title,
          subtitle,
          data: task,
        });
      });
    
    // Add objectives (only active ones)
    objectives
      .filter(o => o.status === "active")
      .forEach(obj => {
        const subtitle = calcProgress(obj.id, tasks);
        items.push({
          id: obj.id,
          kind: "objective",
          title: obj.title,
          subtitle,
          data: obj,
        });
      });
    
    // Add events and birthdays
    events.forEach(event => {
      const isBirthday = event.eventType === "birthday";
      const dateStr = new Date(event.startDate + "T00:00:00").toLocaleDateString(undefined, { 
        month: "short", 
        day: "numeric",
        year: event.allDay ? undefined : "numeric"
      });
      const timeStr = event.allDay ? "All day" : event.startTime;
      const subtitle = event.location ? `${dateStr} · ${event.location}` : `${dateStr} · ${timeStr}`;
      
      items.push({
        id: event.id,
        kind: isBirthday ? "birthday" : "event",
        title: event.title,
        subtitle,
        data: event,
      });
    });
    
    // Add action items
    ACTIONS.forEach(action => {
      items.push({
        id: action.id,
        kind: "action",
        title: action.title,
        subtitle: action.subtitle,
        data: action,
      });
    });
    
    return items;
  }, [tasks, objectives, events]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    let filtered = allItems.filter((it) => {
      if (filter !== "all" && it.kind !== filter) return false;
      if (!query) return true;
      
      // Search in title, subtitle, and tags (for actions)
      let hay = `${it.title} ${it.subtitle ?? ""}`.toLowerCase();
      if (it.kind === "action" && it.data) {
        const actionData = it.data as ActionItem & { tags?: string[] };
        const action = ACTIONS.find(a => a.id === actionData.id);
        if (action) {
          hay += ` ${action.tags.join(" ")}`;
        }
      }
      
      return hay.includes(query);
    });
    
    // Sort results: when no query, show actions first, then rest by kind
    if (!query) {
      const order: Record<Kind, number> = {
        action: 1,
        task: 2,
        objective: 3,
        event: 4,
        birthday: 5,
      };
      filtered.sort((a, b) => order[a.kind] - order[b.kind]);
    }
    
    return filtered;
  }, [q, filter, allItems]);

  const handleItemPress = async (item: Item) => {
    Keyboard.dismiss();
    
    if (item.kind === "task") {
      navigation.navigate("MainTabs", { screen: "TasksTab" });
      setTimeout(() => navigation.goBack(), 100);
    } else if (item.kind === "objective") {
      navigation.navigate("MainTabs", { screen: "TasksTab" });
      setTimeout(() => navigation.goBack(), 100);
    } else if (item.kind === "event" || item.kind === "birthday") {
      navigation.navigate("MainTabs", { screen: "CalendarTab" });
      setTimeout(() => navigation.goBack(), 100);
    } else if (item.kind === "action" && item.data) {
      const actionData = item.data as ActionItem;
      
      switch (actionData.action) {
        case "toggle-theme":
          // Toggle theme immediately
          setThemeMode(isDark ? "light" : "dark");
          break;
          
        case "change-accent":
          // Navigate to settings where accent can be changed
          navigation.navigate("MainTabs", { screen: "SettingsTab" });
          setTimeout(() => navigation.goBack(), 100);
          break;
          
        case "settings":
          navigation.navigate("MainTabs", { screen: "SettingsTab" });
          setTimeout(() => navigation.goBack(), 100);
          break;
          
        case "focus":
          navigation.navigate("FocusZoneScreen");
          setTimeout(() => navigation.goBack(), 100);
          break;
          
        case "calendar":
          navigation.navigate("MainTabs", { screen: "CalendarTab" });
          setTimeout(() => navigation.goBack(), 100);
          break;
          
        case "profile":
        case "achievements":
          navigation.navigate("MainTabs", { screen: "SettingsTab" });
          setTimeout(() => navigation.goBack(), 100);
          break;
      }
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.bg },
        header: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        headerTitle: { color: colors.text, fontSize: s(18), fontWeight: "900" },
        headerBtn: {
          width: s(44),
          height: s(44),
          borderRadius: s(22),
          backgroundColor: colors.chip,
          borderWidth: s(1),
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },

        searchWrap: {
          marginHorizontal: spacing.lg,
          marginTop: spacing.sm,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: s(1),
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          height: s(48),
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          shadowColor: colors.shadow,
          shadowOpacity: Platform.OS === "ios" ? 0.1 : 0,
          shadowRadius: s(8),
          shadowOffset: { width: s(0), height: s(4) },
          elevation: Platform.OS === "android" ? s(2) : 0,
        },
        input: { flex: 1, color: colors.text, fontSize: s(15), fontWeight: "700" },

        filtersContainer: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xs,
        },
        filters: {
          flexDirection: "row",
          gap: spacing.xs,
        },
        pill: {
          paddingVertical: s(6),
          paddingHorizontal: s(16),
          borderRadius: s(999),
          backgroundColor: colors.chip,
          borderWidth: s(1),
          borderColor: colors.border,
        },
        pillActive: {
          backgroundColor: colors.accent + "33",
          borderColor: colors.accent + "55",
        },
        pillText: { color: colors.muted, fontSize: s(14), fontWeight: "700" },
        pillTextActive: { color: colors.text },

        listPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: s(100) },

        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: s(1),
          borderColor: colors.border,
          marginBottom: spacing.sm,
        },
        rowIcon: {
          width: s(44),
          height: s(44),
          borderRadius: s(22),
          backgroundColor: colors.surface2,
          borderWidth: s(1),
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        rowTitle: { color: colors.text, fontSize: s(15), fontWeight: "800" },
        rowSub: { color: colors.muted, fontSize: s(13), marginTop: s(2), fontWeight: "600" },

        kindTag: {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.sm,
          backgroundColor: colors.chip,
          borderWidth: s(1),
          borderColor: colors.border,
        },
        kindTagText: { color: colors.text, fontSize: s(11), fontWeight: "800", textTransform: "uppercase" },

        empty: {
          marginTop: spacing.xl,
          marginHorizontal: spacing.sm,
          padding: spacing.xl,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: s(1),
          borderColor: colors.border,
          alignItems: "center",
        },
        emptyTitle: { color: colors.text, fontSize: s(16), fontWeight: "800" },
        emptySub: { color: colors.muted, marginTop: spacing.xs, fontSize: s(13), textAlign: "center", fontWeight: "600", lineHeight: s(18) },
      }),
    [colors, radius, spacing],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.75 }]}
        >
          <Ionicons name="chevron-back" size={s(22)} color={colors.text} />
        </Pressable>

        <Text style={styles.headerTitle}>Search</Text>

        <Pressable
          onPress={() => {
            setQ("");
            setFilter("all");
            Keyboard.dismiss();
          }}
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.75 }]}
        >
          <Ionicons name="close" size={s(22)} color={colors.text} />
        </Pressable>
      </View>

      {/* search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={s(20)} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search everything in FlowApp..."
          placeholderTextColor={colors.muted}
          autoFocus
          returnKeyType="search"
          style={styles.input}
        />
        {!!q && (
          <Pressable onPress={() => setQ("")} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <Ionicons name="close-circle" size={s(20)} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {/* filters */}
      <View style={styles.filtersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {(["all", "task", "objective", "event", "birthday", "action"] as const).map((k) => {
            const active = filter === k;
            return (
              <Pressable
                key={k}
                onPress={() => setFilter(k)}
                style={({ pressed }) => [
                  styles.pill,
                  active && styles.pillActive,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {k === "all" ? "All" : label(k)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* results */}
      <FlatList
        data={results}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.listPad}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          let bgColor = colors.surface2;
          
          if (item.kind === "task" && item.data) {
            bgColor = getImportanceColor((item.data as Task).importance);
          } else if (item.kind === "objective" && item.data) {
            bgColor = getObjectiveColor((item.data as Objective).color);
          } else if (item.kind === "event" && item.data) {
            const event = item.data as LocalEvent;
            bgColor = `rgba(33, 150, 243, 0.2)`; // Blue for events
          } else if (item.kind === "birthday") {
            bgColor = `${BIRTHDAY_COLOR}33`; // Birthday-only color with alpha
          } else if (item.kind === "action") {
            bgColor = `rgba(156, 39, 176, 0.2)`; // Purple for actions
          }
          
          return (
            <Pressable 
              onPress={() => handleItemPress(item)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.78 }]}
            >
              <View style={[styles.rowIcon, { backgroundColor: bgColor }]}>
                <Ionicons name={icon(item.kind) as any} size={20} color={colors.text} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                {!!item.subtitle && <Text style={styles.rowSub}>{item.subtitle}</Text>}
              </View>

              <View style={styles.kindTag}>
                <Text style={styles.kindTagText}>{label(item.kind)}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Loading...</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptySub}>
                {q.trim() 
                  ? "Try a different keyword or switch filters. Search for 'dark mode' or 'focus' to find quick actions." 
                  : "Start typing to search tasks, events, settings, and more."}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
