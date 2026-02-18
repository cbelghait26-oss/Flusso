// TasksObjectivesScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { s } from "react-native-size-matters";

import { useTheme } from "../src/components/theme/theme";
import { SegmentedControl } from "../src/components/ui/SegmentedControl";
import { BottomSheet } from "../src/components/ui/BottomSheet";

import type { Objective, Task } from "../src/data/models";
import {
  addObjective,
  addTask,
  deleteObjective,
  deleteTask,
  ensureDefaultObjective,
  loadObjectives,
  loadTasks,
  setObjectiveCompleted,
  todayKey,
  updateObjective,
  updateTask,
} from "../src/data/storage";

type Mode = "tasks" | "objectives";
type SortMode = "my-day" | "important" | "planned" | "tasks";

const CATEGORIES: Objective["category"][] = [
  "Academic",
  "Career",
  "Personal",
  "Health & Fitness",
  "Skill Development",
  "Creative",
  "Misc",
];

const OBJECTIVE_COLORS: Array<{ value: Objective["color"]; label: string; hex: string }> = [
  { value: "blue", label: "Blue", hex: "#007AFF" },
  { value: "teal", label: "Teal", hex: "#21afa1" },
  { value: "green", label: "Green", hex: "#34C759" },
  { value: "yellow", label: "Yellow", hex: "#FFCC00" },
  { value: "orange", label: "Orange", hex: "#FF9500" },
  { value: "red", label: "Red", hex: "#FF3B30" },
  { value: "purple", label: "Purple", hex: "#AF52DE" },
  { value: "gray", label: "Gray", hex: "#8E8E93" },
];

const IMPORTANCE: Array<{ v: Task["importance"]; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { v: 1, label: "Low", icon: "leaf-outline" },
  { v: 2, label: "Medium", icon: "speedometer-outline" },
  { v: 3, label: "High", icon: "flame-outline" },
  { v: 4, label: "Critical", icon: "warning-outline" },
];

function fmtShortDay(dateKey: string) {
  const d = new Date(dateKey + "T00:00:00");
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(d);
}
function isOverdue(deadline?: string) {
  if (!deadline) return false;
  return deadline < todayKey();
}
function isToday(deadline?: string) {
  if (!deadline) return false;
  return deadline === todayKey();
}
function clamp(s: string) {
  return s.trim();
}
function smartBucket(deadline?: string) {
  if (!deadline) return "Later";
  const t = todayKey();
  if (deadline < t) return "Overdue";
  if (deadline === t) return "Today";

  const td = new Date(t + "T00:00:00");
  const tm = new Date(td);
  tm.setDate(td.getDate() + 1);
  const tmKey = todayKey(tm);
  if (deadline === tmKey) return "Tomorrow";
  return "Upcoming";
}

type TaskRowProps = {
  t: Task;
  objTitle?: string;
  dueLabel: string;
  dueTone: "danger" | "today" | "neutral";
  colors: any;
  radius: any;
  onToggleDone: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onToggleStar: (t: Task) => void;
};

const TaskRow = React.memo(function TaskRow(props: TaskRowProps) {
  const { t, objTitle, dueLabel, dueTone, colors, radius, onToggleDone, onEdit, onDelete, onToggleStar } = props;

  const [completing, setCompleting] = useState(false);
  const scaleAnim = useState(new Animated.Value(1))[0];
  const opacityAnim = useState(new Animated.Value(1))[0];

  const handleComplete = async () => {
    if (completing) return;
    setCompleting(true);
    
    // Play completion sound
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/Completed.mp3")
      );
      await sound.playAsync();
      // Clean up sound after playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log("Failed to play completion sound:", error);
    }
    
    // Animate scale up and opacity down
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 350,
        delay: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Reset animations and call the actual handler
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
      setCompleting(false);
      onToggleDone(t);
    });
  };

  const dueBg =
    dueTone === "danger"
      ? "rgba(255,80,80,0.16)"
      : dueTone === "today"
      ? "rgba(80,180,255,0.14)"
      : "rgba(0,0,0,0.16)";
  const dueBd =
    dueTone === "danger"
      ? "rgba(255,80,80,0.22)"
      : dueTone === "today"
      ? "rgba(80,180,255,0.18)"
      : colors.border;

  const isStarred = (t.importance ?? 2) >= 3;

  return (
    <Animated.View
      style={[
        {
          borderRadius: radius.xl,
          borderWidth: s(1),
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: s(12),
        },
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: s(12) }}>
        <Pressable
          onPress={handleComplete}
          disabled={completing}
          style={({ pressed }) => [
            {
              width: s(26),
              height: s(26),
              borderRadius: s(13),
              borderWidth: s(2),
              borderColor: completing ? "#4CAF50" : colors.border,
              alignItems: "center",
              justifyContent: "center",
              marginTop: s(2),
              opacity: pressed ? 0.85 : 1,
              backgroundColor: completing ? "#4CAF50" : "transparent",
            },
          ]}
          hitSlop={s(10)}
        >
          {completing && (
            <Ionicons name="checkmark" size={s(18)} color="#fff" />
          )}
        </Pressable>

        <Pressable onPress={() => onEdit(t)} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.92 : 1 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: s(15), flex: 1 }} numberOfLines={1}>
              {t.title}
            </Text>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onEdit(t);
              }}
              style={({ pressed }) => [{ padding: s(4), opacity: pressed ? 0.8 : 1 }]}
              hitSlop={s(8)}
            >
              <Ionicons 
                name="create-outline" 
                size={s(18)} 
                color={colors.muted} 
              />
            </Pressable>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onToggleStar(t);
              }}
              style={({ pressed }) => [{ padding: s(4), opacity: pressed ? 0.8 : 1 }]}
              hitSlop={s(8)}
            >
              <Ionicons 
                name={isStarred ? "star" : "star-outline"} 
                size={s(18)} 
                color={isStarred ? "#FFD700" : colors.muted} 
              />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(10), marginTop: s(8) }}>
            <View style={metaPill(colors, radius)}>
              <Ionicons name="bookmark-outline" size={s(14)} color={colors.muted} />
              <Text style={metaText(colors)} numberOfLines={1}>
                {objTitle ?? "Objective"}
              </Text>
            </View>

            <View
              style={{
                paddingVertical: s(6),
                paddingHorizontal: s(10),
                borderRadius: s(999),
                backgroundColor: dueBg,
                borderWidth: s(1),
                borderColor: dueBd,
                flexDirection: "row",
                alignItems: "center",
                gap: s(8),
              }}
            >
              <Ionicons name="calendar-outline" size={s(14)} color={colors.muted} />
              <Text style={metaText(colors)}>{dueLabel}</Text>
            </View>

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onDelete(t.id);
              }}
              style={({ pressed }) => [
                {
                  paddingVertical: s(6),
                  paddingHorizontal: s(10),
                  borderRadius: s(999),
                  flexDirection: "row",
                  alignItems: "center",
                  gap: s(8),
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              hitSlop={s(8)}
            >
              {({ pressed }) => (
                <Ionicons name="trash-outline" size={s(14)} color={pressed ? "#FF5050" : colors.muted} />
              )}
            </Pressable>
          </View>

          {!!t.description && (
            <Text style={{ color: colors.muted, fontWeight: "700", marginTop: s(8), lineHeight: s(18) }} numberOfLines={2}>
              {t.description}
            </Text>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
});

export default function TasksObjectivesScreen() {
  const { colors, radius, spacing } = useTheme();

  const [mode, setMode] = useState<Mode>("tasks");

  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("planned");
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const [completedOpen, setCompletedOpen] = useState(false);
  const [completedObjectivesOpen, setCompletedObjectivesOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Overdue: true,
    Today: true,
    Tomorrow: true,
    Upcoming: true,
    Later: true,
  });

  const [quickTitle, setQuickTitle] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Task form (details sheet)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tObjectiveId, setTObjectiveId] = useState("");
  const [tDeadline, setTDeadline] = useState<string | undefined>(undefined);

  const [taskDateOpen, setTaskDateOpen] = useState(false);
  const [taskObjectiveOpen, setTaskObjectiveOpen] = useState(false);

  // Objective sheet
  const [objSheetOpen, setObjSheetOpen] = useState(false);
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
  const [oTitle, setOTitle] = useState("");
  const [oDesc, setODesc] = useState("");
  const [oCategory, setOCategory] = useState<Objective["category"]>("Academic");
  const [oColor, setOColor] = useState<Objective["color"]>("blue");
  const [oDeadline, setODeadline] = useState<string | undefined>(undefined);

  const [objDateOpen, setObjDateOpen] = useState(false);
  const [objCategoryOpen, setObjCategoryOpen] = useState(false);

  const [saving, setSaving] = useState(false);

  const closeAllSheets = useCallback(() => {
    setSortSheetOpen(false);

    setDetailsOpen(false);
    setTaskObjectiveOpen(false);
    setTaskDateOpen(false);

    setObjSheetOpen(false);
    setObjCategoryOpen(false);
    setObjDateOpen(false);

    Keyboard.dismiss();
  }, []);

  const refresh = useCallback(async () => {
    console.log("TasksObjectivesScreen: refresh() called");
    const misc = await ensureDefaultObjective();
    const objs = await loadObjectives();
    const ts = await loadTasks();
    console.log("TasksObjectivesScreen: Loaded", ts.length, "tasks");
    setObjectives(objs);
    setTasks(ts);
    setTObjectiveId((prev) => prev || misc.id);
    console.log("TasksObjectivesScreen: State updated");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const objectivesById = useMemo(() => {
    const m = new Map<string, Objective>();
    objectives.forEach((o) => m.set(o.id, o));
    return m;
  }, [objectives]);

  const objectiveOptions: Array<{ value: string; label: string; subtitle?: string; icon: keyof typeof Ionicons.glyphMap }> = useMemo(() => {
    return objectives
      .filter((o) => o.status !== "completed")
      .map((o) => ({
        value: o.id,
        label: o.title,
        subtitle: o.category,
        icon: "bookmark-outline",
      }));
  }, [objectives]);

  const categoryOptions: Array<{ value: Objective["category"]; label: string; icon: keyof typeof Ionicons.glyphMap }> = useMemo(() => {
    return CATEGORIES.map((c) => ({ value: c, label: c, icon: "pricetag-outline" }));
  }, []);

  const openCreateObjective = () => {
    setEditingObjectiveId(null);
    setOTitle("");
    setODesc("");
    setOCategory("Academic");
    setOColor("blue");
    setODeadline(undefined);
    setObjSheetOpen(true);
  };

  const openEditObjective = (o: Objective) => {
    setEditingObjectiveId(o.id);
    setOTitle(o.title ?? "");
    setODesc(o.description ?? "");
    setOCategory(o.category);
    setOColor(o.color);
    setODeadline(o.deadline);
    setObjSheetOpen(true);
  };

  const openTaskDetailsFromQuick = () => {
    setEditingTaskId(null);
    setTTitle(clamp(quickTitle));
    setTDesc("");
    setTDeadline(undefined);
    setDetailsOpen(true);
  };

  const openEditTask = (t: Task) => {
    setEditingTaskId(t.id);
    setTTitle(t.title ?? "");
    setTDesc(t.description ?? "");
    setTObjectiveId(t.objectiveId);
    setTDeadline(t.deadline);
    setDetailsOpen(true);
  };

  const saveTask = async () => {
    if (saving) return;
    setSaving(true);
    try {
      console.log("saveTask: Starting save");
      const title = clamp(tTitle);
      if (title.length < 3) return;
      if (!tObjectiveId) return;

      if (editingTaskId) {
        console.log("saveTask: Updating task", editingTaskId);
        await updateTask(editingTaskId, {
          title,
          objectiveId: tObjectiveId,
          description: clamp(tDesc) ? clamp(tDesc) : undefined,
          deadline: tDeadline,
        });
      } else {
        console.log("saveTask: Adding new task");
        await addTask({
          title,
          objectiveId: tObjectiveId,
          description: clamp(tDesc) ? clamp(tDesc) : undefined,
          deadline: tDeadline,
          importance: 2,
          status: "not-started",
        });
        console.log("saveTask: Task added to storage");
      }

      console.log("saveTask: Closing sheets");
      // Close sheets and clear state
      closeAllSheets();
      setEditingTaskId(null);
      setQuickTitle("");
      
      console.log("saveTask: Refreshing task list");
      // Refresh task list
      await refresh();
      console.log("saveTask: Complete");
    } catch (error) {
      console.error("saveTask: Error", error);
    } finally {
      setSaving(false);
    }
  };

  const quickAdd = async () => {
    if (saving) return;
    setSaving(true);
    try {
      console.log("quickAdd: Starting quick add");
      const title = clamp(quickTitle);
      if (title.length < 3) return;
      if (!tObjectiveId) return;

      console.log("quickAdd: Adding task");
      await addTask({
        title,
        objectiveId: tObjectiveId,
        description: undefined,
        deadline: undefined,
        importance: 2,
        status: "not-started",
      });
      console.log("quickAdd: Task added to storage");

      console.log("quickAdd: Clearing input");
      // Clear input and dismiss keyboard
      setQuickTitle("");
      Keyboard.dismiss();
      
      console.log("quickAdd: Refreshing task list");
      // Refresh task list
      await refresh();
      console.log("quickAdd: Complete");
    } catch (error) {
      console.error("quickAdd: Error", error);
    } finally {
      setSaving(false);
    }
  };

  const saveObjective = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const title = clamp(oTitle);
      if (title.length < 3) return;

      if (editingObjectiveId) {
        await updateObjective(editingObjectiveId, {
          title,
          description: clamp(oDesc) ? clamp(oDesc) : undefined,
          category: oCategory,
          color: oColor,
          deadline: oDeadline,
        });
      } else {
        await addObjective({
          title,
          description: clamp(oDesc) ? clamp(oDesc) : undefined,
          category: oCategory,
          color: oColor,
          deadline: oDeadline,
        });
      }

      setEditingObjectiveId(null);
      closeAllSheets();
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const toggleCompleteTask = async (t: Task) => {
    if (saving) return;
    setSaving(true);
    try {
      if (t.status === "completed") {
        await updateTask(t.id, { status: "not-started", completedAt: null });
      } else {
        await updateTask(t.id, { status: "completed", completedAt: new Date().toISOString() });
      }
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const toggleStarTask = async (t: Task) => {
    if (saving) return;
    setSaving(true);
    try {
      const isCurrentlyStarred = (t.importance ?? 2) >= 3;
      await updateTask(t.id, { importance: isCurrentlyStarred ? 2 : 3 });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const objectiveProgress = (objectiveId: string) => {
    const ts = tasks.filter((t) => t.objectiveId === objectiveId);
    const total = ts.length;
    const done = ts.filter((t) => t.status === "completed").length;
    const pct = total <= 0 ? 0 : Math.round((done / total) * 100);
    return { pct, done, total };
  };

  const q = query.trim().toLowerCase();

  const activeTasks = useMemo(() => {
    const base = tasks.filter((t) => t.status !== "completed");

    const filtered = base.filter((t) => {
      if (!q) return true;
      const obj = objectivesById.get(t.objectiveId);
      return (
        (t.title ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        (obj?.title ?? "").toLowerCase().includes(q)
      );
    });

    // Filter by sort mode
    let modeFiltered = filtered;
    if (sortMode === "my-day") {
      const today = todayKey();
      modeFiltered = filtered.filter((t) => t.deadline === today);
    } else if (sortMode === "important") {
      modeFiltered = filtered.filter((t) => (t.importance ?? 2) >= 3);
    }

    const sorted = [...modeFiltered].sort((a, b) => {
      const aTitle = (a.title ?? "").toLowerCase();
      const bTitle = (b.title ?? "").toLowerCase();
      const aImp = a.importance ?? 2;
      const bImp = b.importance ?? 2;
      const aDue = a.deadline ?? "9999-12-31";
      const bDue = b.deadline ?? "9999-12-31";

      if (sortMode === "tasks") return aTitle.localeCompare(bTitle);

      // planned (smart sorting)
      const order = (t: Task) => {
        const k = smartBucket(t.deadline);
        return k === "Overdue" ? 0 : k === "Today" ? 1 : k === "Tomorrow" ? 2 : k === "Upcoming" ? 3 : 4;
      };
      const ao = order(a);
      const bo = order(b);
      if (ao !== bo) return ao - bo;
      if (aImp !== bImp) return bImp - aImp;
      return aDue.localeCompare(bDue);
    });

    return sorted;
  }, [tasks, q, objectivesById, sortMode]);

  const completedTasks = useMemo(() => {
    const base = tasks.filter((t) => t.status === "completed");
    const filtered = base.filter((t) => {
      if (!q) return true;
      const obj = objectivesById.get(t.objectiveId);
      return (
        (t.title ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        (obj?.title ?? "").toLowerCase().includes(q)
      );
    });

    filtered.sort((a, b) => {
      const ad = a.completedAt ?? "";
      const bd = b.completedAt ?? "";
      return bd.localeCompare(ad);
    });

    return filtered;
  }, [tasks, q, objectivesById]);

  const completedPreview = completedTasks.slice(0, 12);

  const completedObjectives = useMemo(() => {
    return objectives.filter((o) => o.status === "completed");
  }, [objectives]);

  const sections = useMemo(() => {
    if (sortMode !== "planned") return [{ title: "Tasks", data: activeTasks }];

    const buckets: Record<string, Task[]> = { Overdue: [], Today: [], Tomorrow: [], Upcoming: [], Later: [] };
    activeTasks.forEach((t) => buckets[smartBucket(t.deadline)].push(t));

    const order = ["Overdue", "Today", "Tomorrow", "Upcoming", "Later"];
    return order
      .map((k) => ({ 
        title: k, 
        data: openSections[k] ? buckets[k] : [],
        totalCount: buckets[k].length 
      }))
      .filter((s) => s.totalCount > 0);
  }, [activeTasks, sortMode, openSections]);

  const selectedTaskObjective = objectivesById.get(tObjectiveId)?.title ?? "Select objective";

  const sortLabel =
    sortMode === "my-day"
      ? "My Day"
      : sortMode === "important"
      ? "Important"
      : sortMode === "planned"
      ? "Planned"
      : "Tasks";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      {/* HEADER */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: s(12) }}>
        <View style={styles.rowBetween}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: s(40) }}>
            {mode === "tasks" ? "Tasks" : "Objectives"}
          </Text>

          {mode === "tasks" ? (
            <View style={{ flexDirection: "row", gap: s(10) }}>
              <Pressable
                onPress={() => setSortSheetOpen(true)}
                style={({ pressed }) => [
                  styles.headerPill,
                  {
                    borderColor: colors.border,
                    backgroundColor: "rgba(0,0,0,0.18)",
                    opacity: pressed ? 0.9 : 1,
                    borderRadius: radius.xl,
                  },
                ]}
              >
                <Ionicons name="swap-vertical" size={s(16)} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: s(14) }}>{sortLabel}</Text>
              </Pressable>

              <Pressable
                onPress={openTaskDetailsFromQuick}
                style={({ pressed }) => [
                  styles.fabMini,
                  {
                    backgroundColor: colors.accent,
                    borderColor: colors.border,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Ionicons name="add" size={s(22)} color={colors.bg} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={openCreateObjective}
              style={({ pressed }) => [
                styles.fabMini,
                {
                  backgroundColor: colors.accent,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Ionicons name="add" size={s(22)} color={colors.bg} />
            </Pressable>
          )}
        </View>

        <SegmentedControl
          items={[
            { key: "tasks", label: "Tasks" },
            { key: "objectives", label: "Objectives" },
          ]}
          value={mode}
          onChange={(v) => {
            setMode(v);
            setCompletedOpen(false);
          }}
        />

        {/* Search */}
        <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.surface2, borderRadius: radius.xl }]}>
          <Ionicons name="search" size={s(18)} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={mode === "tasks" ? "Search tasks, notes, objectives…" : "Search objectives…"}
            placeholderTextColor={colors.muted}
            style={{
              flex: 1,
              color: colors.text,
              fontWeight: "800",
              paddingVertical: Platform.OS === "ios" ? s(10) : s(8),
            }}
            autoCorrect={false}
          />
          {!!query && (
            <Pressable onPress={() => setQuery("")} style={({ pressed }) => [{ padding: s(6), opacity: pressed ? 0.8 : 1 }]}>
              <Ionicons name="close-circle" size={s(18)} color={colors.muted} />
            </Pressable>
          )}
        </View>

        
      </View>

      {/* CONTENT */}
      {mode === "tasks" ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: s(120), gap: s(10) }}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => {
            const isPlannedMode = sortMode === "planned";
            const sectionOpen = openSections[section.title] ?? true;
            const count = (section as any).totalCount ?? section.data.length;
            
            if (!isPlannedMode) {
              return (
                <View style={{ marginTop: s(4), marginBottom: s(6), flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={[styles.sectionPill, { borderColor: colors.border, borderRadius: s(999), backgroundColor: "rgba(0,0,0,0.18)" }]}>
                    <Text style={{ color: colors.text, fontWeight: "900" }}>{section.title}</Text>
                    <Text style={{ color: colors.muted, fontWeight: "900" }}>{count}</Text>
                  </View>
                </View>
              );
            }

            return (
              <Pressable
                onPress={() => {
                  setOpenSections(prev => ({ ...prev, [section.title]: !prev[section.title] }));
                }}
                style={({ pressed }) => [
                  {
                    marginTop: s(4),
                    marginBottom: s(6),
                    opacity: pressed ? 0.9 : 1,
                  }
                ]}
              >
                <View style={[styles.sectionPill, { borderColor: colors.border, borderRadius: s(999), backgroundColor: "rgba(0,0,0,0.18)" }]}>
                  <Text style={{ color: colors.text, fontWeight: "900" }}>{section.title}</Text>
                  <Text style={{ color: colors.muted, fontWeight: "900" }}>{count}</Text>
                  <Ionicons 
                    name={sectionOpen ? "chevron-up" : "chevron-down"} 
                    size={s(16)} 
                    color={colors.text} 
                  />
                </View>
              </Pressable>
            );
          }}
          renderItem={({ item }) => {
            const objTitle = objectivesById.get(item.objectiveId)?.title;

            const dueLabel = !item.deadline
              ? "No date"
              : isToday(item.deadline)
              ? "Today"
              : isOverdue(item.deadline)
              ? `Overdue • ${fmtShortDay(item.deadline)}`
              : fmtShortDay(item.deadline);

            const dueTone: "danger" | "today" | "neutral" =
              isOverdue(item.deadline) ? "danger" : isToday(item.deadline) ? "today" : "neutral";

            return (
              <TaskRow
                t={item}
                objTitle={objTitle}
                dueLabel={dueLabel}
                dueTone={dueTone}
                colors={colors}
                radius={radius}
                onToggleDone={toggleCompleteTask}
                onEdit={openEditTask}
                onToggleStar={toggleStarTask}
                onDelete={async (id) => {
                  if (saving) return;
                  setSaving(true);
                  try {
                    await deleteTask(id);
                    await refresh();
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            );
          }}
          ListFooterComponent={
            <View style={{ marginTop: s(14), gap: s(10) }}>
              {completedTasks.length > 0 && sortMode === "tasks" && (
                <View style={{ gap: s(10) }}>
                  <Pressable
                    onPress={() => setCompletedOpen((v) => !v)}
                    style={({ pressed }) => [
                      {
                        borderRadius: radius.xl,
                        borderWidth: s(1),
                        borderColor: colors.border,
                        backgroundColor: colors.surface2,
                        padding: s(12),
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}>
                      <Ionicons name="checkmark-circle" size={s(18)} color={colors.muted} />
                      <Text style={{ color: colors.text, fontWeight: "900" }}>Completed</Text>
                      <Text style={{ color: colors.muted, fontWeight: "900" }}>{completedTasks.length}</Text>
                    </View>
                    <Ionicons name={completedOpen ? "chevron-up" : "chevron-down"} size={s(18)} color={colors.text} />
                  </Pressable>

                  {completedOpen && (
                    <View style={{ gap: s(10) }}>
                      {(completedTasks.length > 60 ? completedPreview : completedTasks).map((t) => {
                        const objTitle = objectivesById.get(t.objectiveId)?.title ?? "Objective";
                        return (
                          <View
                            key={t.id}
                            style={{
                              borderRadius: radius.xl,
                              borderWidth: s(1),
                              borderColor: colors.border,
                              backgroundColor: colors.surface2,
                              padding: s(12),
                              flexDirection: "row",
                              alignItems: "center",
                              gap: s(10),
                            }}
                          >
                            <Ionicons name="checkmark-circle" size={s(18)} color={colors.muted} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: colors.muted, fontWeight: "900" }} numberOfLines={1}>
                                {t.title}
                              </Text>
                              <Text
                                style={{ color: colors.muted, fontWeight: "800", fontSize: s(12), marginTop: s(2) }}
                                numberOfLines={1}
                              >
                                {objTitle}
                              </Text>
                            </View>
                            <Pressable
                              onPress={async () => {
                                if (saving) return;
                                setSaving(true);
                                try {
                                  await updateTask(t.id, { status: "not-started", completedAt: null });
                                  await refresh();
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              style={({ pressed }) => [{ padding: s(8), opacity: pressed ? 0.85 : 1 }]}
                            >
                              <Text style={{ color: colors.text, fontWeight: "900", fontSize: s(12) }}>Undo</Text>
                            </Pressable>
                          </View>
                        );
                      })}

                      {completedTasks.length > 60 && (
                        <Text style={{ color: colors.muted, fontWeight: "800", lineHeight: s(18) }}>
                          Showing 12 of {completedTasks.length}. Search to find older completed tasks.
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}

              <View style={{ height: s(12) }} />
            </View>
          }
        />
      ) : (
        <SectionList
          sections={[{ title: "Objectives", data: objectives.filter((o) => o.status !== "completed") }]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: s(120), gap: spacing.md }}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: o }) => {
            const p = objectiveProgress(o.id);
            const miscLocked = o.title.trim().toLowerCase() === "miscellaneous";

            return (
              <View
                style={{
                  borderRadius: radius.xl,
                  borderWidth: s(1),
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  padding: s(14),
                  gap: s(10),
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s(10) }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}>{o.title}</Text>

                    {!!o.description && (
                      <Text style={{ color: colors.muted, fontWeight: "700", marginTop: s(6), lineHeight: s(18) }}>
                        {o.description}
                      </Text>
                    )}

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(10), marginTop: s(10) }}>
                      <View style={metaPill(colors, radius)}>
                        <Ionicons name="pricetag-outline" size={s(14)} color={colors.muted} />
                        <Text style={metaText(colors)}>{o.category}</Text>
                      </View>

                      <View style={metaPill(colors, radius)}>
                        <View
                          style={{
                            width: s(12),
                            height: s(12),
                            borderRadius: s(6),
                            backgroundColor: OBJECTIVE_COLORS.find((x) => x.value === o.color)?.hex ?? "#3b82f6",
                          }}
                        />
                        <Text style={metaText(colors)}>{OBJECTIVE_COLORS.find((x) => x.value === o.color)?.label ?? "Blue"}</Text>
                      </View>

                      <View style={metaPill(colors, radius)}>
                        <Ionicons name="analytics-outline" size={s(14)} color={colors.muted} />
                        <Text style={metaText(colors)}>
                          {p.pct}% ({p.done}/{p.total})
                        </Text>
                      </View>

                      <View style={metaPill(colors, radius)}>
                        <Ionicons name="calendar-outline" size={s(14)} color={colors.muted} />
                        <Text style={metaText(colors)}>{o.deadline ? fmtShortDay(o.deadline) : "No date"}</Text>
                      </View>
                    </View>

                    <View
                      style={{
                        marginTop: s(12),
                        height: s(10),
                        borderRadius: s(999),
                        backgroundColor: colors.surface2,
                        borderWidth: s(1),
                        borderColor: colors.border,
                        overflow: "hidden",
                      }}
                    >
                      <View style={{ height: "100%", width: `${p.pct}%`, backgroundColor: colors.accent }} />
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: s(4) }}>
                    <Pressable
                      onPress={() => openEditObjective(o)}
                      style={({ pressed }) => [{ padding: s(6), opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Ionicons name="create-outline" size={s(18)} color={colors.muted} />
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        if (miscLocked || saving) return;
                        setSaving(true);
                        try {
                          await deleteObjective(o.id);
                          await refresh();
                        } finally {
                          setSaving(false);
                        }
                      }}
                      style={({ pressed }) => [{ padding: s(6), opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Ionicons name="trash-outline" size={s(18)} color={miscLocked ? "rgba(255,255,255,0.25)" : colors.muted} />
                    </Pressable>
                  </View>
                </View>

                {!miscLocked && (
                  <View style={{ gap: s(8) }}>
                    {p.total > 0 && p.done < p.total && (
                      <View
                        style={{
                          height: s(46),
                          borderRadius: radius.xl,
                          borderWidth: s(1),
                          borderColor: "rgba(255,255,255,0.2)",
                          backgroundColor: "rgba(255,255,255,0.08)",
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: s(8),
                        }}
                      >
                        <Ionicons name="lock-closed" size={s(18)} color={colors.muted} />
                        <Text style={{ fontWeight: "900", color: colors.muted }}>Complete all tasks ({p.done}/{p.total})</Text>
                      </View>
                    )}
                    <Pressable
                      onPress={async () => {
                        if (saving) return;
                        setSaving(true);
                        try {
                          await setObjectiveCompleted(o.id, true);
                          await refresh();
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={p.total > 0 && p.done < p.total}
                      style={({ pressed }) => [
                        {
                          height: s(46),
                          borderRadius: radius.xl,
                          borderWidth: s(1),
                          borderColor: colors.border,
                          backgroundColor: p.total > 0 && p.done < p.total ? "rgba(255,255,255,0.08)" : colors.accent,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: s(8),
                          opacity: p.total > 0 && p.done < p.total ? 0.5 : pressed ? 0.88 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="checkmark" size={s(18)} color={p.total > 0 && p.done < p.total ? colors.muted : colors.bg} />
                      <Text style={{ fontWeight: "900", color: p.total > 0 && p.done < p.total ? colors.muted : colors.bg }}>
                        {p.total === 0 ? "Mark completed" : p.done === p.total ? "Mark completed" : "Locked"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
          ListFooterComponent={
            <View style={{ gap: s(10) }}>
              {completedObjectives.length > 0 && (
                <View style={{ gap: s(10) }}>
                  <Pressable
                    onPress={() => setCompletedObjectivesOpen((v) => !v)}
                    style={({ pressed }) => [
                      {
                        borderRadius: radius.xl,
                        borderWidth: s(1),
                        borderColor: colors.border,
                        backgroundColor: colors.surface2,
                        padding: s(12),
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}>
                      <Ionicons name="checkmark-circle" size={s(18)} color={colors.muted} />
                      <Text style={{ color: colors.text, fontWeight: "900" }}>Completed</Text>
                      <Text style={{ color: colors.muted, fontWeight: "900" }}>{completedObjectives.length}</Text>
                    </View>
                    <Ionicons name={completedObjectivesOpen ? "chevron-up" : "chevron-down"} size={s(18)} color={colors.text} />
                  </Pressable>

                  {completedObjectivesOpen && (
                    <View style={{ gap: s(10) }}>
                      {completedObjectives.map((o) => {
                        const p = objectiveProgress(o.id);
                        return (
                          <View
                            key={o.id}
                            style={{
                              borderRadius: radius.xl,
                              borderWidth: s(1),
                              borderColor: colors.border,
                              backgroundColor: colors.surface2,
                              padding: s(12),
                              gap: s(10),
                            }}
                          >
                            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s(10) }}>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.muted, fontWeight: "900" }}>{o.title}</Text>
                                {!!o.description && (
                                  <Text style={{ color: colors.muted, fontWeight: "700", fontSize: s(12), marginTop: s(4) }}>
                                    {o.description}
                                  </Text>
                                )}
                              </View>
                              <Ionicons name="checkmark-circle" size={s(18)} color={colors.muted} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
              <View style={{ height: s(12) }} />
            </View>
          }
        />
      )}

      {/* SORT SHEET */}
      <BottomSheet visible={sortSheetOpen} onClose={closeAllSheets}>
        <View style={styles.sheetHeader}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}>Sort tasks</Text>
          <Pressable onPress={closeAllSheets} style={({ pressed }) => [{ padding: s(8), opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="close" size={s(20)} color={colors.text} />
          </Pressable>
        </View>

        {([
          { k: "my-day", label: "My Day" },
          { k: "important", label: "Important" },
          { k: "planned", label: "Planned" },
          { k: "tasks", label: "Tasks" },
        ] as const).map((x) => {
          const active = sortMode === x.k;
          return (
            <Pressable
              key={x.k}
              onPress={() => {
                setSortMode(x.k);
                closeAllSheets();
              }}
              style={({ pressed }) => [
                {
                  marginTop: s(10),
                  padding: s(12),
                  borderRadius: radius.xl,
                  borderWidth: s(1),
                  borderColor: colors.border,
                  backgroundColor: active ? "rgba(255,255,255,0.14)" : colors.surface2,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>{x.label}</Text>
              {active ? <Ionicons name="checkmark" size={s(18)} color={colors.text} /> : null}
            </Pressable>
          );
        })}

        <View style={{ height: s(12) }} />
      </BottomSheet>

      {/* TASK DETAILS SHEET */}
      <BottomSheet visible={detailsOpen} onClose={closeAllSheets}>
        <View style={styles.sheetHeader}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}>{editingTaskId ? "Edit task" : "Task details"}</Text>
          <Pressable onPress={closeAllSheets} style={({ pressed }) => [{ padding: s(8), opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="close" size={s(20)} color={colors.text} />
          </Pressable>
        </View>

        <View style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12) }}>Title</Text>
          <View style={inputWrap(colors, radius)}>
            <TextInput
              value={tTitle}
              onChangeText={setTTitle}
              placeholder="Task title"
              placeholderTextColor={colors.muted}
              style={input(colors)}
            />
          </View>
        </View>

        <View style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12) }}>Notes (optional)</Text>
          <View style={inputWrap(colors, radius)}>
            <TextInput
              value={tDesc}
              onChangeText={setTDesc}
              placeholder="Notes"
              placeholderTextColor={colors.muted}
              style={[input(colors), { height: s(86), textAlignVertical: "top" }]}
              multiline
              blurOnSubmit={true}
              returnKeyType="done"
            />
          </View>
        </View>

        <View style={{ marginTop: spacing.md, flexDirection: "row", gap: s(10) }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12) }}>Objective</Text>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                setTaskObjectiveOpen(!taskObjectiveOpen);
              }}
              style={({ pressed }) => [field(colors, radius), { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                {selectedTaskObjective}
              </Text>
              <Ionicons name={taskObjectiveOpen ? "chevron-up" : "chevron-down"} size={s(18)} color={colors.text} />
            </Pressable>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12) }}>Date</Text>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                setTaskDateOpen(!taskDateOpen);
              }}
              style={({ pressed }) => [field(colors, radius), { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>{tDeadline ? fmtShortDay(tDeadline) : "No date"}</Text>
              <Ionicons name={taskDateOpen ? "chevron-up" : "chevron-down"} size={s(18)} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Inline Objective Picker */}
        {taskObjectiveOpen && (
          <View style={{ marginTop: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface2, borderWidth: s(1), borderColor: colors.border, overflow: "hidden", maxHeight: s(200) }}>
            <ScrollView>
              {objectiveOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    setTObjectiveId(opt.value);
                    setTaskObjectiveOpen(false);
                  }}
                  style={({ pressed }) => ({
                    padding: s(12),
                    borderBottomWidth: s(1),
                    borderBottomColor: colors.border,
                    backgroundColor: pressed ? colors.card2 : "transparent",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <Ionicons name={opt.icon} size={s(16)} color={colors.muted} />
                    <Text style={{ color: colors.text, fontWeight: opt.value === tObjectiveId ? "900" : "600", fontSize: s(14), marginLeft: s(8) }} numberOfLines={1}>
                      {opt.label}
                    </Text>
                  </View>
                  {opt.value === tObjectiveId && <Ionicons name="checkmark" size={s(20)} color={colors.accent} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <Pressable
          onPress={saveTask}
          disabled={saving}
          style={({ pressed }) => [
            {
              marginTop: spacing.lg,
              height: s(52),
              borderRadius: radius.xl,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: s(10),
              opacity: saving ? 0.55 : pressed ? 0.9 : 1,
            },
          ]}
        >
          <Ionicons name="save-outline" size={s(20)} color={colors.bg} />
          <Text style={{ color: colors.bg, fontWeight: "900", fontSize: s(15) }}>
            {editingTaskId ? "Save changes" : "Create task"}
          </Text>
        </Pressable>

        {editingTaskId && (
          <Pressable
            onPress={async () => {
              if (!editingTaskId || saving) return;
              setSaving(true);
              try {
                await deleteTask(editingTaskId);
                closeAllSheets();
                setEditingTaskId(null);
                await refresh();
              } finally {
                setSaving(false);
              }
            }}
            style={({ pressed }) => [
              {
                marginTop: s(10),
                height: s(48),
                borderRadius: radius.xl,
                borderWidth: s(1),
                borderColor: colors.border,
                backgroundColor: colors.surface2,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: s(10),
                opacity: saving ? 0.55 : pressed ? 0.9 : 1,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={s(18)} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: "900" }}>Delete task</Text>
          </Pressable>
        )}

        <View style={{ height: s(12) }} />

        {/* Date picker overlay - inside the same modal */}
        {taskDateOpen && (
          <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}>
            <Pressable 
              style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.35)" }]} 
              onPress={() => setTaskDateOpen(false)}
            />
            <View style={{ position: "absolute", left: s(14), right: s(14), bottom: s(14) }}>
              <View
                style={{
                  borderRadius: s(18),
                  borderWidth: s(1),
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    paddingHorizontal: s(12),
                    paddingVertical: s(10),
                    borderBottomWidth: s(1),
                    borderBottomColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ flex: 1, color: colors.text, fontWeight: "900", fontSize: s(14) }}>Select date</Text>
                  <Pressable onPress={() => setTaskDateOpen(false)} hitSlop={s(10)} style={{ padding: s(6) }}>
                    <Ionicons name="close" size={s(18)} color={colors.muted} />
                  </Pressable>
                </View>
                <View style={{ padding: s(12) }}>
                  <MiniCalendar
                    theme={{ colors, radius }}
                    value={tDeadline || new Date().toISOString().split('T')[0]}
                    onChange={(date) => setTDeadline(date)}
                  />
                </View>
                <View
                  style={{
                    padding: s(12),
                    borderTopWidth: s(1),
                    borderTopColor: colors.border,
                    flexDirection: "row",
                    justifyContent: "flex-end",
                  }}
                >
                  <Pressable
                    onPress={() => setTaskDateOpen(false)}
                    style={{
                      paddingVertical: s(10),
                      paddingHorizontal: s(14),
                      borderRadius: s(12),
                      backgroundColor: colors.accent,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: s(13) }}>Done</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}
      </BottomSheet>

      {/* CREATE OBJECTIVE */}
      <BottomSheet visible={objSheetOpen} onClose={closeAllSheets}>
        <View style={styles.sheetHeader}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}>{editingObjectiveId ? "Edit objective" : "New objective"}</Text>
          <Pressable onPress={closeAllSheets} style={({ pressed }) => [{ padding: s(8), opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="close" size={s(20)} color={colors.text} />
          </Pressable>
        </View>

        <View style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12) }}>Title</Text>
          <View style={inputWrap(colors, radius)}>
            <TextInput
              value={oTitle}
              onChangeText={setOTitle}
              placeholder="Objective title"
              placeholderTextColor={colors.muted}
              style={input(colors)}
            />
          </View>
        </View>

        <View style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12) }}>Description (optional)</Text>
          <View style={inputWrap(colors, radius)}>
            <TextInput
              value={oDesc}
              onChangeText={setODesc}
              placeholder="What does success look like?"
              placeholderTextColor={colors.muted}
              style={[input(colors), { height: s(86), textAlignVertical: "top" }]}
              multiline
              blurOnSubmit={true}
              returnKeyType="done"
            />
          </View>
        </View>

        <View style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12) }}>Category</Text>
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setObjCategoryOpen(!objCategoryOpen);
            }}
            style={({ pressed }) => [field(colors, radius), { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>{oCategory}</Text>
            <Ionicons name={objCategoryOpen ? "chevron-up" : "chevron-down"} size={s(18)} color={colors.text} />
          </Pressable>
        </View>

        {/* Inline Category Picker */}
        {objCategoryOpen && (
          <View style={{ marginTop: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface2, borderWidth: s(1), borderColor: colors.border, overflow: "hidden", maxHeight: s(200) }}>
            <ScrollView>
              {categoryOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    setOCategory(opt.value);
                    setObjCategoryOpen(false);
                  }}
                  style={({ pressed }) => ({
                    padding: s(12),
                    borderBottomWidth: s(1),
                    borderBottomColor: colors.border,
                    backgroundColor: pressed ? colors.card2 : "transparent",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <Ionicons name={opt.icon} size={s(16)} color={colors.muted} />
                    <Text style={{ color: colors.text, fontWeight: opt.value === oCategory ? "900" : "600", fontSize: s(14), marginLeft: s(8) }} numberOfLines={1}>
                      {opt.label}
                    </Text>
                  </View>
                  {opt.value === oCategory && <Ionicons name="checkmark" size={s(20)} color={colors.accent} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12) }}>Color</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(10), marginTop: s(8) }}>
            {OBJECTIVE_COLORS.map((c) => {
              const isSelected = oColor === c.value;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => setOColor(c.value)}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: s(8),
                      paddingHorizontal: s(12),
                      borderRadius: s(999),
                      borderWidth: s(2),
                      borderColor: isSelected ? c.hex : colors.border,
                      backgroundColor: isSelected ? c.hex + "20" : colors.card2,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: s(16),
                      height: s(16),
                      borderRadius: s(8),
                      backgroundColor: c.hex,
                      marginRight: s(6),
                    }}
                  />
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: s(13) }}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12) }}>Deadline</Text>
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setObjDateOpen(!objDateOpen);
            }}
            style={({ pressed }) => [field(colors, radius), { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>{oDeadline ? fmtShortDay(oDeadline) : "No date"}</Text>
            <Ionicons name={objDateOpen ? "chevron-up" : "chevron-down"} size={s(18)} color={colors.text} />
          </Pressable>
        </View>

        <Pressable
          onPress={saveObjective}
          disabled={saving}
          style={({ pressed }) => [
            {
              marginTop: spacing.lg,
              height: s(52),
              borderRadius: radius.xl,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: s(10),
              opacity: saving ? 0.55 : pressed ? 0.9 : 1,
            },
          ]}
        >
          <Ionicons name={editingObjectiveId ? "save-outline" : "add"} size={s(20)} color={colors.bg} />
          <Text style={{ color: colors.bg, fontWeight: "900", fontSize: s(15) }}>
            {editingObjectiveId ? "Save changes" : "Create objective"}
          </Text>
        </Pressable>

        {editingObjectiveId && (
          <Pressable
            onPress={async () => {
              if (!editingObjectiveId || saving) return;
              setSaving(true);
              try {
                await deleteObjective(editingObjectiveId);
                closeAllSheets();
                setEditingObjectiveId(null);
                await refresh();
              } finally {
                setSaving(false);
              }
            }}
            style={({ pressed }) => [
              {
                marginTop: s(10),
                height: s(48),
                borderRadius: radius.xl,
                borderWidth: s(1),
                borderColor: colors.border,
                backgroundColor: colors.surface2,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: s(10),
                opacity: saving ? 0.55 : pressed ? 0.9 : 1,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={s(18)} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: "900" }}>Delete objective</Text>
          </Pressable>
        )}

        <View style={{ height: s(12) }} />

        {/* Date picker overlay - inside the same modal */}
        {objDateOpen && (
          <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}>
            <Pressable 
              style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.35)" }]} 
              onPress={() => setObjDateOpen(false)}
            />
            <View style={{ position: "absolute", left: s(14), right: s(14), bottom: s(14) }}>
              <View
                style={{
                  borderRadius: s(18),
                  borderWidth: s(1),
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    paddingHorizontal: s(12),
                    paddingVertical: s(10),
                    borderBottomWidth: s(1),
                    borderBottomColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ flex: 1, color: colors.text, fontWeight: "900", fontSize: s(14) }}>Select deadline</Text>
                  <Pressable onPress={() => setObjDateOpen(false)} hitSlop={s(10)} style={{ padding: s(6) }}>
                    <Ionicons name="close" size={s(18)} color={colors.muted} />
                  </Pressable>
                </View>
                <View style={{ padding: s(12) }}>
                  <MiniCalendar
                    theme={{ colors, radius }}
                    value={oDeadline || new Date().toISOString().split('T')[0]}
                    onChange={(date) => setODeadline(date)}
                  />
                </View>
                <View
                  style={{
                    padding: s(12),
                    borderTopWidth: s(1),
                    borderTopColor: colors.border,
                    flexDirection: "row",
                    justifyContent: "flex-end",
                  }}
                >
                  <Pressable
                    onPress={() => setObjDateOpen(false)}
                    style={{
                      paddingVertical: s(10),
                      paddingHorizontal: s(14),
                      borderRadius: s(12),
                      backgroundColor: colors.accent,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: s(13) }}>Done</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

// OverlayModal component (matches CreateSheet pattern)
function OverlayModal({
  visible,
  theme,
  title,
  onClose,
  children,
  footerRightLabel,
  onFooterRight,
}: {
  visible: boolean;
  theme: any;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footerRightLabel: string;
  onFooterRight: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.35)" }]} onPress={onClose} />

        <View style={{ position: "absolute", left: s(14), right: s(14), bottom: s(14) }}>
          <View
            style={{
              borderRadius: s(18),
              borderWidth: s(1),
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                paddingHorizontal: s(12),
                paddingVertical: s(10),
                borderBottomWidth: s(1),
                borderBottomColor: theme.colors.border,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text style={{ flex: 1, color: theme.colors.text, fontWeight: "900", fontSize: s(14) }}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={s(10)} style={{ padding: s(6) }}>
                <Ionicons name="close" size={s(18)} color={theme.colors.muted} />
              </Pressable>
            </View>

            <View style={{ padding: s(12) }}>{children}</View>

            <View
              style={{
                padding: s(12),
                borderTopWidth: s(1),
                borderTopColor: theme.colors.border,
                flexDirection: "row",
                justifyContent: "flex-end",
              }}
            >
              <Pressable
                onPress={onFooterRight}
                style={{
                  paddingVertical: s(10),
                  paddingHorizontal: s(14),
                  borderRadius: s(12),
                  backgroundColor: theme.colors.accent,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: s(13) }}>{footerRightLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// MiniCalendar component (matches CreateSheet pattern)
function MiniCalendar({ theme, value, onChange }: { theme: any; value: string; onChange: (date: string) => void }) {
  const pad2 = (n: number) => `${n < 10 ? "0" : ""}${n}`;
  
  const ymdParts = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
    return { y, m, d };
  };
  
  const toYMD = (y: number, m: number, d: number): string => {
    return `${y}-${pad2(m)}-${pad2(d)}`;
  };
  
  const daysInMonth = (y: number, m: number) => {
    return new Date(y, m, 0).getDate();
  };
  
  const weekdayOf = (y: number, m: number, d: number) => {
    return new Date(y, m - 1, d).getDay();
  };
  
  const addMonths = (y: number, m: number, delta: number) => {
    const dt = new Date(y, m - 1 + delta, 1);
    return { y: dt.getFullYear(), m: dt.getMonth() + 1 };
  };

  const { y, m, d } = ymdParts(value);
  const [curY, setCurY] = useState(y);
  const [curM, setCurM] = useState(m);

  useEffect(() => {
    setCurY(y);
    setCurM(m);
  }, [y, m]);

  const dim = daysInMonth(curY, curM);
  const firstW = weekdayOf(curY, curM, 1);
  const weeks: Array<Array<number | null>> = [];
  let week: Array<number | null> = [];

  for (let i = 0; i < firstW; i++) week.push(null);
  for (let day = 1; day <= dim; day++) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const monthLabel = new Date(curY, curM - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={() => {
            const next = addMonths(curY, curM, -1);
            setCurY(next.y);
            setCurM(next.m);
          }}
          style={{
            width: s(34),
            height: s(34),
            borderRadius: s(12),
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.card2,
            borderWidth: s(1),
            borderColor: theme.colors.border,
          }}
        >
          <Ionicons name="chevron-back" size={s(18)} color={theme.colors.text} />
        </Pressable>

        <Text style={{ flex: 1, textAlign: "center", color: theme.colors.text, fontWeight: "900" }}>{monthLabel}</Text>

        <Pressable
          onPress={() => {
            const next = addMonths(curY, curM, 1);
            setCurY(next.y);
            setCurM(next.m);
          }}
          style={{
            width: s(34),
            height: s(34),
            borderRadius: s(12),
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.card2,
            borderWidth: s(1),
            borderColor: theme.colors.border,
          }}
        >
          <Ionicons name="chevron-forward" size={s(18)} color={theme.colors.text} />
        </Pressable>
      </View>

      <View style={{ marginTop: s(10), flexDirection: "row" }}>
        {weekdays.map((w, idx) => (
          <Text
            key={idx}
            style={{
              flex: 1,
              textAlign: "center",
              color: theme.colors.muted,
              fontWeight: "900",
              fontSize: s(12),
            }}
          >
            {w}
          </Text>
        ))}
      </View>

      <View style={{ marginTop: s(8) }}>
        {weeks.map((wk, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: s(6) }}>
            {wk.map((day, j) => {
              const selected = day != null && curY === y && curM === m && day === d;
              return (
                <Pressable
                  key={`${i}-${j}`}
                  onPress={() => {
                    if (day == null) return;
                    onChange(toYMD(curY, curM, day));
                  }}
                  style={{
                    flex: 1,
                    height: s(36),
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: s(999),
                    backgroundColor: selected ? theme.colors.accent : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: selected ? "#fff" : theme.colors.text,
                      fontWeight: "900",
                      opacity: day == null ? 0 : 1,
                    }}
                  >
                    {day ?? ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s(12) },

  fabMini: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: s(1),
  },

  headerPill: {
    height: s(44),
    paddingHorizontal: s(12),
    borderWidth: s(1),
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
  },

  searchWrap: {
    borderWidth: s(1),
    paddingHorizontal: s(12),
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
  },

  quickAdd: {
    borderWidth: s(1),
    paddingHorizontal: s(12),
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
  },

  sectionPill: {
    paddingVertical: s(6),
    paddingHorizontal: s(10),
    borderWidth: s(1),
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
  },

  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s(10) },
});

function metaPill(colors: any, radius: any) {
  return {
    paddingVertical: s(6),
    paddingHorizontal: s(10),
    borderRadius: s(999),
    backgroundColor: "rgba(0,0,0,0.16)",
    borderWidth: s(1),
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    maxWidth: s(220),
  } as const;
}
function metaText(colors: any) {
  return { color: colors.muted, fontWeight: "900", fontSize: s(12) } as const;
}
function inputWrap(colors: any, radius: any) {
  return {
    marginTop: s(8),
    borderWidth: s(1),
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: radius.xl,
    paddingHorizontal: s(12),
  } as const;
}
function input(colors: any) {
  return {
    color: colors.text,
    paddingVertical: s(12),
    fontWeight: "800",
  } as const;
}
function field(colors: any, radius: any) {
  return {
    marginTop: s(8),
    borderWidth: s(1),
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: radius.xl,
    paddingHorizontal: s(12),
    paddingVertical: s(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: s(10),
  } as const;
}
