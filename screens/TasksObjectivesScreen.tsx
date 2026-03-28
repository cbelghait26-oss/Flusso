// TasksObjectivesScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import { useAudioPlayer } from "expo-audio";
import { s } from "../src/ui/ts";
import { useAchievements } from "../src/context/AchievementContext";
import { useTheme } from "../src/components/theme/theme";
import { SegmentedControl } from "../src/components/ui/SegmentedControl";
import { BottomSheet } from "../src/components/ui/BottomSheet";
import { useDeviceClass, WIDE_MAX_WIDTH } from "../src/ui/responsive";

import type {
  Objective,
  ObjectiveCategory,
  Task,
  TrainingPlan,
  Habit,
} from "../src/data/models";

const OBJECTIVE_CATEGORIES: ObjectiveCategory[] = [
  "Academic",
  "Career",
  "Personal",
  "Health & Fitness",
  "Skill Development",
  "Creative",
  "Misc",
];
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
  STORAGE_MODULE_ID,
  getCurrentUser,
  loadTrainingPlans,
  addTrainingPlan,
  updateTrainingPlan,
  deleteTrainingPlan,
  replacePlanTasks,
  loadHabits,
  addHabit,
  updateHabit,
  deleteHabit,
  getNextHabitOccurrence,
} from "../src/data/storage";
import { generatePlanTasks } from "../src/services/TrainingPlanGenerator";
import { TrainingPlanWizard } from "../src/components/ui/TrainingPlanWizard";
import { rescheduleAllNotifications } from "../src/services/notifications";
import { ObjectiveTutorial } from "../src/components/ui/ObjectiveTutorial";
import { loadTutorialSeen, saveTutorialSeen } from "../src/data/storage";
import {
  getFriends,
  createSharedObjective,
  getMySharedObjectives,
  voteCompleteSharedObjective,
  kickMemberFromObjective,
  setHideObjectiveMembers,
  leaveSharedObjective,
  updateSharedObjective,
  type UserProfile,
  type SharedObjective,
} from "../src/services/SocialService";
import { auth } from "../src/services/firebase";

type Mode = "tasks" | "objectives";
type SortMode = "my-day" | "important" | "objectives" | "planned";

const CATEGORIES: Objective["category"][] = [
  "Academic",
  "Career",
  "Personal",
  "Health & Fitness",
  "Skill Development",
  "Creative",
  "Misc",
];

const OBJECTIVE_COLORS: Array<{
  value: Objective["color"];
  label: string;
  hex: string;
}> = [
  { value: "blue", label: "Blue", hex: "#007AFF" },
  { value: "teal", label: "Teal", hex: "#21afa1" },
  { value: "green", label: "Green", hex: "#34C759" },
  { value: "yellow", label: "Yellow", hex: "#FFCC00" },
  { value: "orange", label: "Orange", hex: "#FF9500" },
  { value: "red", label: "Red", hex: "#FF3B30" },
  { value: "gray", label: "Gray", hex: "#8E8E93" },
  { value: "purple", label: "Purple", hex: "#AF52DE" },
];

const IMPORTANCE: Array<{
  v: Task["importance"];
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { v: 1, label: "Low", icon: "leaf-outline" },
  { v: 2, label: "Medium", icon: "speedometer-outline" },
  { v: 3, label: "High", icon: "flame-outline" },
  { v: 4, label: "Critical", icon: "warning-outline" },
];

function fmtShortDay(dateKey: string) {
  const d = new Date(dateKey + "T00:00:00");
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
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
  objColor?: string;
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
  const {
    t,
    objTitle,
    objColor,
    dueLabel,
    dueTone,
    colors,
    radius,
    onToggleDone,
    onEdit,
    onDelete,
    onToggleStar,
  } = props;

  const [completing, setCompleting] = useState(false);
  const scaleAnim = useState(new Animated.Value(1))[0];
  const opacityAnim = useState(new Animated.Value(1))[0];
  const cuePlayer = useAudioPlayer(require("../assets/Completed.mp3"));

  const handleComplete = async () => {
    if (completing) return;
    setCompleting(true);
    try {
      cuePlayer.seekTo(0);
      cuePlayer.volume = 0.7;
      cuePlayer.play();
    } catch {}

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
        { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <View
        style={{ flexDirection: "row", alignItems: "flex-start", gap: s(12) }}
      >
        <Pressable
          onPress={handleComplete}
          disabled={completing}
          style={({ pressed }) => [
            {
              width: s(26),
              height: s(26),
              borderRadius: s(13),
              borderWidth: s(2),
              borderColor: completing ? "#4CAF50" : (objColor ?? colors.border),
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

        <Pressable
          onPress={() => onEdit(t)}
          style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.92 : 1 }]}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
          >
            <Text
              style={{
                color: colors.text,
                fontWeight: "600",
                fontSize: s(15),
                flex: 1,
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {t.title}
            </Text>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onEdit(t);
              }}
              style={({ pressed }) => [
                { padding: s(4), opacity: pressed ? 0.8 : 1 },
              ]}
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
              style={({ pressed }) => [
                { padding: s(4), opacity: pressed ? 0.8 : 1 },
              ]}
              hitSlop={s(8)}
            >
              <Ionicons
                name={isStarred ? "star" : "star-outline"}
                size={s(18)}
                color={isStarred ? "#FFD700" : colors.muted}
              />
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "nowrap",
              alignItems: "center",
              gap: s(6),
              marginTop: s(5),
            }}
          >
            <View
              style={[metaPill(colors, radius), { flexShrink: 1, minWidth: 0 }]}
            >
              <Ionicons
                name="bookmark-outline"
                size={s(12)}
                color={colors.muted}
              />
              <Text
                style={metaText(colors)}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {objTitle ?? "Objective"}
              </Text>
            </View>

            <View
              style={{
                paddingVertical: s(4),
                paddingHorizontal: s(8),
                borderRadius: s(999),
                backgroundColor: dueBg,
                borderWidth: s(1),
                borderColor: dueBd,
                flexDirection: "row",
                alignItems: "center",
                gap: s(6),
                flexShrink: 0,
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={s(12)}
                color={colors.muted}
              />
              <Text style={metaText(colors)} numberOfLines={1}>
                {dueLabel}
              </Text>
            </View>

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onDelete(t.id);
              }}
              style={({ pressed }) => [
                {
                  paddingVertical: s(4),
                  paddingHorizontal: s(8),
                  borderRadius: s(999),
                  flexDirection: "row",
                  alignItems: "center",
                  gap: s(6),
                  opacity: pressed ? 0.85 : 1,
                  flexShrink: 0,
                },
              ]}
              hitSlop={s(8)}
            >
              {({ pressed }) => (
                <Ionicons
                  name="trash-outline"
                  size={s(13)}
                  color={pressed ? "#FF5050" : colors.muted}
                />
              )}
            </Pressable>
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
});

// ─── Habit Row ─────────────────────────────────────────────────────────────────
type HabitRowProps = {
  habit: Habit;
  nextDate: string;
  objTitle?: string;
  objColor?: string;
  colors: any;
  radius: any;
  onComplete: (h: Habit) => void;
  onEdit: (h: Habit) => void;
};

const HabitRow = React.memo(function HabitRow({ habit, nextDate, objTitle, objColor, colors, radius, onComplete, onEdit }: HabitRowProps) {
  const [completing, setCompleting] = useState(false);
  const scaleAnim   = useState(new Animated.Value(1))[0];
  const opacityAnim = useState(new Animated.Value(1))[0];
  const cuePlayer = useAudioPlayer(require("../assets/Completed.mp3"));

  const isDueToday = nextDate === todayKey();

  const handleComplete = async () => {
    if (completing || !isDueToday) return;
    setCompleting(true);

    try {
      cuePlayer.seekTo(0);
      cuePlayer.volume = 0.7;
      cuePlayer.play();
    } catch {}

    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim,   { toValue: 1.1, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim,   { toValue: 0.8, duration: 200, useNativeDriver: true }),
      ]),
      Animated.timing(opacityAnim, { toValue: 0, duration: 350, delay: 150, useNativeDriver: true }),
    ]).start(() => {
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
      setCompleting(false);
      onComplete(habit);
    });
  };

  const freqLabel = habit.frequency === "daily" ? "Daily" : habit.frequency === "weekly" ? "Weekly" : "Monthly";
  const dueLabel  = isDueToday ? "Today" : fmtShortDay(nextDate);
  const dueBg = isDueToday ? "rgba(80,180,255,0.14)" : "rgba(0,0,0,0.16)";
  const dueBd = isDueToday ? "rgba(80,180,255,0.18)" : colors.border;

  return (
    <Animated.View style={{ borderRadius: radius.xl, borderWidth: s(1), borderColor: colors.border, backgroundColor: colors.surface, padding: s(12), opacity: opacityAnim, transform: [{ scale: scaleAnim }] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: s(12) }}>
        {/* Checkable circle — only tappable when due today */}
        <Pressable
          onPress={handleComplete}
          disabled={completing || !isDueToday}
          hitSlop={s(10)}
          style={({ pressed }) => [{
            width: s(26), height: s(26), borderRadius: s(13), borderWidth: s(2),
            borderColor: completing ? "#4CAF50" : (objColor ?? colors.border),
            alignItems: "center", justifyContent: "center", marginTop: s(2),
            opacity: isDueToday ? (pressed ? 0.85 : 1) : 0.4,
            backgroundColor: completing ? "#4CAF50" : "transparent",
          }]}
        >
          {completing
            ? <Ionicons name="checkmark" size={s(18)} color="#fff"/>
            : <Ionicons name="repeat-outline" size={s(13)} color={objColor ?? colors.muted}/>
          }
        </Pressable>

        <Pressable onPress={() => onEdit(habit)} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.92 : 1 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}>
            <Text style={{ color: colors.text, fontWeight: "600", fontSize: s(15), flex: 1 }} numberOfLines={1}>{habit.title}</Text>
            <Pressable onPress={(e) => { e.stopPropagation(); onEdit(habit); }} style={({ pressed }) => [{ padding: s(4), opacity: pressed ? 0.8 : 1 }]} hitSlop={s(8)}>
              <Ionicons name="create-outline" size={s(18)} color={colors.muted}/>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "nowrap", alignItems: "center", gap: s(6), marginTop: s(5) }}>
            {objTitle && (
              <View style={[metaPill(colors, radius), { flexShrink: 1, minWidth: 0 }]}>
                <Ionicons name="bookmark-outline" size={s(12)} color={colors.muted}/>
                <Text style={metaText(colors)} numberOfLines={1}>{objTitle}</Text>
              </View>
            )}
            <View style={{ paddingVertical: s(4), paddingHorizontal: s(8), borderRadius: s(999), backgroundColor: dueBg, borderWidth: s(1), borderColor: dueBd, flexDirection: "row", alignItems: "center", gap: s(6), flexShrink: 0 }}>
              <Ionicons name="calendar-outline" size={s(12)} color={colors.muted}/>
              <Text style={metaText(colors)} numberOfLines={1}>{dueLabel}</Text>
            </View>
            <View style={{ paddingVertical: s(4), paddingHorizontal: s(8), borderRadius: s(999), backgroundColor: "rgba(0,0,0,0.16)", borderWidth: s(1), borderColor: colors.border, flexShrink: 0 }}>
              <Text style={[metaText(colors), { color: colors.accent }]}>{freqLabel}</Text>
            </View>
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
});

// ─── Collapsible Objective Group (for "Objectives" sort mode) ─────────────────
type ObjGroupProps = {
  objective: Objective;
  tasks: Task[];
  objHabits: Array<{ _type: "habit"; deadline: string } & Habit>;
  colors: any;
  radius: any;
  saving: boolean;
  onToggleDone: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onToggleStar: (t: Task) => void;
  onCompleteHabit: (h: Habit) => void;
  onEditHabit: (h: Habit) => void;
  objectivesById: Map<string, Objective>;
};

function ObjectiveGroup({
  objective,
  tasks,
  objHabits,
  colors,
  radius,
  saving,
  onToggleDone,
  onEdit,
  onDelete,
  onToggleStar,
  onCompleteHabit,
  onEditHabit,
  objectivesById,
}: ObjGroupProps) {
  const [open, setOpen] = useState(true);
  const colorHex =
    OBJECTIVE_COLORS.find((x) => x.value === objective.color)?.hex ?? "#007AFF";

  return (
    <View style={{ gap: s(8) }}>
      {/* Objective header row */}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: s(10),
            paddingVertical: s(10),
            paddingHorizontal: s(14),
            borderRadius: radius.xl,
            borderWidth: s(1),
            borderColor: colors.border,
            backgroundColor: colors.surface2,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        {/* Color dot */}
        <View
          style={{
            width: s(10),
            height: s(10),
            borderRadius: s(5),
            backgroundColor: colorHex,
          }}
        />
        <Text
          style={{
            flex: 1,
            color: colors.text,
            fontWeight: "900",
            fontSize: s(14),
          }}
          numberOfLines={1}
        >
          {objective.title}
        </Text>
        <Text
          style={{ color: colors.muted, fontWeight: "800", fontSize: s(12) }}
        >
          {tasks.length + objHabits.length}
        </Text>
        {(tasks.length + objHabits.length) > 0 && (
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={s(16)}
            color={colors.muted}
          />
        )}
      </Pressable>

      {/* Task rows — indented, only when open and tasks exist */}
      {open &&
        tasks.map((t) => {
          const objTitle = objective.title;
          const objColorVal = OBJECTIVE_COLORS.find(
            (x) => x.value === objective.color,
          )?.hex;
          const dueLabel = !t.deadline
            ? "No date"
            : isToday(t.deadline)
              ? "Today"
              : isOverdue(t.deadline)
                ? `Overdue · ${fmtShortDay(t.deadline)}`
                : fmtShortDay(t.deadline);
          const dueTone: "danger" | "today" | "neutral" = isOverdue(t.deadline)
            ? "danger"
            : isToday(t.deadline)
              ? "today"
              : "neutral";
          return (
            <View key={t.id} style={{ marginLeft: s(16) }}>
              <TaskRow
                t={t}
                objTitle={objTitle}
                objColor={objColorVal}
                dueLabel={dueLabel}
                dueTone={dueTone}
                colors={colors}
                radius={radius}
                onToggleDone={onToggleDone}
                onEdit={onEdit}
                onToggleStar={onToggleStar}
                onDelete={onDelete}
              />
            </View>
          );
        })}
      {/* Habit rows — indented */}
      {open &&
        objHabits.map((h) => {
          const objColorVal = OBJECTIVE_COLORS.find((x) => x.value === objective.color)?.hex;
          return (
            <View key={h.id} style={{ marginLeft: s(16) }}>
              <HabitRow
                habit={h}
                nextDate={h.deadline}
                objTitle={objective.title}
                objColor={objColorVal}
                colors={colors}
                radius={radius}
                onComplete={onCompleteHabit}
                onEdit={onEditHabit}
              />
            </View>
          );
        })}
    </View>
  );
}

// ─── Unified list item type (task or habit, bucketed together by deadline) ─────
type ListItem =
  | ({ _type: "task" } & Task)
  | ({ _type: "habit"; deadline: string } & Habit);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TasksObjectivesScreen() {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    loadTutorialSeen()
      .then((seen) => {
        if (!seen) setShowTutorial(true);
      })
      .catch(() => {});
  }, []);

  const handleTutorialDone = async () => {
    setShowTutorial(false);
    await saveTutorialSeen().catch(() => {});
  };
  const { colors, radius, spacing } = useTheme();
  const { checkAchievements } = useAchievements();
  const { isTablet } = useDeviceClass();

  const [mode, setMode] = useState<Mode>("tasks");

  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);

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

  // Task form
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tObjectiveId, setTObjectiveId] = useState("");
  const [tDeadline, setTDeadline] = useState<string | undefined>(undefined);
  const [taskDateOpen, setTaskDateOpen] = useState(false);
  const [taskObjectiveOpen, setTaskObjectiveOpen] = useState(false);

  // Tabbed create sheet (FAB) — Task or Habit
  const [createTabSheetOpen, setCreateTabSheetOpen] = useState(false);
  const [createTab, setCreateTab] = useState<"task" | "habit">("task");

  // Habit form
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [hTitle, setHTitle] = useState("");
  const [hDesc, setHDesc] = useState("");
  const [hObjectiveId, setHObjectiveId] = useState("");
  const [hFrequency, setHFrequency] = useState<Habit["frequency"]>("daily");
  const [hSpecificDays, setHSpecificDays] = useState<number[]>([]);
  const [habitObjectiveOpen, setHabitObjectiveOpen] = useState(false);

  // Objective form
  const [objSheetOpen, setObjSheetOpen] = useState(false);
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(
    null,
  );
  const [oTitle, setOTitle] = useState("");
  const [oDesc, setODesc] = useState("");
  const [oCategory, setOCategory] = useState<Objective["category"]>("Academic");
  const [oColor, setOColor] = useState<Objective["color"]>("blue");
  const [oDeadline, setODeadline] = useState<string | undefined>(undefined);
  const [objDateOpen, setObjDateOpen] = useState(false);
  const [objCategoryOpen, setObjCategoryOpen] = useState(false);

  const [saving, setSaving] = useState(false);

  // Shared objectives (collaborative)
  const [sharedObjectives, setSharedObjectives] = useState<SharedObjective[]>(
    [],
  );
  const [myUid, setMyUid] = useState(auth.currentUser?.uid ?? "");
  useEffect(() => {
    return auth.onAuthStateChanged((u) => setMyUid(u?.uid ?? ""));
  }, []);

  // Share objective
  const [shareFriends, setShareFriends] = useState<{ profile: UserProfile }[]>(
    [],
  );
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [shareObjSheetOpen, setShareObjSheetOpen] = useState(false);
  const [shareObjTarget, setShareObjTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [shareObjInvitees, setShareObjInvitees] = useState<Set<string>>(
    new Set(),
  );
  const [shareObjSaving, setShareObjSaving] = useState(false);
  const [shareObjSearch, setShareObjSearch] = useState("");

  // Edit shared objective (host)
  const [editSharedObjOpen, setEditSharedObjOpen] = useState(false);
  const [editSharedObjTarget, setEditSharedObjTarget] =
    useState<SharedObjective | null>(null);
  const [editSharedTitle, setEditSharedTitle] = useState("");
  const [editSharedDesc, setEditSharedDesc] = useState("");
  const [editSharedDeadline, setEditSharedDeadline] = useState<
    string | undefined
  >(undefined);
  const [editSharedType, setEditSharedType] = useState("");
  const [editSharedTypeOpen, setEditSharedTypeOpen] = useState(false);
  const [editSharedDateOpen, setEditSharedDateOpen] = useState(false);
  const [editSharedSaving, setEditSharedSaving] = useState(false);

  // View shared objective details (members)
  const [viewSharedObjOpen, setViewSharedObjOpen] = useState(false);
  const [viewSharedObj, setViewSharedObj] = useState<SharedObjective | null>(
    null,
  );

  const loadFriendsOnce = useCallback(async () => {
    if (friendsLoaded) return;
    try {
      const fs = await getFriends();
      setShareFriends(fs);
      setFriendsLoaded(true);
    } catch {}
  }, [friendsLoaded]);

  const handleShareObjective = async () => {
    if (!shareObjTarget || shareObjSaving || shareObjInvitees.size === 0)
      return;
    setShareObjSaving(true);
    try {
      await createSharedObjective(shareObjTarget.title, [...shareObjInvitees]);
      // Remove the original local objective so it doesn't double up in the UI
      if (shareObjTarget.id) await deleteObjective(shareObjTarget.id);
      setShareObjSheetOpen(false);
      setShareObjTarget(null);
      setShareObjInvitees(new Set());
      await refresh();
    } catch {
      Alert.alert("Error", "Could not share objective. Please try again.");
    } finally {
      setShareObjSaving(false);
    }
  };

  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>([]);
  const [wizardObjectiveId, setWizardObjectiveId] = useState<string | null>(
    null,
  );
  const [editingPlan, setEditingPlan] = useState<TrainingPlan | undefined>(
    undefined,
  );

  const closeAllSheets = useCallback(() => {
    setSortSheetOpen(false);
    setDetailsOpen(false);
    setTaskObjectiveOpen(false);
    setTaskDateOpen(false);
    setObjSheetOpen(false);
    setObjCategoryOpen(false);
    setShareObjSheetOpen(false);
    setShareObjSearch("");
    setCreateTabSheetOpen(false);
    setHabitObjectiveOpen(false);
    Keyboard.dismiss();
  }, []);

  const refresh = useCallback(async () => {
    const misc = await ensureDefaultObjective();
    const objs = await loadObjectives();
    const ts = await loadTasks();
    const plans = await loadTrainingPlans();
    const hs = await loadHabits();
    setObjectives(objs);
    setTasks(ts);
    setTrainingPlans(plans);
    setHabits(hs);
    setTObjectiveId((prev) => prev || misc.id);
    getMySharedObjectives()
      .then(setSharedObjectives)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const objectivesById = useMemo(() => {
    const m = new Map<string, Objective>();
    objectives.forEach((o) => m.set(o.id, o));
    return m;
  }, [objectives]);

  const objectiveOptions = useMemo(
    () =>
      objectives
        .filter((o) => o.status !== "completed")
        .map((o) => ({
          value: o.id,
          label: o.title,
          subtitle: o.category,
          icon: "bookmark-outline" as const,
        })),
    [objectives],
  );

  const categoryOptions = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        value: c,
        label: c,
        icon: "pricetag-outline" as const,
      })),
    [],
  );

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
    setCreateTab("task");
    setCreateTabSheetOpen(true);
  };
  const openEditTask = (t: Task) => {
    setEditingTaskId(t.id);
    setTTitle(t.title ?? "");
    setTDesc(t.description ?? "");
    setTObjectiveId(t.objectiveId);
    setTDeadline(t.deadline);
    setDetailsOpen(true);
  };
  const openCreateHabit = () => {
    setEditingHabitId(null);
    setHTitle("");
    setHDesc("");
    setHObjectiveId("");
    setHFrequency("daily");
    setHSpecificDays([]);
    setCreateTab("habit");
    setCreateTabSheetOpen(true);
  };
  const openEditHabit = (h: Habit) => {
    setEditingHabitId(h.id);
    setHTitle(h.title ?? "");
    setHDesc(h.description ?? "");
    setHObjectiveId(h.objectiveId);
    setHFrequency(h.frequency);
    setHSpecificDays(h.specificDays ?? []);
    setCreateTab("habit");
    setCreateTabSheetOpen(true);
  };

  const saveTask = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const title = clamp(tTitle);
      if (title.length < 3 || !tObjectiveId) return;
      if (editingTaskId) {
        await updateTask(editingTaskId, {
          title,
          objectiveId: tObjectiveId,
          description: clamp(tDesc) || undefined,
          deadline: tDeadline,
        });
      } else {
        await addTask({
          title,
          objectiveId: tObjectiveId,
          description: clamp(tDesc) || undefined,
          deadline: tDeadline,
          importance: 2,
          status: "not-started",
        });
      }
      closeAllSheets();
      setEditingTaskId(null);
      setQuickTitle("");
      await refresh();
      rescheduleAllNotifications().catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const saveHabit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const title = clamp(hTitle);
      if (title.length < 2 || !hObjectiveId) return;
      const today = todayKey();
      if (editingHabitId) {
        await updateHabit(editingHabitId, {
          title,
          objectiveId: hObjectiveId,
          description: clamp(hDesc) || undefined,
          frequency: hFrequency,
          specificDays:
            hFrequency === "weekly" && hSpecificDays.length > 0
              ? hSpecificDays
              : undefined,
        });
      } else {
        await addHabit({
          title,
          objectiveId: hObjectiveId,
          description: clamp(hDesc) || undefined,
          frequency: hFrequency,
          specificDays:
            hFrequency === "weekly" && hSpecificDays.length > 0
              ? hSpecificDays
              : undefined,
          startDate: today,
        });
      }
      closeAllSheets();
      setEditingHabitId(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const quickAdd = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const title = clamp(quickTitle);
      if (title.length < 3 || !tObjectiveId) return;
      await addTask({
        title,
        objectiveId: tObjectiveId,
        description: undefined,
        deadline: undefined,
        importance: 2,
        status: "not-started",
      });
      setQuickTitle("");
      Keyboard.dismiss();
      await refresh();
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
          description: clamp(oDesc) || undefined,
          category: oCategory,
          color: oColor,
          deadline: oDeadline,
        });
      } else {
        await addObjective({
          title,
          description: clamp(oDesc) || undefined,
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
        await updateTask(t.id, {
          status: "completed",
          completedAt: new Date().toISOString(),
        });
        const uid = await getCurrentUser();
        if (uid) checkAchievements(uid);
      }
      await refresh();
      rescheduleAllNotifications().catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const toggleStarTask = async (t: Task) => {
    if (saving) return;
    setSaving(true);
    try {
      const starred = (t.importance ?? 2) >= 3;
      await updateTask(t.id, { importance: starred ? 2 : 3 });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const completeHabitToday = async (h: Habit) => {
    const today = todayKey();
    if ((h.completedDates ?? []).includes(today)) return;
    await updateHabit(h.id, { completedDates: [...(h.completedDates ?? []), today] });
    await refresh();
  };

  const objectiveProgress = (objectiveId: string) => {
    const ts = tasks.filter((t) => t.objectiveId === objectiveId);
    const total = ts.length;
    const done = ts.filter((t) => t.status === "completed").length;
    return {
      pct: total <= 0 ? 0 : Math.round((done / total) * 100),
      done,
      total,
    };
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

    let modeFiltered = filtered;
    if (sortMode === "my-day")
      modeFiltered = filtered.filter((t) => t.deadline === todayKey());
    else if (sortMode === "important")
      modeFiltered = filtered.filter((t) => (t.importance ?? 2) >= 3);
    const sortFn = (a: Task, b: Task) => {
      const aImp = a.importance ?? 2;
      const bImp = b.importance ?? 2;
      const aDue = a.deadline ?? "9999-12-31";
      const bDue = b.deadline ?? "9999-12-31";
      if (sortMode === "objectives")
        return (a.objectiveId ?? "").localeCompare(b.objectiveId ?? "");
      const order = (t: Task) => {
        const k = smartBucket(t.deadline);
        return k === "Overdue"
          ? 0
          : k === "Today"
            ? 1
            : k === "Tomorrow"
              ? 2
              : k === "Upcoming"
                ? 3
                : 4;
      };
      const ao = order(a),
        bo = order(b);
      if (ao !== bo) return ao - bo;
      if (aImp !== bImp) return bImp - aImp;
      return aDue.localeCompare(bDue);
    };
    const sorted = [...modeFiltered].sort(sortFn);

    // For plan-generated tasks, only expose the single earliest upcoming task per plan
    const planMap = new Map<string, Task>();
    const nonPlan: Task[] = [];
    for (const t of sorted) {
      if (!t.trainingPlanId) {
        nonPlan.push(t);
        continue;
      }
      const ex = planMap.get(t.trainingPlanId);
      if (!ex || (t.deadline ?? "9999") < (ex.deadline ?? "9999"))
        planMap.set(t.trainingPlanId, t);
    }
    return [...nonPlan, ...planMap.values()].sort(sortFn);
  }, [tasks, q, objectivesById, sortMode]);

  const completedTasks = useMemo(() => {
    const filtered = tasks
      .filter((t) => t.status === "completed")
      .filter((t) => {
        if (!q) return true;
        const obj = objectivesById.get(t.objectiveId);
        return (
          (t.title ?? "").toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          (obj?.title ?? "").toLowerCase().includes(q)
        );
      });
    filtered.sort((a, b) =>
      (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
    );
    return filtered;
  }, [tasks, q, objectivesById]);

  const completedPreview = completedTasks.slice(0, 20);
  const completedObjectives = useMemo(
    () => objectives.filter((o) => o.status === "completed"),
    [objectives],
  );

  // Habits mapped to list items (deadline = next occurrence date)
  const habitItems = useMemo(() => {
    return habits
      .filter((h) => {
        if (!q) return true;
        const obj = objectivesById.get(h.objectiveId);
        return (
          (h.title ?? "").toLowerCase().includes(q) ||
          (h.description ?? "").toLowerCase().includes(q) ||
          (obj?.title ?? "").toLowerCase().includes(q)
        );
      })
      .flatMap((h): Array<{ _type: "habit"; deadline: string } & Habit> => {
        const nextDate = getNextHabitOccurrence(h);
        if (!nextDate) return [];
        return [{ _type: "habit" as const, deadline: nextDate, ...h }];
      });
  }, [habits, q, objectivesById]);

  // Grouped by objective (for "objectives" sort mode) — ALL active objectives shown
  const tasksByObjective = useMemo(() => {
    const activeObjectives = objectives.filter((o) => o.status !== "completed");
    return activeObjectives.map((o) => ({
      objective: o,
      tasks: activeTasks.filter((t) => t.objectiveId === o.id),
      objHabits: habitItems.filter((h) => h.objectiveId === o.id),
    }));
  }, [activeTasks, habitItems, objectives]);

  const sections = useMemo(() => {
    const taskItems: ListItem[] = activeTasks.map((t) => ({ _type: "task" as const, ...t }));
    // habits have no importance — exclude from "important" mode
    // my-day: only habits due today; planned/other: all habits
    const habitsForMode: ListItem[] =
      sortMode === "important" ? [] :
      sortMode === "my-day" ? habitItems.filter((h) => h.deadline === todayKey()) :
      habitItems;
    const allItems: ListItem[] = [...taskItems, ...habitsForMode];
    if (sortMode !== "planned") return [{ title: "Tasks", data: allItems, totalCount: allItems.length }];
    const buckets: Record<string, ListItem[]> = { Overdue: [], Today: [], Tomorrow: [], Upcoming: [], Later: [] };
    allItems.forEach((item) => buckets[smartBucket(item.deadline)].push(item));
    return ["Overdue", "Today", "Tomorrow", "Upcoming", "Later"]
      .map((k) => ({
        title: k,
        data: openSections[k] ? buckets[k] : [],
        totalCount: buckets[k].length,
      }))
      .filter((s) => s.totalCount > 0);
  }, [activeTasks, habitItems, sortMode, openSections]);

  const selectedTaskObjective =
    objectivesById.get(tObjectiveId)?.title ?? "Select objective";

  const SORT_OPTIONS = [
    {
      k: "my-day" as SortMode,
      label: "My Day",
      icon: "sunny-outline" as const,
    },
    {
      k: "important" as SortMode,
      label: "Important",
      icon: "star-outline" as const,
    },
    {
      k: "objectives" as SortMode,
      label: "Objectives",
      icon: "bookmark-outline" as const,
    },
    {
      k: "planned" as SortMode,
      label: "Planned",
      icon: "calendar-outline" as const,
    },
  ];

  const sortLabel =
    SORT_OPTIONS.find((o) => o.k === sortMode)?.label ?? "Planned";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      <View
        style={[
          { flex: 1 },
          isTablet && {
            maxWidth: WIDE_MAX_WIDTH,
            alignSelf: "center" as const,
            width: "100%",
          },
        ]}
      >
        {/* HEADER */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
            gap: s(12),
          }}
        >
          <View style={styles.rowBetween}>
            <Text
              style={{ color: colors.text, fontWeight: "700", fontSize: s(40) }}
            >
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
                  <Ionicons
                    name="swap-vertical"
                    size={s(16)}
                    color={colors.text}
                  />
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "800",
                      fontSize: s(14),
                    }}
                  >
                    {sortLabel}
                  </Text>
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

          <View
            style={[
              styles.searchWrap,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface2,
                borderRadius: radius.xl,
              },
            ]}
          >
            <Ionicons name="search" size={s(18)} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={
                mode === "tasks"
                  ? "Search tasks, notes, objectives…"
                  : "Search objectives…"
              }
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
              <Pressable
                onPress={() => setQuery("")}
                style={({ pressed }) => [
                  { padding: s(6), opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons
                  name="close-circle"
                  size={s(18)}
                  color={colors.muted}
                />
              </Pressable>
            )}
          </View>
        </View>

        {/* CONTENT */}
        {mode === "tasks" ? (
          sortMode === "objectives" ? (
            /* ── Objectives grouped view ── */
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                paddingBottom: s(120),
                gap: s(14),
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {tasksByObjective.length === 0 ? (
                <View style={{ paddingTop: s(40), alignItems: "center" }}>
                  <Ionicons
                    name="bookmark-outline"
                    size={s(40)}
                    color={colors.muted}
                  />
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "800",
                      marginTop: s(12),
                      fontSize: s(14),
                    }}
                  >
                    No active tasks
                  </Text>
                </View>
              ) : (
                tasksByObjective.map(({ objective, tasks: objTasks, objHabits }) => (
                  <ObjectiveGroup
                    key={objective.id}
                    objective={objective}
                    tasks={objTasks}
                    objHabits={objHabits}
                    colors={colors}
                    radius={radius}
                    saving={saving}
                    onToggleDone={toggleCompleteTask}
                    onEdit={openEditTask}
                    onToggleStar={toggleStarTask}
                    onDelete={async (id) => {
                      if (saving) return;
                      setSaving(true);
                      try {
                        await deleteTask(id);
                        await refresh();
                        rescheduleAllNotifications().catch(() => {});
                      } finally {
                        setSaving(false);
                      }
                    }}
                    onCompleteHabit={completeHabitToday}
                    onEditHabit={openEditHabit}
                    objectivesById={objectivesById}
                  />
                ))
              )}
              <View style={{ height: s(12) }} />
            </ScrollView>
          ) : (
            /* ── Standard section list ── */
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                paddingBottom: s(120),
                gap: s(10),
              }}
              stickySectionHeadersEnabled={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderSectionHeader={({ section }) => {
                const isPlannedMode = sortMode === "planned";
                const sectionOpen = openSections[section.title] ?? true;
                const count =
                  (section as any).totalCount ?? section.data.length;

                if (!isPlannedMode) {
                  return (
                    <View style={{ marginTop: s(4), marginBottom: s(6) }}>
                      <View
                        style={[
                          styles.sectionPill,
                          {
                            borderColor: colors.border,
                            borderRadius: s(999),
                            backgroundColor: "rgba(0,0,0,0.18)",
                          },
                        ]}
                      >
                        <Text style={{ color: colors.text, fontWeight: "900" }}>
                          {section.title}
                        </Text>
                        <Text
                          style={{ color: colors.muted, fontWeight: "900" }}
                        >
                          {count}
                        </Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <Pressable
                    onPress={() =>
                      setOpenSections((prev) => ({
                        ...prev,
                        [section.title]: !prev[section.title],
                      }))
                    }
                    style={({ pressed }) => [
                      {
                        marginTop: s(4),
                        marginBottom: s(6),
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.sectionPill,
                        {
                          borderColor: colors.border,
                          borderRadius: s(999),
                          backgroundColor: "rgba(0,0,0,0.18)",
                        },
                      ]}
                    >
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        {section.title}
                      </Text>
                      <Text style={{ color: colors.muted, fontWeight: "900" }}>
                        {count}
                      </Text>
                      <Ionicons
                        name={sectionOpen ? "chevron-up" : "chevron-down"}
                        size={s(16)}
                        color={colors.text}
                      />
                    </View>
                  </Pressable>
                );
              }}
              renderItem={({ item }: { item: ListItem }) => {
                if (item._type === "habit") {
                  const objColorVal = OBJECTIVE_COLORS.find(
                    (x) => x.value === objectivesById.get(item.objectiveId)?.color,
                  )?.hex;
                  return (
                    <HabitRow
                      habit={item}
                      nextDate={item.deadline}
                      objTitle={objectivesById.get(item.objectiveId)?.title}
                      objColor={objColorVal}
                      colors={colors}
                      radius={radius}
                      onComplete={completeHabitToday}
                      onEdit={openEditHabit}
                    />
                  );
                }
                const objTitle = objectivesById.get(item.objectiveId)?.title;
                const objColorVal = OBJECTIVE_COLORS.find(
                  (x) =>
                    x.value === objectivesById.get(item.objectiveId)?.color,
                )?.hex;
                const dueLabel = !item.deadline
                  ? "No date"
                  : isToday(item.deadline)
                    ? "Today"
                    : isOverdue(item.deadline)
                      ? `Overdue • ${fmtShortDay(item.deadline)}`
                      : fmtShortDay(item.deadline);
                const dueTone: "danger" | "today" | "neutral" = isOverdue(
                  item.deadline,
                )
                  ? "danger"
                  : isToday(item.deadline)
                    ? "today"
                    : "neutral";
                return (
                  <TaskRow
                    t={item}
                    objTitle={objTitle}
                    objColor={objColorVal}
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
                        rescheduleAllNotifications().catch(() => {});
                      } finally {
                        setSaving(false);
                      }
                    }}
                  />
                );
              }}
              ListFooterComponent={
                <View style={{ marginTop: s(14), gap: s(10) }}>
                  {completedTasks.length > 0 && (
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
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: s(10),
                          }}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={s(18)}
                            color={colors.muted}
                          />
                          <Text
                            style={{ color: colors.text, fontWeight: "900" }}
                          >
                            Completed
                          </Text>
                          <Text
                            style={{ color: colors.muted, fontWeight: "900" }}
                          >
                            {completedTasks.length}
                          </Text>
                        </View>
                        <Ionicons
                          name={completedOpen ? "chevron-up" : "chevron-down"}
                          size={s(18)}
                          color={colors.text}
                        />
                      </Pressable>

                      {completedOpen && (
                        <View style={{ gap: s(10) }}>
                          {completedPreview.map((t) => (
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
                              <Ionicons
                                name="checkmark-circle"
                                size={s(18)}
                                color={colors.muted}
                              />
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    color: colors.muted,
                                    fontWeight: "900",
                                  }}
                                  numberOfLines={1}
                                >
                                  {t.title}
                                </Text>
                                <Text
                                  style={{
                                    color: colors.muted,
                                    fontWeight: "800",
                                    fontSize: s(12),
                                    marginTop: s(2),
                                  }}
                                  numberOfLines={1}
                                >
                                  {objectivesById.get(t.objectiveId)?.title ??
                                    "Objective"}
                                </Text>
                              </View>
                              <Pressable
                                onPress={async () => {
                                  if (saving) return;
                                  setSaving(true);
                                  try {
                                    await updateTask(t.id, {
                                      status: "not-started",
                                      completedAt: null,
                                    });
                                    await refresh();
                                  } finally {
                                    setSaving(false);
                                  }
                                }}
                                style={({ pressed }) => [
                                  {
                                    padding: s(8),
                                    opacity: pressed ? 0.85 : 1,
                                  },
                                ]}
                              >
                                <Text
                                  style={{
                                    color: colors.text,
                                    fontWeight: "900",
                                    fontSize: s(12),
                                  }}
                                >
                                  Undo
                                </Text>
                              </Pressable>
                            </View>
                          ))}
                          {completedTasks.length > 20 && (
                            <Text
                              style={{
                                color: colors.muted,
                                fontWeight: "800",
                                lineHeight: s(18),
                              }}
                            >
                              Showing 20 of {completedTasks.length}. Search to find older completed tasks.
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
          )
        ) : (
          /* ── OBJECTIVES TAB ── */
          <SectionList
            sections={[
              {
                title: "Objectives",
                data: objectives.filter((o) => o.status !== "completed"),
              },
            ]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: s(120),
              gap: spacing.md,
            }}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: o }) => {
              const p = objectiveProgress(o.id);
              const miscLocked =
                o.title.trim().toLowerCase() === "miscellaneous";
              const objColorHex =
                OBJECTIVE_COLORS.find((x) => x.value === o.color)?.hex ??
                "#007AFF";
              return (
                <View
                  style={{
                    borderRadius: radius.xl,
                    borderWidth: s(1),
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    padding: s(10),
                    gap: s(6),
                    borderLeftWidth: s(3),
                    borderLeftColor: objColorHex,
                  }}
                >
                  {/* Row 1: title + actions */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: s(8),
                    }}
                  >
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "600",
                        fontSize: s(15),
                        flex: 1,
                      }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.65}
                    >
                      {o.title}
                    </Text>
                    <View style={{ flexDirection: "row", gap: s(2) }}>
                      <Pressable
                        onPress={() => openEditObjective(o)}
                        style={({ pressed }) => [
                          { padding: s(4), opacity: pressed ? 0.8 : 1 },
                        ]}
                      >
                        <Ionicons
                          name="create-outline"
                          size={s(16)}
                          color={colors.muted}
                        />
                      </Pressable>
                      {!miscLocked && (
                        <Pressable
                          onPress={() => {
                            loadFriendsOnce();
                            setShareObjTarget({ id: o.id, title: o.title });
                            setShareObjInvitees(new Set());
                            setShareObjSearch("");
                            setShareObjSheetOpen(true);
                          }}
                          style={({ pressed }) => [
                            { padding: s(4), opacity: pressed ? 0.8 : 1 },
                          ]}
                        >
                          <Ionicons
                            name="person-add-outline"
                            size={s(16)}
                            color={colors.muted}
                          />
                        </Pressable>
                      )}
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
                        style={({ pressed }) => [
                          { padding: s(4), opacity: pressed ? 0.8 : 1 },
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={s(16)}
                          color={
                            miscLocked ? "rgba(255,255,255,0.25)" : colors.muted
                          }
                        />
                      </Pressable>
                    </View>
                  </View>

                  {/* Row 2: meta pills */}
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: s(5),
                    }}
                  >
                    <View style={metaPill(colors, radius)}>
                      <Ionicons
                        name="pricetag-outline"
                        size={s(12)}
                        color={colors.muted}
                      />
                      <Text style={metaText(colors)}>{o.category}</Text>
                    </View>
                    <View style={metaPill(colors, radius)}>
                      <Ionicons
                        name="analytics-outline"
                        size={s(12)}
                        color={colors.muted}
                      />
                      <Text style={metaText(colors)}>
                        {p.pct}% ({p.done}/{p.total})
                      </Text>
                    </View>
                    <View style={metaPill(colors, radius)}>
                      <Ionicons
                        name="calendar-outline"
                        size={s(12)}
                        color={colors.muted}
                      />
                      <Text style={metaText(colors)}>
                        {o.deadline ? fmtShortDay(o.deadline) : "No date"}
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View
                    style={{
                      height: s(5),
                      borderRadius: s(999),
                      backgroundColor: colors.surface2,
                      borderWidth: s(1),
                      borderColor: colors.border,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${p.pct}%`,
                        backgroundColor: objColorHex,
                      }}
                    />
                  </View>

                  {!miscLocked &&
                    o.category === "Health & Fitness" &&
                    (() => {
                      const activePlan = trainingPlans.find(
                        (pl) =>
                          pl.objectiveId === o.id && pl.status === "active",
                      );
                      if (activePlan) {
                        return (
                          <PlanCard
                            plan={activePlan}
                            onEdit={() => {
                              setEditingPlan(activePlan);
                              setWizardObjectiveId(o.id);
                            }}
                            onPause={async () => {
                              await updateTrainingPlan(activePlan.id, {
                                status: "paused",
                              });
                              await refresh();
                            }}
                            onRegenerate={async () => {
                              await replacePlanTasks(
                                activePlan.id,
                                generatePlanTasks(activePlan),
                              );
                              await refresh();
                            }}
                            onDelete={async () => {
                              await deleteTrainingPlan(activePlan.id);
                              await refresh();
                            }}
                            colors={colors}
                            radius={radius}
                          />
                        );
                      }
                      return (
                        <Pressable
                          onPress={() => {
                            setEditingPlan(undefined);
                            setWizardObjectiveId(o.id);
                          }}
                          style={({ pressed }) => ({
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: s(6),
                            height: s(38),
                            borderRadius: radius.xl,
                            borderWidth: s(1),
                            borderColor: colors.accent,
                            borderStyle: "dashed",
                            opacity: pressed ? 0.85 : 1,
                          })}
                        >
                          <Ionicons
                            name="barbell-outline"
                            size={s(15)}
                            color={colors.accent}
                          />
                          <Text
                            style={{
                              color: colors.accent,
                              fontWeight: "800",
                              fontSize: s(13),
                            }}
                          >
                            Add training plan
                          </Text>
                        </Pressable>
                      );
                    })()}

                  {!miscLocked && (
                    <View style={{ gap: s(6) }}>
                      {p.total > 0 && p.done < p.total && (
                        <View
                          style={{
                            height: s(40),
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
                          <Ionicons
                            name="lock-closed"
                            size={s(16)}
                            color={colors.muted}
                          />
                          <Text
                            style={{
                              fontWeight: "600",
                              fontSize: s(13),
                              color: colors.muted,
                            }}
                          >
                            Complete all tasks ({p.done}/{p.total})
                          </Text>
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
                            height: s(40),
                            borderRadius: radius.xl,
                            borderWidth: s(1),
                            borderColor: colors.border,
                            backgroundColor:
                              p.total > 0 && p.done < p.total
                                ? "rgba(255,255,255,0.08)"
                                : colors.accent,
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "row",
                            gap: s(8),
                            opacity:
                              p.total > 0 && p.done < p.total
                                ? 0.5
                                : pressed
                                  ? 0.88
                                  : 1,
                          },
                        ]}
                      >
                        <Ionicons
                          name="checkmark"
                          size={s(16)}
                          color={
                            p.total > 0 && p.done < p.total
                              ? colors.muted
                              : colors.bg
                          }
                        />
                        <Text
                          style={{
                            fontWeight: "600",
                            fontSize: s(13),
                            color:
                              p.total > 0 && p.done < p.total
                                ? colors.muted
                                : colors.bg,
                          }}
                        >
                          {p.total === 0
                            ? "Mark completed"
                            : p.done === p.total
                              ? "Mark completed"
                              : "Locked"}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            }}
            ListFooterComponent={
              <View style={{ gap: s(10) }}>
                {/* ── Shared Objectives (collaborative, from Social) ── */}
                {sharedObjectives.filter((o) => o.status !== "completed")
                  .length > 0 && (
                  <View style={{ gap: s(10) }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: s(8),
                        paddingTop: s(8),
                      }}
                    >
                      <Ionicons
                        name="people-outline"
                        size={s(15)}
                        color={colors.muted}
                      />
                      <Text
                        style={{
                          color: colors.muted,
                          fontWeight: "900",
                          fontSize: s(13),
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                        }}
                      >
                        Shared
                      </Text>
                    </View>
                    {sharedObjectives
                      .filter((o) => o.status !== "completed")
                      .map((o) => {
                        const completedUids = o.completedUids ?? [];
                        const totalMembers = o.memberUids.length;
                        const votedCount = completedUids.length;
                        const hasVoted = completedUids.includes(myUid);
                        const allDone = votedCount >= totalMembers;
                        const isHost = o.owner_id === myUid;
                        return (
                          <View
                            key={o.id}
                            style={{
                              borderRadius: radius.xl,
                              borderWidth: s(1),
                              borderColor: colors.border,
                              backgroundColor: colors.surface,
                              padding: s(12),
                              gap: s(8),
                              borderLeftWidth: s(3),
                              borderLeftColor: colors.accent,
                            }}
                          >
                            {/* Title row */}
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: s(8),
                              }}
                            >
                              <Ionicons
                                name="flag-outline"
                                size={s(15)}
                                color={colors.accent}
                              />
                              <Text
                                style={{
                                  flex: 1,
                                  color: colors.text,
                                  fontWeight: "700",
                                  fontSize: s(14),
                                }}
                                numberOfLines={1}
                              >
                                {o.title}
                              </Text>
                              {isHost ? (
                                <>
                                  <View
                                    style={{
                                      paddingHorizontal: s(8),
                                      paddingVertical: s(2),
                                      borderRadius: s(999),
                                      backgroundColor: colors.surface2,
                                      borderWidth: s(1),
                                      borderColor: colors.border,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: colors.muted,
                                        fontSize: s(11),
                                        fontWeight: "800",
                                      }}
                                    >
                                      Host
                                    </Text>
                                  </View>
                                  <Pressable
                                    onPress={() => {
                                      setEditSharedObjTarget(o);
                                      setEditSharedTitle(o.title);
                                      setEditSharedDesc(o.description ?? "");
                                      setEditSharedDeadline(o.deadline);
                                      setEditSharedType(o.objectiveType ?? "");
                                      setEditSharedObjOpen(true);
                                    }}
                                    style={({ pressed }) => [
                                      {
                                        padding: s(4),
                                        opacity: pressed ? 0.7 : 1,
                                      },
                                    ]}
                                  >
                                    <Ionicons
                                      name="pencil-outline"
                                      size={s(16)}
                                      color={colors.muted}
                                    />
                                  </Pressable>
                                </>
                              ) : (
                                <Pressable
                                  onPress={() => {
                                    setViewSharedObj(o);
                                    setViewSharedObjOpen(true);
                                  }}
                                  style={({ pressed }) => [
                                    {
                                      padding: s(4),
                                      opacity: pressed ? 0.7 : 1,
                                    },
                                  ]}
                                >
                                  <Ionicons
                                    name="information-circle-outline"
                                    size={s(18)}
                                    color={colors.muted}
                                  />
                                </Pressable>
                              )}
                            </View>

                            {/* Members section */}
                            {isHost ? (
                              <View style={{ gap: s(6) }}>
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: colors.muted,
                                      fontWeight: "700",
                                      fontSize: s(12),
                                    }}
                                  >
                                    Members
                                  </Text>
                                  <Pressable
                                    onPress={async () => {
                                      try {
                                        await setHideObjectiveMembers(
                                          o.id,
                                          !o.hideMembers,
                                        );
                                        setSharedObjectives((prev) =>
                                          prev.map((x) =>
                                            x.id === o.id
                                              ? {
                                                  ...x,
                                                  hideMembers: !o.hideMembers,
                                                }
                                              : x,
                                          ),
                                        );
                                      } catch {
                                        Alert.alert(
                                          "Error",
                                          "Could not update visibility.",
                                        );
                                      }
                                    }}
                                    style={({ pressed }) => [
                                      {
                                        opacity: pressed ? 0.7 : 1,
                                        padding: s(4),
                                      },
                                    ]}
                                  >
                                    <Ionicons
                                      name={
                                        o.hideMembers
                                          ? "eye-off-outline"
                                          : "eye-outline"
                                      }
                                      size={s(16)}
                                      color={colors.muted}
                                    />
                                  </Pressable>
                                </View>
                                {o.members.map((m) => (
                                  <View
                                    key={m.uid}
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: s(8),
                                    }}
                                  >
                                    <View
                                      style={{
                                        width: s(24),
                                        height: s(24),
                                        borderRadius: s(12),
                                        backgroundColor: colors.accent,
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <Text
                                        style={{
                                          color: colors.bg,
                                          fontWeight: "800",
                                          fontSize: s(10),
                                        }}
                                      >
                                        {m.displayName
                                          ?.charAt(0)
                                          .toUpperCase() ?? "?"}
                                      </Text>
                                    </View>
                                    <Text
                                      style={{
                                        flex: 1,
                                        color: colors.text,
                                        fontSize: s(12),
                                        fontWeight: "600",
                                      }}
                                    >
                                      {m.uid === myUid
                                        ? `${m.displayName} (you)`
                                        : m.displayName}
                                    </Text>
                                    {m.uid !== myUid && (
                                      <Pressable
                                        onPress={() =>
                                          Alert.alert(
                                            "Remove member",
                                            `Remove ${m.displayName} from this objective?`,
                                            [
                                              {
                                                text: "Cancel",
                                                style: "cancel",
                                              },
                                              {
                                                text: "Remove",
                                                style: "destructive",
                                                onPress: async () => {
                                                  try {
                                                    await kickMemberFromObjective(
                                                      o.id,
                                                      m.uid,
                                                    );
                                                    setSharedObjectives(
                                                      (prev) =>
                                                        prev.map((x) =>
                                                          x.id === o.id
                                                            ? {
                                                                ...x,
                                                                members:
                                                                  x.members.filter(
                                                                    (mb) =>
                                                                      mb.uid !==
                                                                      m.uid,
                                                                  ),
                                                                memberUids:
                                                                  x.memberUids.filter(
                                                                    (uid) =>
                                                                      uid !==
                                                                      m.uid,
                                                                  ),
                                                              }
                                                            : x,
                                                        ),
                                                    );
                                                  } catch {
                                                    Alert.alert(
                                                      "Error",
                                                      "Could not remove member.",
                                                    );
                                                  }
                                                },
                                              },
                                            ],
                                          )
                                        }
                                        style={({ pressed }) => [
                                          {
                                            opacity: pressed ? 0.7 : 1,
                                            padding: s(4),
                                          },
                                        ]}
                                      >
                                        <Ionicons
                                          name="close-circle-outline"
                                          size={s(18)}
                                          color={colors.muted}
                                        />
                                      </Pressable>
                                    )}
                                  </View>
                                ))}
                              </View>
                            ) : (
                              !o.hideMembers && (
                                <Text
                                  style={{
                                    color: colors.muted,
                                    fontSize: s(12),
                                  }}
                                  numberOfLines={1}
                                >
                                  {o.members
                                    .map((m) => m.displayName)
                                    .join(", ")}
                                </Text>
                              )
                            )}

                            {/* Progress bar */}
                            <View
                              style={{
                                height: s(5),
                                borderRadius: s(999),
                                backgroundColor: colors.surface2,
                                overflow: "hidden",
                              }}
                            >
                              <View
                                style={{
                                  height: "100%",
                                  width: `${Math.round((votedCount / totalMembers) * 100)}%`,
                                  backgroundColor: colors.accent,
                                }}
                              />
                            </View>

                            {/* Vote / Waiting / Done */}
                            {allDone ? (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: s(6),
                                  justifyContent: "center",
                                  paddingVertical: s(6),
                                }}
                              >
                                <Ionicons
                                  name="checkmark-circle"
                                  size={s(16)}
                                  color="#34C759"
                                />
                                <Text
                                  style={{
                                    color: "#34C759",
                                    fontWeight: "800",
                                    fontSize: s(13),
                                  }}
                                >
                                  All members completed!
                                </Text>
                              </View>
                            ) : hasVoted ? (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: s(8),
                                  height: s(38),
                                  borderRadius: radius.xl,
                                  borderWidth: s(1),
                                  borderColor: colors.border,
                                  backgroundColor: "rgba(255,255,255,0.06)",
                                  justifyContent: "center",
                                }}
                              >
                                <Ionicons
                                  name="time-outline"
                                  size={s(15)}
                                  color={colors.muted}
                                />
                                <Text
                                  style={{
                                    color: colors.muted,
                                    fontWeight: "700",
                                    fontSize: s(13),
                                  }}
                                >
                                  Waiting · {votedCount}/{totalMembers} done
                                </Text>
                              </View>
                            ) : (
                              <Pressable
                                onPress={async () => {
                                  if (saving) return;
                                  setSaving(true);
                                  try {
                                    await voteCompleteSharedObjective(o.id);
                                    await refresh();
                                  } catch {
                                    Alert.alert(
                                      "Error",
                                      "Could not save completion.",
                                    );
                                  } finally {
                                    setSaving(false);
                                  }
                                }}
                                style={({ pressed }) => [
                                  {
                                    height: s(38),
                                    borderRadius: radius.xl,
                                    borderWidth: s(1),
                                    borderColor: colors.border,
                                    backgroundColor: colors.accent,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: s(8),
                                    opacity: saving ? 0.55 : pressed ? 0.88 : 1,
                                  },
                                ]}
                              >
                                <Ionicons
                                  name="checkmark"
                                  size={s(16)}
                                  color={colors.bg}
                                />
                                <Text
                                  style={{
                                    color: colors.bg,
                                    fontWeight: "700",
                                    fontSize: s(13),
                                  }}
                                >
                                  Mark as done · {votedCount}/{totalMembers}
                                </Text>
                              </Pressable>
                            )}

                            {/* Leave button for non-host members */}
                            {!isHost && (
                              <Pressable
                                onPress={() =>
                                  Alert.alert(
                                    "Leave objective",
                                    "Leave this shared objective?",
                                    [
                                      { text: "Cancel", style: "cancel" },
                                      {
                                        text: "Leave",
                                        style: "destructive",
                                        onPress: async () => {
                                          try {
                                            await leaveSharedObjective(o.id);
                                            setSharedObjectives((prev) =>
                                              prev.filter((x) => x.id !== o.id),
                                            );
                                          } catch {
                                            Alert.alert(
                                              "Error",
                                              "Could not leave objective.",
                                            );
                                          }
                                        },
                                      },
                                    ],
                                  )
                                }
                                style={({ pressed }) => [
                                  {
                                    height: s(36),
                                    borderRadius: radius.xl,
                                    borderWidth: s(1),
                                    borderColor: "#FF3B30",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: s(6),
                                    opacity: pressed ? 0.8 : 1,
                                  },
                                ]}
                              >
                                <Ionicons
                                  name="exit-outline"
                                  size={s(15)}
                                  color="#FF3B30"
                                />
                                <Text
                                  style={{
                                    color: "#FF3B30",
                                    fontWeight: "700",
                                    fontSize: s(12),
                                  }}
                                >
                                  Leave objective
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                  </View>
                )}

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
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: s(10),
                        }}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={s(18)}
                          color={colors.muted}
                        />
                        <Text style={{ color: colors.text, fontWeight: "900" }}>
                          Completed
                        </Text>
                        <Text
                          style={{ color: colors.muted, fontWeight: "900" }}
                        >
                          {completedObjectives.length}
                        </Text>
                      </View>
                      <Ionicons
                        name={
                          completedObjectivesOpen
                            ? "chevron-up"
                            : "chevron-down"
                        }
                        size={s(18)}
                        color={colors.text}
                      />
                    </Pressable>
                    {completedObjectivesOpen && (
                      <View style={{ gap: s(10) }}>
                        {completedObjectives.map((o) => (
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
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: s(10),
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    color: colors.muted,
                                    fontWeight: "900",
                                  }}
                                >
                                  {o.title}
                                </Text>
                                {!!o.description && (
                                  <Text
                                    style={{
                                      color: colors.muted,
                                      fontWeight: "700",
                                      fontSize: s(12),
                                      marginTop: s(4),
                                    }}
                                  >
                                    {o.description}
                                  </Text>
                                )}
                              </View>
                              <Ionicons
                                name="checkmark-circle"
                                size={s(18)}
                                color={colors.muted}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
                <View style={{ height: s(12) }} />
              </View>
            }
          />
        )}

        {/* CREATE TAB SHEET — Task or Habit */}
        <BottomSheet visible={createTabSheetOpen} onClose={closeAllSheets}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}
            >
              {createTab === "task"
                ? editingTaskId
                  ? "Edit task"
                  : "New task"
                : editingHabitId
                  ? "Edit habit"
                  : "New habit"}
            </Text>
            <Pressable
              onPress={closeAllSheets}
              style={({ pressed }) => [
                { padding: s(8), opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="close" size={s(20)} color={colors.text} />
            </Pressable>
          </View>

          {/* Tab bar */}
          <View
            style={{
              flexDirection: "row",
              marginTop: s(12),
              borderRadius: radius.xl,
              backgroundColor: colors.surface2,
              borderWidth: s(1),
              borderColor: colors.border,
              padding: s(3),
            }}
          >
            {(["task", "habit"] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => {
                  setCreateTab(tab);
                  setTaskObjectiveOpen(false);
                  setHabitObjectiveOpen(false);
                  Keyboard.dismiss();
                }}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: s(8),
                    borderRadius: radius.lg,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      createTab === tab ? colors.accent : "transparent",
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: createTab === tab ? colors.bg : colors.muted,
                    fontWeight: "900",
                    fontSize: s(13),
                  }}
                >
                  {tab === "task" ? "Task" : "Habit"}
                </Text>
              </Pressable>
            ))}
          </View>

          {createTab === "task" ? (
            /* ── TASK FORM ── */
            <View style={{ marginTop: s(4) }}>
              <View style={{ marginTop: spacing.md }}>
                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "900",
                    fontSize: s(12),
                  }}
                >
                  Title
                </Text>
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
                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "900",
                    fontSize: s(12),
                  }}
                >
                  Notes (optional)
                </Text>
                <View style={inputWrap(colors, radius)}>
                  <TextInput
                    value={tDesc}
                    onChangeText={setTDesc}
                    placeholder="Notes"
                    placeholderTextColor={colors.muted}
                    style={[
                      input(colors),
                      { height: s(72), textAlignVertical: "top" },
                    ]}
                    multiline
                    blurOnSubmit
                    returnKeyType="done"
                  />
                </View>
              </View>

              <View
                style={{
                  marginTop: spacing.md,
                  flexDirection: "row",
                  gap: s(10),
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "900",
                      fontSize: s(12),
                    }}
                  >
                    Objective
                  </Text>
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      setTaskObjectiveOpen(!taskObjectiveOpen);
                      setTaskDateOpen(false);
                    }}
                    style={({ pressed }) => [
                      field(colors, radius),
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text
                      style={{ color: colors.text, fontWeight: "900" }}
                      numberOfLines={1}
                    >
                      {selectedTaskObjective}
                    </Text>
                    <Ionicons
                      name={taskObjectiveOpen ? "chevron-up" : "chevron-down"}
                      size={s(18)}
                      color={colors.text}
                    />
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "900",
                      fontSize: s(12),
                    }}
                  >
                    Date
                  </Text>
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      setTaskDateOpen(!taskDateOpen);
                      setTaskObjectiveOpen(false);
                    }}
                    style={({ pressed }) => [
                      field(colors, radius),
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      {tDeadline ? fmtShortDay(tDeadline) : "No date"}
                    </Text>
                    <Ionicons
                      name={taskDateOpen ? "chevron-up" : "chevron-down"}
                      size={s(18)}
                      color={colors.text}
                    />
                  </Pressable>
                </View>
              </View>

              {taskObjectiveOpen && (
                <View
                  style={{
                    marginTop: spacing.sm,
                    borderRadius: radius.lg,
                    backgroundColor: colors.surface2,
                    borderWidth: s(1),
                    borderColor: colors.border,
                    overflow: "hidden",
                    maxHeight: s(180),
                  }}
                >
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
                          backgroundColor: pressed
                            ? colors.card2
                            : "transparent",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        })}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flex: 1,
                          }}
                        >
                          <Ionicons
                            name={opt.icon}
                            size={s(16)}
                            color={colors.muted}
                          />
                          <Text
                            style={{
                              color: colors.text,
                              fontWeight:
                                opt.value === tObjectiveId ? "900" : "600",
                              fontSize: s(14),
                              marginLeft: s(8),
                            }}
                            numberOfLines={1}
                          >
                            {opt.label}
                          </Text>
                        </View>
                        {opt.value === tObjectiveId && (
                          <Ionicons
                            name="checkmark"
                            size={s(20)}
                            color={colors.accent}
                          />
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {taskDateOpen && (
                <View
                  style={{
                    marginTop: spacing.sm,
                    borderRadius: radius.lg,
                    backgroundColor: colors.surface2,
                    borderWidth: s(1),
                    borderColor: colors.border,
                    overflow: "hidden",
                  }}
                >
                  <MiniCalendar
                    theme={{ colors, radius }}
                    value={tDeadline || new Date().toISOString().split("T")[0]}
                    onChange={(date) => {
                      setTDeadline(date);
                      setTaskDateOpen(false);
                    }}
                  />
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
                <Text
                  style={{
                    color: colors.bg,
                    fontWeight: "900",
                    fontSize: s(15),
                  }}
                >
                  Create task
                </Text>
              </Pressable>
            </View>
          ) : (
            /* ── HABIT FORM ── */
            <View style={{ marginTop: s(4) }}>
              <View style={{ marginTop: spacing.md }}>
                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "900",
                    fontSize: s(12),
                  }}
                >
                  Title
                </Text>
                <View style={inputWrap(colors, radius)}>
                  <TextInput
                    value={hTitle}
                    onChangeText={setHTitle}
                    placeholder="Habit title"
                    placeholderTextColor={colors.muted}
                    style={input(colors)}
                  />
                </View>
              </View>

              <View style={{ marginTop: spacing.md }}>
                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "900",
                    fontSize: s(12),
                  }}
                >
                  Notes (optional)
                </Text>
                <View style={inputWrap(colors, radius)}>
                  <TextInput
                    value={hDesc}
                    onChangeText={setHDesc}
                    placeholder="Notes"
                    placeholderTextColor={colors.muted}
                    style={[
                      input(colors),
                      { height: s(72), textAlignVertical: "top" },
                    ]}
                    multiline
                    blurOnSubmit
                    returnKeyType="done"
                  />
                </View>
              </View>

              <View style={{ marginTop: spacing.md }}>
                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "900",
                    fontSize: s(12),
                  }}
                >
                  Objective
                </Text>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setHabitObjectiveOpen(!habitObjectiveOpen);
                  }}
                  style={({ pressed }) => [
                    field(colors, radius),
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text
                    style={{
                      color: objectivesById.get(hObjectiveId)
                        ? colors.text
                        : colors.muted,
                      fontWeight: "900",
                    }}
                    numberOfLines={1}
                  >
                    {objectivesById.get(hObjectiveId)?.title ??
                      "Select objective"}
                  </Text>
                  <Ionicons
                    name={habitObjectiveOpen ? "chevron-up" : "chevron-down"}
                    size={s(18)}
                    color={colors.text}
                  />
                </Pressable>
              </View>

              {habitObjectiveOpen && (
                <View
                  style={{
                    marginTop: spacing.sm,
                    borderRadius: radius.lg,
                    backgroundColor: colors.surface2,
                    borderWidth: s(1),
                    borderColor: colors.border,
                    overflow: "hidden",
                    maxHeight: s(180),
                  }}
                >
                  <ScrollView>
                    {objectiveOptions.map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => {
                          setHObjectiveId(opt.value);
                          setHabitObjectiveOpen(false);
                        }}
                        style={({ pressed }) => ({
                          padding: s(12),
                          borderBottomWidth: s(1),
                          borderBottomColor: colors.border,
                          backgroundColor: pressed
                            ? colors.card2
                            : "transparent",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        })}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flex: 1,
                          }}
                        >
                          <Ionicons
                            name={opt.icon}
                            size={s(16)}
                            color={colors.muted}
                          />
                          <Text
                            style={{
                              color: colors.text,
                              fontWeight:
                                opt.value === hObjectiveId ? "900" : "600",
                              fontSize: s(14),
                              marginLeft: s(8),
                            }}
                            numberOfLines={1}
                          >
                            {opt.label}
                          </Text>
                        </View>
                        {opt.value === hObjectiveId && (
                          <Ionicons
                            name="checkmark"
                            size={s(20)}
                            color={colors.accent}
                          />
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={{ marginTop: spacing.md }}>
                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "900",
                    fontSize: s(12),
                  }}
                >
                  Frequency
                </Text>
                <View
                  style={{ flexDirection: "row", gap: s(8), marginTop: s(8) }}
                >
                  {(["daily", "weekly", "monthly"] as const).map((freq) => (
                    <Pressable
                      key={freq}
                      onPress={() => {
                        setHFrequency(freq);
                        if (freq !== "weekly") setHSpecificDays([]);
                      }}
                      style={({ pressed }) => [
                        {
                          flex: 1,
                          paddingVertical: s(10),
                          borderRadius: radius.xl,
                          borderWidth: s(1),
                          borderColor:
                            hFrequency === freq ? colors.accent : colors.border,
                          backgroundColor:
                            hFrequency === freq
                              ? "rgba(255,255,255,0.08)"
                              : colors.surface2,
                          alignItems: "center",
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            hFrequency === freq ? colors.accent : colors.text,
                          fontWeight: "900",
                          fontSize: s(13),
                        }}
                      >
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {hFrequency === "weekly" && (
                <View style={{ marginTop: spacing.md }}>
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "900",
                      fontSize: s(12),
                    }}
                  >
                    Days
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: s(6),
                      marginTop: s(8),
                      flexWrap: "wrap",
                    }}
                  >
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(
                      (label, idx) => {
                        const active = hSpecificDays.includes(idx);
                        return (
                          <Pressable
                            key={idx}
                            onPress={() =>
                              setHSpecificDays((prev) =>
                                active
                                  ? prev.filter((d) => d !== idx)
                                  : [...prev, idx],
                              )
                            }
                            style={({ pressed }) => [
                              {
                                width: s(36),
                                height: s(36),
                                borderRadius: s(18),
                                borderWidth: s(1),
                                borderColor: active
                                  ? colors.accent
                                  : colors.border,
                                backgroundColor: active
                                  ? "rgba(255,255,255,0.1)"
                                  : colors.surface2,
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: active ? colors.accent : colors.text,
                                fontWeight: "900",
                                fontSize: s(12),
                              }}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      },
                    )}
                  </View>
                </View>
              )}

              <Pressable
                onPress={saveHabit}
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
                <Ionicons
                  name="repeat-outline"
                  size={s(20)}
                  color={colors.bg}
                />
                <Text
                  style={{
                    color: colors.bg,
                    fontWeight: "900",
                    fontSize: s(15),
                  }}
                >
                  {editingHabitId ? "Save changes" : "Create habit"}
                </Text>
              </Pressable>

              {editingHabitId && (
                <Pressable
                  onPress={async () => {
                    if (!editingHabitId || saving) return;
                    setSaving(true);
                    try {
                      await deleteHabit(editingHabitId);
                      closeAllSheets();
                      setEditingHabitId(null);
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
                  <Ionicons
                    name="trash-outline"
                    size={s(18)}
                    color={colors.text}
                  />
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    Delete habit
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          <View style={{ height: s(12) }} />
        </BottomSheet>

        {/* SORT SHEET */}
        <BottomSheet visible={sortSheetOpen} onClose={closeAllSheets}>
          <View style={styles.sheetHeader}>
            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}
            >
              Sort tasks
            </Text>
            <Pressable
              onPress={closeAllSheets}
              style={({ pressed }) => [
                { padding: s(8), opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="close" size={s(20)} color={colors.text} />
            </Pressable>
          </View>

          {SORT_OPTIONS.map((x) => {
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
                    backgroundColor: active
                      ? "rgba(255,255,255,0.14)"
                      : colors.surface2,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: s(10),
                  }}
                >
                  <Ionicons name={x.icon} size={s(16)} color={colors.muted} />
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    {x.label}
                  </Text>
                </View>
                {active && (
                  <Ionicons name="checkmark" size={s(18)} color={colors.text} />
                )}
              </Pressable>
            );
          })}

          <View style={{ height: s(12) }} />
        </BottomSheet>

        {/* TASK DETAILS SHEET */}
        <BottomSheet visible={detailsOpen} onClose={closeAllSheets}>
          <View style={styles.sheetHeader}>
            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}
            >
              {editingTaskId ? "Edit task" : "Task details"}
            </Text>
            <Pressable
              onPress={closeAllSheets}
              style={({ pressed }) => [
                { padding: s(8), opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="close" size={s(20)} color={colors.text} />
            </Pressable>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Text
              style={{
                color: colors.muted,
                fontWeight: "900",
                fontSize: s(12),
              }}
            >
              Title
            </Text>
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
            <Text
              style={{
                color: colors.muted,
                fontWeight: "900",
                fontSize: s(12),
              }}
            >
              Notes (optional)
            </Text>
            <View style={inputWrap(colors, radius)}>
              <TextInput
                value={tDesc}
                onChangeText={setTDesc}
                placeholder="Notes"
                placeholderTextColor={colors.muted}
                style={[
                  input(colors),
                  { height: s(86), textAlignVertical: "top" },
                ]}
                multiline
                blurOnSubmit
                returnKeyType="done"
              />
            </View>
          </View>

          <View
            style={{ marginTop: spacing.md, flexDirection: "row", gap: s(10) }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.muted,
                  fontWeight: "900",
                  fontSize: s(12),
                }}
              >
                Objective
              </Text>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setTaskObjectiveOpen(!taskObjectiveOpen);
                }}
                style={({ pressed }) => [
                  field(colors, radius),
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text
                  style={{ color: colors.text, fontWeight: "900" }}
                  numberOfLines={1}
                >
                  {selectedTaskObjective}
                </Text>
                <Ionicons
                  name={taskObjectiveOpen ? "chevron-up" : "chevron-down"}
                  size={s(18)}
                  color={colors.text}
                />
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.muted,
                  fontWeight: "900",
                  fontSize: s(12),
                }}
              >
                Date
              </Text>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setTaskDateOpen(!taskDateOpen);
                }}
                style={({ pressed }) => [
                  field(colors, radius),
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  {tDeadline ? fmtShortDay(tDeadline) : "No date"}
                </Text>
                <Ionicons
                  name={taskDateOpen ? "chevron-up" : "chevron-down"}
                  size={s(18)}
                  color={colors.text}
                />
              </Pressable>
            </View>
          </View>

          {taskObjectiveOpen && (
            <View
              style={{
                marginTop: spacing.sm,
                borderRadius: radius.lg,
                backgroundColor: colors.surface2,
                borderWidth: s(1),
                borderColor: colors.border,
                overflow: "hidden",
                maxHeight: s(200),
              }}
            >
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
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                      }}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={s(16)}
                        color={colors.muted}
                      />
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight:
                            opt.value === tObjectiveId ? "900" : "600",
                          fontSize: s(14),
                          marginLeft: s(8),
                        }}
                        numberOfLines={1}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    {opt.value === tObjectiveId && (
                      <Ionicons
                        name="checkmark"
                        size={s(20)}
                        color={colors.accent}
                      />
                    )}
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
            <Text
              style={{ color: colors.bg, fontWeight: "900", fontSize: s(15) }}
            >
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
                  rescheduleAllNotifications().catch(() => {});
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
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                Delete task
              </Text>
            </Pressable>
          )}

          <View style={{ height: s(12) }} />

          {taskDateOpen && (
            <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}>
              <Pressable
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: "rgba(0,0,0,0.35)" },
                ]}
                onPress={() => setTaskDateOpen(false)}
              />
              <View
                style={{
                  position: "absolute",
                  left: s(14),
                  right: s(14),
                  bottom: s(14),
                }}
              >
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
                    <Text
                      style={{
                        flex: 1,
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: s(14),
                      }}
                    >
                      Select date
                    </Text>
                    <Pressable
                      onPress={() => setTaskDateOpen(false)}
                      hitSlop={s(10)}
                      style={{ padding: s(6) }}
                    >
                      <Ionicons
                        name="close"
                        size={s(18)}
                        color={colors.muted}
                      />
                    </Pressable>
                  </View>
                  <View style={{ padding: s(12) }}>
                    <MiniCalendar
                      theme={{ colors, radius }}
                      value={
                        tDeadline || new Date().toISOString().split("T")[0]
                      }
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
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "900",
                          fontSize: s(13),
                        }}
                      >
                        Done
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}
        </BottomSheet>

        {/* CREATE / EDIT OBJECTIVE SHEET */}
        <BottomSheet visible={objSheetOpen} onClose={closeAllSheets}>
          <View style={styles.sheetHeader}>
            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}
            >
              {editingObjectiveId ? "Edit objective" : "New objective"}
            </Text>
            <Pressable
              onPress={closeAllSheets}
              style={({ pressed }) => [
                { padding: s(8), opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="close" size={s(20)} color={colors.text} />
            </Pressable>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Text
              style={{
                color: colors.muted,
                fontWeight: "900",
                fontSize: s(12),
              }}
            >
              Title
            </Text>
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
            <Text
              style={{
                color: colors.muted,
                fontWeight: "900",
                fontSize: s(12),
              }}
            >
              Description (optional)
            </Text>
            <View style={inputWrap(colors, radius)}>
              <TextInput
                value={oDesc}
                onChangeText={setODesc}
                placeholder="What does success look like?"
                placeholderTextColor={colors.muted}
                style={[
                  input(colors),
                  { height: s(86), textAlignVertical: "top" },
                ]}
                multiline
                blurOnSubmit
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Text
              style={{
                color: colors.muted,
                fontWeight: "900",
                fontSize: s(12),
              }}
            >
              Category
            </Text>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                setObjCategoryOpen(!objCategoryOpen);
              }}
              style={({ pressed }) => [
                field(colors, radius),
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                {oCategory}
              </Text>
              <Ionicons
                name={objCategoryOpen ? "chevron-up" : "chevron-down"}
                size={s(18)}
                color={colors.text}
              />
            </Pressable>
          </View>

          {objCategoryOpen && (
            <View
              style={{
                marginTop: spacing.sm,
                borderRadius: radius.lg,
                backgroundColor: colors.surface2,
                borderWidth: s(1),
                borderColor: colors.border,
                overflow: "hidden",
                maxHeight: s(200),
              }}
            >
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
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                      }}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={s(16)}
                        color={colors.muted}
                      />
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: opt.value === oCategory ? "900" : "600",
                          fontSize: s(14),
                          marginLeft: s(8),
                        }}
                        numberOfLines={1}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    {opt.value === oCategory && (
                      <Ionicons
                        name="checkmark"
                        size={s(20)}
                        color={colors.accent}
                      />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ marginTop: spacing.md }}>
            <Text
              style={{
                color: colors.muted,
                fontWeight: "900",
                fontSize: s(12),
              }}
            >
              Color
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: s(10),
                marginTop: s(8),
              }}
            >
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
                        backgroundColor: isSelected
                          ? c.hex + "20"
                          : colors.card2,
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
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "800",
                        fontSize: s(13),
                      }}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Text
              style={{
                color: colors.muted,
                fontWeight: "900",
                fontSize: s(12),
              }}
            >
              Deadline
            </Text>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                setObjDateOpen(!objDateOpen);
              }}
              style={({ pressed }) => [
                field(colors, radius),
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                {oDeadline ? fmtShortDay(oDeadline) : "No date"}
              </Text>
              <Ionicons
                name={objDateOpen ? "chevron-up" : "chevron-down"}
                size={s(18)}
                color={colors.text}
              />
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
            <Ionicons
              name={editingObjectiveId ? "save-outline" : "add"}
              size={s(20)}
              color={colors.bg}
            />
            <Text
              style={{ color: colors.bg, fontWeight: "900", fontSize: s(15) }}
            >
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
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                Delete objective
              </Text>
            </Pressable>
          )}

          <View style={{ height: s(12) }} />

          {objDateOpen && (
            <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}>
              <Pressable
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: "rgba(0,0,0,0.35)" },
                ]}
                onPress={() => setObjDateOpen(false)}
              />
              <View
                style={{
                  position: "absolute",
                  left: s(14),
                  right: s(14),
                  bottom: s(14),
                }}
              >
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
                    <Text
                      style={{
                        flex: 1,
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: s(14),
                      }}
                    >
                      Select deadline
                    </Text>
                    <Pressable
                      onPress={() => setObjDateOpen(false)}
                      hitSlop={s(10)}
                      style={{ padding: s(6) }}
                    >
                      <Ionicons
                        name="close"
                        size={s(18)}
                        color={colors.muted}
                      />
                    </Pressable>
                  </View>
                  <View style={{ padding: s(12) }}>
                    <MiniCalendar
                      theme={{ colors, radius }}
                      value={
                        oDeadline || new Date().toISOString().split("T")[0]
                      }
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
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "900",
                          fontSize: s(13),
                        }}
                      >
                        Done
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}
        </BottomSheet>

        {/* SHARE OBJECTIVE SHEET */}
        <BottomSheet
          visible={shareObjSheetOpen}
          onClose={() => {
            setShareObjSheetOpen(false);
            setShareObjInvitees(new Set());
            setShareObjSearch("");
          }}
        >
          <View style={styles.sheetHeader}>
            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}
            >
              Add people
            </Text>
            <Pressable
              onPress={() => {
                setShareObjSheetOpen(false);
                setShareObjInvitees(new Set());
                setShareObjSearch("");
              }}
              style={({ pressed }) => [
                { padding: s(8), opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="close" size={s(20)} color={colors.text} />
            </Pressable>
          </View>
          {shareObjTarget && (
            <Text
              style={{
                color: colors.muted,
                fontSize: s(12),
                fontWeight: "700",
                marginBottom: s(10),
              }}
              numberOfLines={1}
            >
              Sharing "{shareObjTarget.title}"
            </Text>
          )}
          {shareFriends.length === 0 ? (
            <View
              style={{
                paddingVertical: s(24),
                alignItems: "center",
                gap: s(8),
              }}
            >
              <Ionicons
                name="people-outline"
                size={s(36)}
                color={colors.muted}
              />
              <Text
                style={{
                  color: colors.muted,
                  fontWeight: "700",
                  fontSize: s(13),
                  textAlign: "center",
                }}
              >
                No friends yet. Add friends in the Social tab to share.
              </Text>
            </View>
          ) : (
            <>
              {/* Search bar */}
              <View
                style={[
                  styles.searchWrap,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface2,
                    borderRadius: radius.xl,
                    marginBottom: s(10),
                  },
                ]}
              >
                <Ionicons name="search" size={s(16)} color={colors.muted} />
                <TextInput
                  value={shareObjSearch}
                  onChangeText={setShareObjSearch}
                  placeholder="Search friends…"
                  placeholderTextColor={colors.muted}
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontWeight: "700",
                    fontSize: s(13),
                    paddingVertical: Platform.OS === "ios" ? s(8) : s(6),
                  }}
                />
                {!!shareObjSearch && (
                  <Pressable
                    onPress={() => setShareObjSearch("")}
                    style={({ pressed }) => [
                      { padding: s(4), opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Ionicons
                      name="close-circle"
                      size={s(16)}
                      color={colors.muted}
                    />
                  </Pressable>
                )}
              </View>
              <ScrollView
                style={{ maxHeight: s(220) }}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {shareFriends
                  .filter((f) => {
                    if (!shareObjSearch) return true;
                    const q = shareObjSearch.toLowerCase();
                    return (
                      f.profile.displayName.toLowerCase().includes(q) ||
                      (f.profile.friendTag ?? "").toLowerCase().includes(q)
                    );
                  })
                  .map((f) => {
                    const isSel = shareObjInvitees.has(f.profile.uid);
                    return (
                      <Pressable
                        key={f.profile.uid}
                        onPress={() => {
                          setShareObjInvitees((prev) => {
                            const next = new Set(prev);
                            if (isSel) next.delete(f.profile.uid);
                            else next.add(f.profile.uid);
                            return next;
                          });
                        }}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: s(10),
                          gap: s(12),
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        {/* Avatar circle */}
                        <View
                          style={{
                            width: s(34),
                            height: s(34),
                            borderRadius: s(17),
                            backgroundColor: isSel
                              ? colors.accent
                              : colors.surface2,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: isSel ? 0 : s(1),
                            borderColor: colors.border,
                          }}
                        >
                          <Text
                            style={{
                              color: isSel ? "#fff" : colors.text,
                              fontWeight: "900",
                              fontSize: s(13),
                            }}
                          >
                            {f.profile.displayName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: s(13),
                              fontWeight: "800",
                              color: colors.text,
                            }}
                            numberOfLines={1}
                          >
                            {f.profile.displayName}
                          </Text>
                          <Text
                            style={{
                              fontSize: s(11),
                              color: colors.muted,
                              marginTop: s(1),
                            }}
                          >
                            #{f.profile.friendTag ?? ""}
                          </Text>
                        </View>
                        {isSel && (
                          <Ionicons
                            name="checkmark-circle"
                            size={s(20)}
                            color={colors.accent}
                          />
                        )}
                      </Pressable>
                    );
                  })}
              </ScrollView>
              <Pressable
                onPress={handleShareObjective}
                disabled={shareObjSaving || shareObjInvitees.size === 0}
                style={({ pressed }) => [
                  {
                    marginTop: s(14),
                    height: s(52),
                    borderRadius: radius.xl,
                    backgroundColor:
                      shareObjInvitees.size > 0
                        ? colors.accent
                        : colors.surface2,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: s(10),
                    opacity:
                      shareObjSaving || shareObjInvitees.size === 0
                        ? 0.55
                        : pressed
                          ? 0.9
                          : 1,
                  },
                ]}
              >
                <Ionicons
                  name="person-add-outline"
                  size={s(18)}
                  color={shareObjInvitees.size > 0 ? colors.bg : colors.muted}
                />
                <Text
                  style={{
                    color: shareObjInvitees.size > 0 ? colors.bg : colors.muted,
                    fontWeight: "900",
                    fontSize: s(15),
                  }}
                >
                  {shareObjSaving
                    ? "Sharing…"
                    : shareObjInvitees.size > 0
                      ? `Add ${shareObjInvitees.size} friend${shareObjInvitees.size !== 1 ? "s" : ""}`
                      : "Select friends to add"}
                </Text>
              </Pressable>
            </>
          )}
          <View style={{ height: s(12) }} />
        </BottomSheet>

        <ObjectiveTutorial visible={showTutorial} onDone={handleTutorialDone} />

        {/* EDIT SHARED OBJECTIVE SHEET (host only) */}
        <BottomSheet
          visible={editSharedObjOpen}
          onClose={() => {
            setEditSharedObjOpen(false);
            setEditSharedObjTarget(null);
            setEditSharedTypeOpen(false);
            setEditSharedDateOpen(false);
          }}
        >
          <View style={styles.sheetHeader}>
            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}
            >
              Edit objective
            </Text>
            <Pressable
              onPress={() => setEditSharedObjOpen(false)}
              style={({ pressed }) => [
                { padding: s(8), opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="close" size={s(20)} color={colors.text} />
            </Pressable>
          </View>
          {/* Title */}
          <View
            style={{
              borderRadius: radius.xl,
              borderWidth: s(1),
              borderColor: colors.border,
              backgroundColor: colors.surface2,
              paddingHorizontal: s(12),
              paddingVertical: s(10),
              flexDirection: "row",
              alignItems: "center",
              marginBottom: s(10),
            }}
          >
            <Ionicons
              name="pencil-outline"
              size={s(16)}
              color={colors.muted}
              style={{ marginRight: s(8) }}
            />
            <TextInput
              value={editSharedTitle}
              onChangeText={setEditSharedTitle}
              placeholder="Title"
              placeholderTextColor={colors.muted}
              style={{
                flex: 1,
                color: colors.text,
                fontWeight: "800",
                fontSize: s(14),
              }}
            />
          </View>
          {/* Type – expanding list */}
          <View
            style={{
              borderRadius: radius.xl,
              borderWidth: s(1),
              borderColor: colors.border,
              backgroundColor: colors.surface2,
              marginBottom: s(10),
              overflow: "hidden",
            }}
          >
            <Pressable
              onPress={() => {
                setEditSharedTypeOpen((v) => !v);
                setEditSharedDateOpen(false);
              }}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: s(12),
                  paddingVertical: s(10),
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name="pricetag-outline"
                size={s(16)}
                color={colors.muted}
                style={{ marginRight: s(8) }}
              />
              <Text
                style={{
                  flex: 1,
                  color: editSharedType ? colors.text : colors.muted,
                  fontWeight: "700",
                  fontSize: s(13),
                }}
              >
                {editSharedType || "Select type"}
              </Text>
              {editSharedType ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setEditSharedType("");
                  }}
                  hitSlop={s(10)}
                >
                  <Ionicons
                    name="close-circle"
                    size={s(18)}
                    color={colors.muted}
                  />
                </Pressable>
              ) : null}
              <Ionicons
                name={editSharedTypeOpen ? "chevron-up" : "chevron-down"}
                size={s(16)}
                color={colors.muted}
                style={{ marginLeft: s(6) }}
              />
            </Pressable>
            {editSharedTypeOpen && (
              <View
                style={{ borderTopWidth: s(1), borderTopColor: colors.border }}
              >
                {OBJECTIVE_CATEGORIES.map((cat, i) => {
                  const active = editSharedType === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => {
                        setEditSharedType(cat);
                        setEditSharedTypeOpen(false);
                      }}
                      style={({ pressed }) => [
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: s(16),
                          paddingVertical: s(11),
                          backgroundColor: active
                            ? colors.accent + "18"
                            : "transparent",
                          borderTopWidth: i === 0 ? 0 : s(1),
                          borderTopColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          flex: 1,
                          color: active ? colors.accent : colors.text,
                          fontWeight: active ? "900" : "700",
                          fontSize: s(13),
                        }}
                      >
                        {cat}
                      </Text>
                      {active && (
                        <Ionicons
                          name="checkmark"
                          size={s(16)}
                          color={colors.accent}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
          {/* Deadline */}
          <Pressable
            onPress={() => setEditSharedDateOpen((v) => !v)}
            style={({ pressed }) => [
              {
                borderRadius: radius.xl,
                borderWidth: s(1),
                borderColor: colors.border,
                backgroundColor: colors.surface2,
                paddingHorizontal: s(12),
                paddingVertical: s(10),
                flexDirection: "row",
                alignItems: "center",
                marginBottom: s(10),
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={s(16)}
              color={colors.muted}
              style={{ marginRight: s(8) }}
            />
            <Text
              style={{
                flex: 1,
                color: editSharedDeadline ? colors.text : colors.muted,
                fontWeight: "700",
                fontSize: s(13),
              }}
            >
              {editSharedDeadline
                ? new Date(editSharedDeadline + "T00:00:00").toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric", year: "numeric" },
                  )
                : "Add deadline"}
            </Text>
            {editSharedDeadline && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setEditSharedDeadline(undefined);
                }}
                hitSlop={s(10)}
              >
                <Ionicons
                  name="close-circle"
                  size={s(18)}
                  color={colors.muted}
                />
              </Pressable>
            )}
            <Ionicons
              name={editSharedDateOpen ? "chevron-up" : "chevron-down"}
              size={s(16)}
              color={colors.muted}
              style={{ marginLeft: s(6) }}
            />
          </Pressable>
          {editSharedDateOpen && (
            <View style={{ marginBottom: s(10) }}>
              <MiniCalendar
                theme={{ colors, radius }}
                value={
                  editSharedDeadline || new Date().toISOString().split("T")[0]
                }
                onChange={(d) => {
                  setEditSharedDeadline(d);
                  setEditSharedDateOpen(false);
                }}
              />
            </View>
          )}
          {/* Description */}
          <View
            style={{
              borderRadius: radius.xl,
              borderWidth: s(1),
              borderColor: colors.border,
              backgroundColor: colors.surface2,
              paddingHorizontal: s(12),
              paddingVertical: s(10),
              marginBottom: s(14),
            }}
          >
            <Ionicons
              name="document-text-outline"
              size={s(16)}
              color={colors.muted}
              style={{ marginBottom: s(4) }}
            />
            <TextInput
              value={editSharedDesc}
              onChangeText={setEditSharedDesc}
              placeholder="Add description"
              placeholderTextColor={colors.muted}
              multiline
              style={{
                color: colors.text,
                fontWeight: "700",
                fontSize: s(13),
                minHeight: s(60),
                textAlignVertical: "top",
              }}
            />
          </View>
          <Pressable
            onPress={async () => {
              if (
                !editSharedObjTarget ||
                !editSharedTitle.trim() ||
                editSharedSaving
              )
                return;
              setEditSharedSaving(true);
              try {
                const updates = {
                  title: editSharedTitle.trim(),
                  description: editSharedDesc.trim() || undefined,
                  deadline: editSharedDeadline,
                  objectiveType: editSharedType || undefined,
                };
                await updateSharedObjective(editSharedObjTarget.id, updates);
                setSharedObjectives((prev) =>
                  prev.map((x) =>
                    x.id === editSharedObjTarget.id ? { ...x, ...updates } : x,
                  ),
                );
                setEditSharedObjOpen(false);
                setEditSharedObjTarget(null);
              } catch {
                Alert.alert("Error", "Could not save changes.");
              } finally {
                setEditSharedSaving(false);
              }
            }}
            disabled={editSharedSaving || !editSharedTitle.trim()}
            style={({ pressed }) => [
              {
                height: s(52),
                borderRadius: radius.xl,
                backgroundColor: editSharedTitle.trim()
                  ? colors.accent
                  : colors.surface2,
                alignItems: "center",
                justifyContent: "center",
                opacity:
                  editSharedSaving || !editSharedTitle.trim()
                    ? 0.55
                    : pressed
                      ? 0.9
                      : 1,
              },
            ]}
          >
            <Text
              style={{
                color: editSharedTitle.trim() ? colors.bg : colors.muted,
                fontWeight: "900",
                fontSize: s(15),
              }}
            >
              {editSharedSaving ? "Saving…" : "Save changes"}
            </Text>
          </Pressable>
          <View style={{ height: s(12) }} />
        </BottomSheet>

        {/* VIEW SHARED OBJECTIVE DETAILS (members) */}
        <BottomSheet
          visible={viewSharedObjOpen}
          onClose={() => {
            setViewSharedObjOpen(false);
            setViewSharedObj(null);
          }}
        >
          {viewSharedObj && (
            <>
              <View style={styles.sheetHeader}>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: s(16),
                  }}
                  numberOfLines={1}
                >
                  {viewSharedObj.title}
                </Text>
                <Pressable
                  onPress={() => setViewSharedObjOpen(false)}
                  style={({ pressed }) => [
                    { padding: s(8), opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Ionicons name="close" size={s(20)} color={colors.text} />
                </Pressable>
              </View>
              {/* Host */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: s(8),
                  marginBottom: s(10),
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={s(14)}
                  color={colors.muted}
                />
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: s(12),
                    fontWeight: "700",
                  }}
                >
                  Host:{" "}
                  <Text style={{ color: colors.text }}>
                    {viewSharedObj.owner_name}
                  </Text>
                </Text>
              </View>
              {/* Type */}
              {!!viewSharedObj.objectiveType && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: s(8),
                    marginBottom: s(8),
                  }}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={s(14)}
                    color={colors.muted}
                  />
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: s(12),
                      fontWeight: "700",
                    }}
                  >
                    Type:{" "}
                    <Text style={{ color: colors.text }}>
                      {viewSharedObj.objectiveType}
                    </Text>
                  </Text>
                </View>
              )}
              {/* Deadline */}
              {!!viewSharedObj.deadline && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: s(8),
                    marginBottom: s(8),
                  }}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={s(14)}
                    color={colors.muted}
                  />
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: s(12),
                      fontWeight: "700",
                    }}
                  >
                    Deadline:{" "}
                    <Text style={{ color: colors.text }}>
                      {new Date(
                        viewSharedObj.deadline + "T00:00:00",
                      ).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </Text>
                </View>
              )}
              {/* Description */}
              {!!viewSharedObj.description && (
                <View
                  style={{
                    borderRadius: radius.xl,
                    borderWidth: s(1),
                    borderColor: colors.border,
                    backgroundColor: colors.surface2,
                    padding: s(12),
                    marginBottom: s(10),
                  }}
                >
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "700",
                      fontSize: s(12),
                      marginBottom: s(4),
                    }}
                  >
                    Description
                  </Text>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "700",
                      fontSize: s(13),
                    }}
                  >
                    {viewSharedObj.description}
                  </Text>
                </View>
              )}
              {/* Members */}
              {!viewSharedObj.hideMembers &&
                viewSharedObj.members.length > 0 && (
                  <View
                    style={{
                      borderRadius: radius.xl,
                      borderWidth: s(1),
                      borderColor: colors.border,
                      backgroundColor: colors.surface2,
                      padding: s(12),
                      marginBottom: s(10),
                    }}
                  >
                    <Text
                      style={{
                        color: colors.muted,
                        fontWeight: "700",
                        fontSize: s(12),
                        marginBottom: s(8),
                      }}
                    >
                      Members
                    </Text>
                    {viewSharedObj.members.map((m) => (
                      <View
                        key={m.uid}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: s(8),
                          paddingVertical: s(5),
                        }}
                      >
                        <View
                          style={{
                            width: s(28),
                            height: s(28),
                            borderRadius: s(14),
                            backgroundColor: colors.accent,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: colors.bg,
                              fontWeight: "800",
                              fontSize: s(11),
                            }}
                          >
                            {m.displayName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            color: colors.text,
                            fontWeight: "600",
                            fontSize: s(13),
                          }}
                        >
                          {m.displayName}
                        </Text>
                        {m.role === "owner" && (
                          <View
                            style={{
                              paddingHorizontal: s(7),
                              paddingVertical: s(2),
                              borderRadius: s(999),
                              backgroundColor: colors.card,
                              borderWidth: s(1),
                              borderColor: colors.border,
                            }}
                          >
                            <Text
                              style={{
                                color: colors.muted,
                                fontSize: s(10),
                                fontWeight: "800",
                              }}
                            >
                              Host
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              <View style={{ height: s(12) }} />
            </>
          )}
        </BottomSheet>

        <TrainingPlanWizard
          visible={wizardObjectiveId !== null}
          objectiveId={wizardObjectiveId ?? ""}
          existingPlan={editingPlan}
          onClose={() => {
            setWizardObjectiveId(null);
            setEditingPlan(undefined);
          }}
          onSave={async (plan) => {
            if (editingPlan) {
              await updateTrainingPlan(plan.id, plan);
            } else {
              await addTrainingPlan(plan);
            }
            await replacePlanTasks(plan.id, generatePlanTasks(plan));
            setWizardObjectiveId(null);
            setEditingPlan(undefined);
            await refresh();
          }}
        />
      </View>
      {/* end centering column */}
    </SafeAreaView>
  );
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────
function PlanCard({
  plan,
  onEdit,
  onPause,
  onRegenerate,
  onDelete,
  colors,
  radius,
}: {
  plan: TrainingPlan;
  onEdit: () => void;
  onPause: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  colors: any;
  radius: any;
}) {
  const typeBadge = plan.type === "cycle" ? "Cycle" : "Weekly";
  const startLabel = plan.startDate
    ? new Date(plan.startDate + "T00:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <View
      style={{
        borderRadius: radius.xl,
        borderWidth: s(1),
        borderColor: colors.accent + "55",
        backgroundColor: colors.accent + "0D",
        padding: s(12),
        gap: s(10),
      }}
    >
      {/* Name + badge row */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
        <Ionicons name="barbell-outline" size={s(16)} color={colors.accent} />
        <Text
          style={{
            flex: 1,
            color: colors.text,
            fontWeight: "900",
            fontSize: s(14),
          }}
        >
          {plan.name}
        </Text>
        <View
          style={{
            paddingHorizontal: s(8),
            paddingVertical: s(3),
            borderRadius: s(999),
            backgroundColor: colors.accent + "22",
          }}
        >
          <Text
            style={{ color: colors.accent, fontWeight: "800", fontSize: s(11) }}
          >
            {typeBadge}
          </Text>
        </View>
      </View>

      {/* Start date */}
      <Text style={{ color: colors.muted, fontWeight: "700", fontSize: s(12) }}>
        Started {startLabel}
      </Text>

      {/* Action buttons */}
      <View style={{ flexDirection: "row", gap: s(8), flexWrap: "wrap" }}>
        {(["Edit", "Regenerate", "Pause", "Delete"] as const).map((label) => {
          const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            Edit: "create-outline",
            Regenerate: "refresh-outline",
            Pause: "pause-circle-outline",
            Delete: "trash-outline",
          };
          const isDanger = label === "Delete";
          const handler =
            label === "Edit"
              ? onEdit
              : label === "Regenerate"
                ? onRegenerate
                : label === "Pause"
                  ? onPause
                  : onDelete;
          return (
            <Pressable
              key={label}
              onPress={handler}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: s(4),
                paddingHorizontal: s(10),
                paddingVertical: s(6),
                borderRadius: s(999),
                borderWidth: s(1),
                borderColor: isDanger ? "#ff6b6b55" : colors.border,
                backgroundColor: isDanger ? "#ff6b6b15" : colors.surface2,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons
                name={iconMap[label]}
                size={s(13)}
                color={isDanger ? "#ff6b6b" : colors.muted}
              />
              <Text
                style={{
                  color: isDanger ? "#ff6b6b" : colors.muted,
                  fontWeight: "700",
                  fontSize: s(12),
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── MiniCalendar ─────────────────────────────────────────────────────────────
function MiniCalendar({
  theme,
  value,
  onChange,
}: {
  theme: any;
  value: string;
  onChange: (date: string) => void;
}) {
  const pad2 = (n: number) => `${n < 10 ? "0" : ""}${n}`;
  const ymdParts = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
    return { y, m, d };
  };
  const toYMD = (y: number, m: number, d: number) =>
    `${y}-${pad2(m)}-${pad2(d)}`;
  const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const weekdayOf = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d).getDay();
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

  const monthLabel = new Date(curY, curM - 1, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={() => {
            const n = addMonths(curY, curM, -1);
            setCurY(n.y);
            setCurM(n.m);
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
          <Ionicons
            name="chevron-back"
            size={s(18)}
            color={theme.colors.text}
          />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            color: theme.colors.text,
            fontWeight: "900",
          }}
        >
          {monthLabel}
        </Text>
        <Pressable
          onPress={() => {
            const n = addMonths(curY, curM, 1);
            setCurY(n.y);
            setCurM(n.m);
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
          <Ionicons
            name="chevron-forward"
            size={s(18)}
            color={theme.colors.text}
          />
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
              const selected =
                day != null && curY === y && curM === m && day === d;
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
                    backgroundColor: selected
                      ? theme.colors.accent
                      : "transparent",
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: s(12),
  },
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
  sectionPill: {
    paddingVertical: s(6),
    paddingHorizontal: s(10),
    borderWidth: s(1),
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: s(10),
  },
});

function metaPill(colors: any, radius: any) {
  return {
    paddingVertical: s(4),
    paddingHorizontal: s(8),
    borderRadius: s(999),
    backgroundColor: "rgba(0,0,0,0.16)",
    borderWidth: s(1),
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
  } as const;
}
function metaText(colors: any) {
  return { color: colors.muted, fontWeight: "500", fontSize: s(11) } as const;
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
