// screens/Dashboard/HomeScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Keyboard, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { quoteOfDay } from "../../src/data/quotes";
import { useTheme } from "../../src/components/theme/theme";
import { Card } from "../../src/components/ui/Card";
import { IconCircleButton } from "../../src/components/ui/IconCircleButton";
import { PrimaryButton } from "../../src/components/ui/PrimaryButton";
import { BottomSheet } from "../../src/components/ui/BottomSheet";
import { DatePickerSheet } from "../../src/components/ui/DatePickerSheet";
import { SelectSheet, SelectItem } from "../../src/components/ui/SelectSheet";
import { s } from "react-native-size-matters";
import {
  loadFocusMinutesToday,
  loadStreakDays,
  loadTasksCompletedDueToday,
  loadTasksDueToday,
  addTask,
  ensureDefaultObjective,
  loadObjectives,
  todayKey,
  loadSetupName,
} from "../../src/data/storage";
import type { Objective } from "../../src/data/models";

type SetupPayload = {
  name?: string;
  targetLevel?: "casual" | "regular" | "serious" | "determined";
  targetMinutesPerDay?: 30 | 60 | 120 | 180;
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function HomeScreen({ navigation, route }: any) {
  const { colors, radius, spacing } = useTheme();

  const [name, setName] = useState<string>("");
  const [focusedMinutesToday, setFocusedMinutesToday] = useState<number>(0);
  const [dayStreak, setDayStreak] = useState<number>(0);

  // These are still backed by AsyncStorage keys you already use.
  const [tasksDueToday, setTasksDueToday] = useState<number>(0);
  const [tasksDoneToday, setTasksDoneToday] = useState<number>(0);
  
  // Priority task preview
  const [nextTask, setNextTask] = useState<any>(null);

  // Task creation sheet state
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tObjectiveId, setTObjectiveId] = useState<string>("");
  const [tDeadline, setTDeadline] = useState<string | undefined>(undefined);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Sub-sheets
  const [taskObjectiveOpen, setTaskObjectiveOpen] = useState(false);
  const [taskDateOpen, setTaskDateOpen] = useState(false);

  const greeting = getGreeting();
  const quote = useMemo(() => quoteOfDay(), []);
  const progressPct = useMemo(() => {
    if (tasksDueToday <= 0) return tasksDoneToday > 0 ? 100 : 0;
    return clamp((tasksDoneToday / Math.max(tasksDueToday, 1)) * 100, 0, 100);
  }, [tasksDueToday, tasksDoneToday]);

  const selectedTaskObjective = useMemo(() => {
    const obj = objectives.find((o) => o.id === tObjectiveId);
    return obj?.title ?? "Select objective";
  }, [objectives, tObjectiveId]);

  function fmtShortDay(dateKey: string) {
    const d = new Date(dateKey + "T00:00:00");
    return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(d);
  }

  // Load initial setup data from route params
  useEffect(() => {
    (async () => {
      const setupFromRoute = route?.params?.setupData as SetupPayload | undefined;
      const routeName: string | undefined = setupFromRoute?.name;

      const storedName = await loadSetupName();

      const finalName = routeName || storedName || "";
      if (finalName) setName(finalName);
    })();
  }, [route?.params]);

  // Load dashboard data (focus minutes, streak, tasks)
  const loadData = async () => {
    const fm = await loadFocusMinutesToday();
    setFocusedMinutesToday(fm);

    const sd = await loadStreakDays();
    setDayStreak(sd);

    const due = await loadTasksDueToday();
    setTasksDueToday(due);

    const done = await loadTasksCompletedDueToday();
    setTasksDoneToday(done);

    const objs = await loadObjectives();
    setObjectives(objs);
    
    // Load priority task: 1) due today, 2) important (importance >= 3), 3) any task
    const { loadTasks } = require("../../src/data/storage");
    const allTasks = await loadTasks();
    const today = todayKey();
    
    // Filter not-started tasks
    const availableTasks = allTasks.filter((t: any) => t.status === "not-started");
    
    // Priority 1: Due today
    const todayTasks = availableTasks.filter((t: any) => t.deadline === today);
    
    if (todayTasks.length > 0) {
      setNextTask(todayTasks[0]);
    } else {
      // Priority 2: Important tasks
      const importantTasks = availableTasks.filter((t: any) => t.importance >= 3);
      
      if (importantTasks.length > 0) {
        setNextTask(importantTasks[0]);
      } else {
        // Priority 3: Any task
        setNextTask(availableTasks.length > 0 ? availableTasks[0] : null);
      }
    }
    
    // Set default objective if none selected
    if (!tObjectiveId && objs.length > 0) {
      const defaultObj = await ensureDefaultObjective();
      setTObjectiveId(defaultObj.id);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Parent stack routes
  const openSearch = () => {
    const parent = navigation.getParent?.();
    if (parent) parent.navigate("Search");
    else navigation.navigate("Search");
  };

  const openAddTask = async () => {
    // Reset form
    setTTitle("");
    setTDesc("");
    setTDeadline(undefined);
    
    // Ensure default objective is set
    if (!tObjectiveId) {
      const defaultObj = await ensureDefaultObjective();
      setTObjectiveId(defaultObj.id);
    }
    
    setAddTaskOpen(true);
  };

  const closeAllSheets = () => {
    setAddTaskOpen(false);
    setTaskObjectiveOpen(false);
    setTaskDateOpen(false);
  };

  const saveTask = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const title = tTitle.trim();
      if (title.length < 3) return;
      if (!tObjectiveId) return;

      await addTask({
        title,
        objectiveId: tObjectiveId,
        description: tDesc.trim() || undefined,
        deadline: tDeadline,
        importance: 2,
        status: "not-started",
      });

      closeAllSheets();
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const goTasksToday = () => navigation.navigate("TasksTab");
  const goFocus = () => navigation.navigate("FocusTab");

  const inputWrap = (colors: any, radius: any) => ({
    borderRadius: radius.lg,
    borderWidth: s(1),
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: s(14),
    paddingVertical: s(12),
  });

  const input = (colors: any) => ({
    color: colors.text,
    fontWeight: "900" as const,
    fontSize: s(14),
  });

  const field = (colors: any, radius: any) => ({
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    borderRadius: radius.lg,
    borderWidth: s(1),
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: s(14),
    paddingVertical: s(12),
    height: s(48),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: s(100),
          gap: spacing.md,
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Home</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {greeting}
              {name ? `, ${name}` : ""}.
            </Text>
          </View>

          <View style={styles.headerActions}>
            <IconCircleButton onPress={openSearch}>
              <Ionicons name="search" size={s(20)} color={colors.text} />
            </IconCircleButton>
            <IconCircleButton onPress={openAddTask}>
              <Ionicons name="add" size={s(22)} color={colors.text} />
            </IconCircleButton>
          </View>
        </View>

        {/* Hero: Today */}
        <Card style={{ padding: s(16) }}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={[styles.heroHeadline, { color: colors.text }]}>Today</Text>
            </View>

            <Pressable
              onPress={goFocus}
              style={({ pressed }) => [
                styles.miniPill,
                {
                  borderRadius: s(999),
                  borderColor: colors.border,
                  backgroundColor: colors.overlay,
                  opacity: pressed ? 0.86 : 1,
                },
              ]}
            >
              <Ionicons name="play" size={s(18)} color={colors.text} />
              <Text style={[styles.miniPillText, { color: colors.text }]}>Focus</Text>
            </Pressable>
          </View>

          <Text style={[styles.heroLine, { color: colors.muted }]}>
            "{quote.text}" — <Text style={{ fontStyle: "italic" }}>{quote.author}</Text>
          </Text>

          {/* KPIs */}
          <View style={{ flexDirection: "row", gap: s(10), marginTop: s(14) }}>
            <View
              style={[
                styles.kpiCard,
                {
                  borderRadius: radius.lg,
                  backgroundColor: colors.overlay,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.kpiLabel, { color: colors.muted }]}>STREAK</Text>
              <View style={styles.kpiValueRow}>
                <Text style={[styles.kpiValue, { color: colors.text }]}>{dayStreak}</Text>
                <View
                  style={[
                    styles.kpiIcon,
                    { borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.10)" },
                  ]}
                >
                  <Ionicons name="flame" size={s(20)} color="orange" />
                </View>
              </View>
            </View>

            <Pressable
              onPress={goFocus}
              style={({ pressed }) => [
                styles.kpiCard,
                {
                  borderRadius: radius.lg,
                  backgroundColor: colors.overlay,
                  borderColor: colors.border,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Text style={[styles.kpiLabel, { color: colors.muted }]}>FOCUSED</Text>
              <View style={styles.kpiValueRow}>
                <Text style={[styles.kpiValue, { color: colors.text }]}>{focusedMinutesToday} min</Text>
                <View
                  style={[
                    styles.kpiIcon,
                    { borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.10)" },
                  ]}
                >
                  <Ionicons name="timer" size={s(20)} color={colors.text} />
                </View>
              </View>
            </Pressable>
          </View>

          {/* Primary action */}
          <PrimaryButton
            title="Start Focus"
            onPress={goFocus}
            leftIcon={<Ionicons name="flash" size={s(18)} color={colors.bg} />}
            style={{ marginTop: s(14), borderRadius: radius.xl }}
          />
        </Card>

        {/* Priority Task */}
        <Card style={{ padding: s(16), backgroundColor: colors.card }}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Priority Focus</Text>
              <Text style={[styles.sectionSub, { color: colors.muted }]}>Your most important task</Text>
            </View>
            <Pressable onPress={goTasksToday}>
              <Text style={[styles.viewAllLink, { color: colors.accent }]}>View all</Text>
            </Pressable>
          </View>

          {nextTask ? (
            <Pressable
              onPress={goTasksToday}
              style={({ pressed }) => [
                styles.priorityTaskCard,
                {
                  borderRadius: radius.lg,
                  borderColor: colors.border,
                  backgroundColor: colors.overlay,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <View style={styles.taskCheckbox}>
                <View style={[styles.checkbox, { borderColor: colors.accent }]} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: s(6), flexWrap: "wrap", marginBottom: s(4) }}>
                  <Text style={[styles.priorityTaskTitle, { color: colors.text }]}>
                    {nextTask.title}
                  </Text>
                  {nextTask.deadline === todayKey() && (
                    <View style={[styles.taskBadge, { backgroundColor: colors.accent + "20" }]}>
                      <Ionicons name="calendar" size={s(10)} color={colors.accent} />
                      <Text style={[styles.badgeText, { color: colors.accent }]}>Due today</Text>
                    </View>
                  )}
                  {nextTask.importance >= 3 && nextTask.deadline !== todayKey() && (
                    <View style={[styles.taskBadge, { backgroundColor: "#F59E0B20" }]}>
                      <Ionicons name="flag" size={s(10)} color="#F59E0B" />
                      <Text style={[styles.badgeText, { color: "#F59E0B" }]}>Important</Text>
                    </View>
                  )}
                </View>
                {nextTask.description && (
                  <Text style={[styles.priorityTaskDesc, { color: colors.muted }]} numberOfLines={2}>
                    {nextTask.description}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={s(20)} color={colors.muted} />
            </Pressable>
          ) : (
            <Pressable
              onPress={openAddTask}
              style={({ pressed }) => [
                styles.priorityTaskCard,
                styles.emptyTaskCard,
                {
                  borderRadius: radius.lg,
                  borderColor: colors.border,
                  backgroundColor: colors.overlay,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <View style={[styles.emptyTaskIcon, { backgroundColor: colors.accent + "20" }]}>
                <Ionicons name="add" size={s(24)} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.priorityTaskTitle, { color: colors.text }]}>Add your first task</Text>
                <Text style={[styles.priorityTaskDesc, { color: colors.muted }]}>
                  Create momentum for today
                </Text>
              </View>
            </Pressable>
          )}
        </Card>

        {/* Today progress: tap-through */}
        <Pressable
          onPress={goTasksToday}
          style={({ pressed }) => [
            styles.progressShell,
            {
              borderRadius: radius.xl,
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={styles.progressTop}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}>
              <View
                style={[
                  styles.progressIcon,
                  { borderColor: colors.border, backgroundColor: colors.overlay },
                ]}
              >
                <Ionicons name="checkbox-outline" size={s(18)} color={colors.text} />
              </View>
              <View>
                <Text style={[styles.progressTitle, { color: colors.text }]}>Today progress</Text>
                <Text style={[styles.progressSub, { color: colors.muted }]}>
                  {tasksDoneToday} done • {tasksDueToday} due today
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={s(18)} color={colors.text} />
          </View>

          <View
            style={[
              styles.track,
              { borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.10)" },
            ]}
          >
            <View style={{ width: `${progressPct}%`, height: "100%", backgroundColor: colors.accent }} />
          </View>
        </Pressable>

      </ScrollView>

      {/* ADD TASK SHEET */}
      <BottomSheet visible={addTaskOpen} onClose={closeAllSheets}>
        <View style={styles.sheetHeader}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}>Add task</Text>
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
              autoFocus
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
              {objectives
                .filter((obj) => obj.status !== "completed")
                .map((obj) => (
                <Pressable
                  key={obj.id}
                  onPress={() => {
                    setTObjectiveId(obj.id);
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
                    <Ionicons name="flag-outline" size={s(16)} color={colors.muted} />
                    <Text style={{ color: colors.text, fontWeight: obj.id === tObjectiveId ? "900" : "600", fontSize: s(14), marginLeft: s(8) }} numberOfLines={1}>
                      {obj.title}
                    </Text>
                  </View>
                  {obj.id === tObjectiveId && <Ionicons name="checkmark" size={s(20)} color={colors.accent} />}
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
          <Text style={{ color: colors.bg, fontWeight: "900", fontSize: s(15) }}>Create task</Text>
        </Pressable>

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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerActions: { flexDirection: "row", gap: s(10) },

  title: { fontSize: s(30), fontWeight: "700" },
  subtitle: { marginTop: s(4), fontSize: s(13), fontWeight: "800" },

  heroTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s(12) },
  heroHeadline: { fontSize: s(30), fontWeight: "700" },
  heroLine: { marginTop: s(10), fontSize: s(17), fontWeight: "500", lineHeight: s(18) },

  miniPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    paddingVertical: s(8),
    paddingHorizontal: s(10),
    borderWidth: s(1),
  },
  miniPillText: { fontWeight: "700", fontSize: s(14) },

  kpiCard: { flex: 1, padding: s(10), borderWidth: s(1) },
  kpiLabel: { fontSize: s(12), fontWeight: "700", letterSpacing: s(0.3) },
  kpiValueRow: { marginTop: s(8), flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kpiValue: { fontSize: s(22), fontWeight: "600" },
  kpiIcon: {
    width: s(35),
    height: s(35),
    borderRadius: s(20),
    borderWidth: s(1),
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeader: { 
    flexDirection: "row", 
    alignItems: "flex-start", 
    justifyContent: "space-between",
    marginBottom: s(12),
  },
  sectionTitle: { fontSize: s(20), fontWeight: "700" },
  sectionSub: { marginTop: s(3), fontSize: s(12), fontWeight: "600" },
  viewAllLink: { fontSize: s(13), fontWeight: "700", marginTop: s(2) },

  priorityTaskCard: {
    padding: s(14),
    borderWidth: s(1),
    flexDirection: "row",
    alignItems: "center",
    gap: s(12),
  },
  emptyTaskCard: {
    borderStyle: "dashed",
  },
  taskCheckbox: {
    width: s(40),
    height: s(40),
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    width: s(22),
    height: s(22),
    borderRadius: s(11),
    borderWidth: s(2),
  },
  emptyTaskIcon: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    alignItems: "center",
    justifyContent: "center",
  },
  priorityTaskTitle: { fontSize: s(16), fontWeight: "700" },
  priorityTaskDesc: { fontSize: s(13), fontWeight: "500", lineHeight: s(18) },
  taskBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(3),
    paddingHorizontal: s(6),
    paddingVertical: s(3),
    borderRadius: s(6),
  },
  badgeText: {
    fontSize: s(10),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: s(0.5),
  },

  progressShell: { borderWidth: s(1), padding: s(16) },
  progressTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressIcon: {
    width: s(38),
    height: s(38),
    borderRadius: s(19),
    borderWidth: s(1),
    alignItems: "center",
    justifyContent: "center",
  },
  progressTitle: { fontSize: s(17), fontWeight: "700" },
  progressSub: { marginTop: s(3), fontSize: s(12), fontWeight: "600" },
  track: {
    marginTop: s(12),
    height: s(10),
    borderRadius: s(999),
    borderWidth: s(1),
    overflow: "hidden",
  },

  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
