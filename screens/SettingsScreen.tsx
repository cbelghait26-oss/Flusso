// screens/SettingsScreen.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { s } from "react-native-size-matters";
import * as ImagePicker from "expo-image-picker";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";

import { useTheme } from "../src/components/theme/theme";
import { TROPHY_TIERS, TROPHY_META } from "../src/context/AchievementContext";
import { useAchievements } from "../src/context/AchievementContext";
import {
  loadSetupName,
  saveSetupName,
  loadFocusMinutesToday,
  loadStreakDays,
  loadFocusSessions,
  updateLoginStreak,
  loadDailyGoal,
  saveDailyGoal,
  loadTasksCompletedToday,
  loadSetupData,
  saveSetupData,
  clearUserData,
  deleteAllCloudData,
  getCurrentUser,
  todayKey,
  loadTimeFormat24h,
  saveTimeFormat24h,
  loadProfilePicture,
  saveProfilePicture,
} from "../src/data/storage";
import { loadTasks, loadObjectives } from "../src/data/storage";
import type { Objective } from "../src/data/models";
import Svg, {
  Polyline,
  Circle,
  Line as SvgLine,
  Text as SvgText,
} from "react-native-svg";
import { auth } from "../src/services/firebase";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../src/navigation/types";
import {
  loadNotifSettings,
  saveNotifSettings,
  rescheduleAllNotifications,
  type NotifSettings,
  DEFAULT_NOTIF_SETTINGS,
} from "../src/services/notifications";

type TabKey = "profile" | "settings" | "achievements";

type Badge = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  total: number;
  progress: number;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function formatProgress(p: number, t: number) {
  if (t <= 0) return "";
  return `${Math.min(p, t)}/${t}`;
}

// ─── Initials Avatar ──────────────────────────────────────────────────────
function InitialsAvatar({
  name,
  accent,
  size = 46,
}: {
  name: string;
  accent: string;
  size?: number;
}) {
  const initials = name
    ? name
        .trim()
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("")
    : "?";
  return (
    <View
      style={{
        width: s(size),
        height: s(size),
        borderRadius: s(size * 0.38),
        backgroundColor: accent + "22",
        borderWidth: s(1.5),
        borderColor: accent + "44",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: accent, fontSize: s(size * 0.38), fontWeight: "900" }}>
        {initials}
      </Text>
    </View>
  );
}

// ─── ProfileAvatar (photo or initials) ───────────────────────────────────────
function ProfileAvatar({
  pic,
  name,
  accent,
  size = 46,
}: {
  pic?: string | null;
  name: string;
  accent: string;
  size?: number;
}) {
  if (pic) {
    return (
      <Image
        source={{ uri: `data:image/jpeg;base64,${pic}` }}
        style={{
          width: s(size),
          height: s(size),
          borderRadius: s(size * 0.38),
          borderWidth: s(1.5),
          borderColor: accent + "66",
        }}
      />
    );
  }
  return <InitialsAvatar name={name} accent={accent} size={size} />;
}

// ─── Color interpolation helper ───────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}
function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
      .join("")
  );
}
function lerpColorMulti(
  t: number,
  stops: { t: number; hex: string }[]
): string {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (clamped >= a.t && clamped <= b.t) {
      const local = (clamped - a.t) / (b.t - a.t);
      const [r1, g1, b1] = hexToRgb(a.hex);
      const [r2, g2, b2] = hexToRgb(b.hex);
      return rgbToHex(
        r1 + (r2 - r1) * local,
        g1 + (g2 - g1) * local,
        b1 + (b2 - b1) * local
      );
    }
  }
  return stops[stops.length - 1].hex;
}

// ─── Circular focus progress card ─────────────────────────────────────────────
const FIRE_STOPS = [
  { t: 0,    hex: "#1C7ED6" }, // cool blue
  { t: 0.35, hex: "#38BDF8" }, // sky
  { t: 0.6,  hex: "#F97316" }, // orange
  { t: 0.8,  hex: "#EF4444" }, // red
  { t: 1,    hex: "#FF3B30" }, // fire red
];

function FocusRingCard({
  focusMinToday,
  dailyFocusMinutes,
  C,
}: {
  focusMinToday: number;
  dailyFocusMinutes: number;
  C: any;
}) {
  const pct = dailyFocusMinutes > 0
    ? Math.min(100, Math.round((focusMinToday / dailyFocusMinutes) * 100))
    : 0;
  const ringColor = lerpColorMulti(pct / 100, FIRE_STOPS);

  const R = 22;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - pct / 100);

  return (
    <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.line }]}>
      <Svg width={s(56)} height={s(56)} viewBox="0 0 56 56">
        {/* Track */}
        <Circle
          cx={28} cy={28} r={R}
          stroke={C.muted + "28"}
          strokeWidth={4}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={28} cy={28} r={R}
          stroke={ringColor}
          strokeWidth={4}
          fill="none"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin="28,28"
        />
        {/* Percentage label */}
        <SvgText
          x={22} y={32}
          textAnchor="middle"
          fontSize={11}
          fontWeight="900"
          fill={ringColor}
        >
          {pct}%
        </SvgText>
      </Svg>
      <Text style={[styles.statLabel, { color: C.muted }]} numberOfLines={2}>
        Focus goal
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const { colors, isDark, themeMode, setThemeMode, accent, setAccent } = theme;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const { checkAchievements } = useAchievements();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [profileName, setProfileNameState] = useState<string>("");
  const [profileEmail, setProfileEmail] = useState<string>("");
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [focusMinToday, setFocusMinToday] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [focusSessionsCount, setFocusSessionsCount] = useState<number>(0);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [earlyBirdCount, setEarlyBirdCount] = useState<number>(0);
  const [nightOwlCount, setNightOwlCount] = useState<number>(0);
  const [marathon30Count, setMarathon30Count] = useState<number>(0);
  const [marathon120Count, setMarathon120Count] = useState<number>(0);
  const [marathon180Count, setMarathon180Count] = useState<number>(0);
  const [objectivesCompletedCount, setObjectivesCompletedCount] = useState<number>(0);
  const [dailyGoal, setDailyGoal] = useState<number>(5);
  const [tasksCompletedToday, setTasksCompletedToday] = useState<number>(0);
  const [dailyFocusMinutes, setDailyFocusMinutes] = useState<number>(60);

  // ── Weekly activity ──────────────────────────────────────────────────────
  type WeekDayData = { dateKey: string; label: string; focusMin: number; tasksDone: number; isToday: boolean; isFuture: boolean };
  const [weeklyData, setWeeklyData] = useState<WeekDayData[]>([]);

  // ── Delete account ────────────────────────────────────────────────────────
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeletionLoading, setShowDeletionLoading] = useState(false);

  // ── Settings toggles ──────────────────────────────────────────────────────
  const [notifSettings, setNotifSettings] = useState<NotifSettings>(DEFAULT_NOTIF_SETTINGS);
  const [weekStartsMonday, setWeekStartsMonday] = useState(true);
  const [timeFormat24h, setTimeFormat24h] = useState(false);
  const [notifExpanded, setNotifExpanded] = useState(false);

  // ── Profile picture ───────────────────────────────────────────────────────
  const [profilePic, setProfilePic] = useState<string | null>(null);

  // ── Edit profile modal ────────────────────────────────────────────────────
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [editNameDraft, setEditNameDraft] = useState("");
  const [editPicDraft, setEditPicDraft] = useState<string | null>(null);

  // ── Accent color picker sheet ─────────────────────────────────────────────
  const [accentSheetVisible, setAccentSheetVisible] = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
  }, []);
  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    const n = await loadSetupName();
    setProfileNameState(n || "");

    const currentUser = auth.currentUser;
    if (currentUser?.email) setProfileEmail(currentUser.email);

    const tasks = await loadTasks();
    setCompletedCount(tasks.filter((t: any) => t.status === "completed").length);

    const objs = await loadObjectives();
    setObjectives(objs);

    const fm = await loadFocusMinutesToday();
    setFocusMinToday(fm);

    const sd = await updateLoginStreak();
    setStreakDays(sd);

    const sessions = await loadFocusSessions();
    setFocusSessionsCount(sessions.length);

    const hr = (s: any) => parseInt(s.startTime?.split(":")[0] ?? "12", 10);
    setEarlyBirdCount(sessions.filter((s: any) => hr(s) < 8).length);
    setNightOwlCount(sessions.filter((s: any) => hr(s) >= 20).length);
    setMarathon30Count(sessions.filter((s: any) => s.minutes >= 30).length);
    setMarathon120Count(sessions.filter((s: any) => s.minutes >= 120).length);
    setMarathon180Count(sessions.filter((s: any) => s.minutes >= 180).length);
    setObjectivesCompletedCount(objs.filter((o: any) => o.status === "completed").length);

    const goal = await loadDailyGoal();
    setDailyGoal(goal);

    const completedToday = await loadTasksCompletedToday();
    setTasksCompletedToday(completedToday);

    const setupData = await loadSetupData();
    if (setupData?.targetMinutesPerDay) setDailyFocusMinutes(setupData.targetMinutesPerDay);

    const ns = await loadNotifSettings();
    setNotifSettings(ns);

    const fmt24h = await loadTimeFormat24h();
    setTimeFormat24h(fmt24h);

    const pic = await loadProfilePicture();
    setProfilePic(pic);

    // ── Weekly chart data ─────────────────────────────────────────────────
    const today = todayKey();
    const nowD = new Date();
    const dow = nowD.getDay(); // 0=Sun
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(nowD);
    monday.setDate(nowD.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
    const weekKeys = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return todayKey(d);
    });

    // focus minutes per date
    const focusMap: Record<string, number> = {};
    sessions.forEach((s: any) => { focusMap[s.date] = (focusMap[s.date] ?? 0) + s.minutes; });

    // tasks completed per date
    const taskMap: Record<string, number> = {};
    const allTasks = await loadTasks();
    allTasks.forEach((t: any) => {
      if (t.status === "completed" && t.completedAt) {
        const dk = todayKey(new Date(t.completedAt));
        taskMap[dk] = (taskMap[dk] ?? 0) + 1;
      }
    });

    setWeeklyData(weekKeys.map((dk, i) => ({
      dateKey: dk,
      label: DAY_LABELS[i],
      focusMin: focusMap[dk] ?? 0,
      tasksDone: taskMap[dk] ?? 0,
      isToday: dk === today,
      isFuture: dk > today,
    })));

    // Check achievements after every data load
    const uid = await getCurrentUser();
    if (uid) checkAchievements(uid);
  };

  // ── Delete account ────────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      Alert.alert("Password Required", "Please enter your password to confirm.");
      return;
    }
    setDeletingAccount(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        Alert.alert("Error", "No user is currently signed in.");
        setDeletingAccount(false);
        return;
      }
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);
      setDeleteModalVisible(false);
      setDeletePassword("");
      setShowDeletionLoading(true);
      await deleteAllCloudData();
      await clearUserData();
      await deleteUser(user);
      setShowDeletionLoading(false);
      setDeletingAccount(false);
      Alert.alert(
        "Account Deleted",
        "Your account and all data have been permanently deleted.",
        [{ text: "OK", onPress: () => navigation.navigate("SignIn") }]
      );
    } catch (error: any) {
      setShowDeletionLoading(false);
      setDeletingAccount(false);
      let msg = "An error occurred.";
      if (error.code === "auth/wrong-password") {
        msg = "Incorrect password. Please try again.";
        setDeleteModalVisible(true);
        setDeletePassword("");
      } else if (error.code === "auth/too-many-requests") {
        msg = "Too many attempts. Please try again later.";
      }
      Alert.alert("Delete Failed", msg);
    }
  };

  // ── Dark toggle ───────────────────────────────────────────────────────────
  const darkEnabled = themeMode === "system" ? isDark : themeMode === "dark";
  const toggleDark = () => setThemeMode(darkEnabled ? "light" : "dark");

  // ── Accent palette ────────────────────────────────────────────────────────
  const accentPalette = useMemo(
    () => [
      { hex: "#1C7ED6", label: "Ocean" },
      { hex: "#2EC4B6", label: "Teal" },
      { hex: "#38BDF8", label: "Sky" },
      { hex: "#22C55E", label: "Emerald" },
      { hex: "#A855F7", label: "Violet" },
      { hex: "#F97316", label: "Amber" },
      { hex: "#F43F5E", label: "Rose" },
      { hex: "#FACC15", label: "Gold" },
    ],
    []
  );

  // ── Build badges per tier (live progress) ────────────────────────────────
  const allBadges: Badge[] = useMemo(() => {
    return TROPHY_TIERS.flat().map((def) => ({
      id:       def.id,
      title:    def.title,
      subtitle: def.subtitle,
      icon:     def.icon,
      total:    def.total,
      progress: def.getProgress({
        completedCount, streakDays, focusSessionsCount,
        earlyBirdCount, nightOwlCount,
        marathon30Count, marathon120Count, marathon180Count,
        objectivesCompletedCount,
      }),
    }));
  }, [completedCount, streakDays, focusSessionsCount, earlyBirdCount, nightOwlCount,
      marathon30Count, marathon120Count, marathon180Count, objectivesCompletedCount]);

  // Derive which tier is currently active
  const activeTierIndex = useMemo(() => {
    for (let t = 0; t < TROPHY_TIERS.length; t++) {
      const tierBadges = allBadges.slice(t * 7, t * 7 + 7);
      if (tierBadges.some((b) => b.progress < b.total)) return t;
    }
    return TROPHY_TIERS.length - 1; // all done, show last
  }, [allBadges]);

  const completedTierCount = useMemo(() => {
    let count = 0;
    for (let t = 0; t < TROPHY_TIERS.length; t++) {
      const tierBadges = allBadges.slice(t * 7, t * 7 + 7);
      if (tierBadges.every((b) => b.progress >= b.total)) count = t + 1;
      else break;
    }
    return count;
  }, [allBadges]);

  const [viewingTier, setViewingTier] = useState<number | null>(null);
  const displayedTier = viewingTier ?? activeTierIndex;
  const displayedBadges = allBadges.slice(displayedTier * 7, displayedTier * 7 + 7);
  const totalUnlocked = allBadges.filter((b) => b.progress >= b.total).length;

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "profile", label: "Profile", icon: "person-circle-outline" },
    { key: "settings", label: "Settings", icon: "settings-outline" },
    { key: "achievements", label: "Achievements", icon: "trophy-outline" },
  ];
  const [tab, setTab] = useState<TabKey>("settings");

  // ── Name editor ───────────────────────────────────────────────────────────
  const [nameModal, setNameModal] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const openNameEditor = () => {
    if (Platform.OS === "ios" && (Alert as any).prompt) {
      (Alert as any).prompt(
        "Edit name",
        "This is shown on your profile.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: async (value: string) => {
              const v = (value ?? "").trim();
              setProfileNameState(v);
              await saveSetupName(v);
            },
          },
        ],
        "plain-text",
        profileName
      );
      return;
    }
    setNameDraft(profileName);
    setNameModal(true);
  };

  const saveNameAndroid = async () => {
    const v = nameDraft.trim();
    setProfileNameState(v);
    setNameModal(false);
    await saveSetupName(v);
  };

  // ── Daily focus goal editor ──────────────────────────────────────────────
  const [focusGoalModal, setFocusGoalModal] = useState(false);
  const [focusGoalDraft, setFocusGoalDraft] = useState("60");

  const FOCUS_GOAL_PRESETS = [
    { minutes: 30,  label: "Casual",     sub: "30 min/day" },
    { minutes: 60,  label: "Regular",    sub: "60 min/day" },
    { minutes: 120, label: "Serious",    sub: "120 min/day" },
    { minutes: 180, label: "Determined", sub: "180 min/day" },
  ];

  const openFocusGoalEditor = () => {
    if (Platform.OS === "ios" && (Alert as any).prompt) {
      (Alert as any).prompt(
        "Daily focus goal",
        "Minutes of focus per day? (30, 60, 120 or 180 recommended)",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: async (value: string) => {
              const num = parseInt(value ?? "", 10);
              if (num >= 5 && num <= 480) {
                setDailyFocusMinutes(num);
                const current = await loadSetupData();
                await saveSetupData({ ...(current ?? {}), targetMinutesPerDay: num });
              } else {
                Alert.alert("Invalid", "Enter a value between 5 and 480 minutes.");
              }
            },
          },
        ],
        "plain-text",
        String(dailyFocusMinutes)
      );
      return;
    }
    setFocusGoalDraft(String(dailyFocusMinutes));
    setFocusGoalModal(true);
  };

  const saveFocusGoalAndroid = async (minutes: number) => {
    setDailyFocusMinutes(minutes);
    setFocusGoalModal(false);
    const current = await loadSetupData();
    await saveSetupData({ ...(current ?? {}), targetMinutesPerDay: minutes });
  };

  const [goalDraft, setGoalDraft] = useState("");
  const [goalModal, setGoalModal] = useState(false);

  const openGoalEditor = () => {
    if (Platform.OS === "ios" && (Alert as any).prompt) {
      (Alert as any).prompt(
        "Daily task goal",
        "How many tasks per day?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: async (value: string) => {
              const num = parseInt(value ?? "", 10);
              if (num > 0 && num <= 100) {
                setDailyGoal(num);
                await saveDailyGoal(num);
              } else {
                Alert.alert("Invalid", "Enter a number between 1 and 100.");
              }
            },
          },
        ],
        "plain-text",
        String(dailyGoal)
      );
      return;
    }
    setGoalDraft(String(dailyGoal));
    setGoalModal(true);
  };

  const saveGoalAndroid = async () => {
    const num = parseInt(goalDraft, 10);
    if (num > 0 && num <= 100) {
      setDailyGoal(num);
      setGoalModal(false);
      await saveDailyGoal(num);
    } else {
      Alert.alert("Invalid", "Enter a number between 1 and 100.");
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    Alert.alert("Log out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          try {
            await clearUserData();
            await auth.signOut();
            navigation.reset({ index: 0, routes: [{ name: "SignIn" }] });
          } catch {
            Alert.alert("Error", "Failed to log out. Please try again.");
          }
        },
      },
    ]);
  };

  const copyEmail = () => {
    if (profileEmail) {
      Clipboard.setString(profileEmail);
      Alert.alert("Copied", "Email copied to clipboard.");
    }
  };

  // ── Color aliases ─────────────────────────────────────────────────────────
  const C = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      card2: (colors as any).card2 ?? (isDark ? "#1a1a2e" : "#f5f5f7"),
      text: colors.text,
      muted: colors.muted,
      line: colors.border,
      accent: colors.accent,
      success: (colors as any).success ?? "#2EC4B6",
      danger: "#FF3B30",
    }),
    [colors, isDark]
  );

  // ── Tab bar animation ─────────────────────────────────────────────────────
  const tabAnim = useRef(
    new Animated.Value(tabs.findIndex((t) => t.key === tab))
  ).current;

  useEffect(() => {
    Animated.spring(tabAnim, {
      toValue: tabs.findIndex((t) => t.key === tab),
      useNativeDriver: true,
      stiffness: 260,
      damping: 30,
      mass: 0.85,
    }).start();
  }, [tab]);

  const segW = Math.min(width - s(32), 480);
  const segItemW = segW / tabs.length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]} edges={["top", "left", "right"]}>

      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.pageTitle, { color: C.text }]}>Account</Text>
          <Text style={[styles.pageSubtitle, { color: C.muted }]}>
            {profileName || profileEmail || "Your profile & settings"}
          </Text>
        </View>
        <ProfileAvatar pic={profilePic} name={profileName} accent={C.accent} size={40} />
      </View>

      {/* ══ Segmented tabs ══ */}
      <View style={[styles.tabBar, { backgroundColor: C.card, borderColor: C.line }]}>
        <Animated.View
          style={[
            styles.tabPill,
            {
              backgroundColor: C.accent + "18",
              width: segItemW - s(6),
              transform: [
                {
                  translateX: tabAnim.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [s(3), segItemW + s(3), segItemW * 2 + s(3)],
                  }),
                },
              ],
            },
          ]}
        />
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                flex: 1,
                paddingVertical: s(10),
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: s(5),
              }}
            >
              <Ionicons name={t.icon} size={s(15)} color={active ? C.accent : C.muted} />
              <Text
                style={{
                  fontSize: s(12),
                  fontWeight: active ? "800" : "600",
                  color: active ? C.accent : C.muted,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ══════════════════════════════════════════════════════════
          PROFILE TAB
      ══════════════════════════════════════════════════════════ */}
      {tab === "profile" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Identity card */}
          <View style={[styles.identityCard, { backgroundColor: C.card, borderColor: C.line }]}>
            <Pressable
              onPress={() => { setEditNameDraft(profileName); setEditPicDraft(profilePic); setEditProfileModal(true); }}
            >
              <ProfileAvatar pic={profilePic} name={profileName} accent={C.accent} size={56} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.identityName, { color: C.text }]} numberOfLines={2}>
                {profileName || "Your name"}
              </Text>
              <Pressable
                onPress={copyEmail}
                onLongPress={copyEmail}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: s(4),
                  marginTop: s(2),
                }}
              >
                <Text
                  style={[styles.identityEmail, { color: C.muted }]}
                  numberOfLines={1}
                >
                  {profileEmail || "No email set"}
                </Text>
                {!!profileEmail && (
                  <Ionicons name="copy-outline" size={s(12)} color={C.muted} />
                )}
              </Pressable>
            </View>
            <Pressable
              onPress={() => { setEditNameDraft(profileName); setEditPicDraft(profilePic); setEditProfileModal(true); }}
              style={[
                styles.editBtn,
                { backgroundColor: C.accent + "16", borderColor: C.accent + "30" },
              ]}
            >
              <Ionicons name="pencil" size={s(12)} color={C.accent} />
              <Text style={{ color: C.accent, fontSize: s(11), fontWeight: "800" }}>Edit</Text>
            </Pressable>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <FocusRingCard
              focusMinToday={focusMinToday}
              dailyFocusMinutes={dailyFocusMinutes}
              C={C}
            />
            <StatCard
              value={`${streakDays}d`}
              label={"Streak"}
              icon="flame-outline"
              C={C}
              iconColor="#F97316"
            />
            <StatCard
              value={`${focusMinToday}m`}
              label={"Focus\ntime"}
              icon="time-outline"
              C={C}
              iconColor={C.success}
            />
            <StatCard
              value={`${completedCount}`}
              label={"Tasks\ndone"}
              icon="checkmark-done-outline"
              C={C}
              iconColor={C.accent}
            />
          </View>

          {/* Activity chart */}
          <SectionHeader title="This week's activity" C={C} />
          <WeeklyActivityChart data={weeklyData} C={C} />
        </ScrollView>
      )}

      {/* ══════════════════════════════════════════════════════════
          SETTINGS TAB
      ══════════════════════════════════════════════════════════ */}
      {tab === "settings" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ACCOUNT */}
          <SectionHeader title="Account" C={C} />
          <View style={[styles.listCard, { backgroundColor: C.card, borderColor: C.line }]}>
            <ActionRow
              icon="person-outline"
              label="Name"
              value={profileName || "Set name"}
              C={C}
              onPress={openNameEditor}
            />
            <Divider C={C} />
            <ActionRow
              icon="mail-outline"
              label="Email"
              value={profileEmail ? "Tap to copy" : "Not set"}
              C={C}
              onPress={copyEmail}
              showChevron={false}
              right={<Ionicons name="copy-outline" size={s(16)} color={C.muted} />}
            />
            <Divider C={C} />
            {/* Notifications – expandable chevron row */}
            <Pressable
              onPress={() => setNotifExpanded((v) => !v)}
              style={styles.settingsRow}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: C.muted + "14" }]}>
                  <Ionicons name="notifications-outline" size={s(16)} color={C.muted} />
                </View>
                <Text style={[styles.rowLabel, { color: C.text }]}>Notifications</Text>
              </View>
              <Ionicons
                name={notifExpanded ? "chevron-down" : "chevron-forward"}
                size={s(16)}
                color={C.muted}
              />
            </Pressable>
            {notifExpanded && (
              <>
                {!notifSettings.master && (
                  <View
                    style={[
                      styles.notifWarning,
                      { backgroundColor: "#F97316" + "12", borderColor: "#F97316" + "30" },
                    ]}
                  >
                    <Ionicons name="warning-outline" size={s(14)} color="#F97316" />
                    <Text style={{ color: "#F97316", fontSize: s(12), fontWeight: "700", flex: 1 }}>
                      Notifications are disabled. Enable them in Settings to receive reminders.
                    </Text>
                  </View>
                )}
                {([
                  { key: "master"          as const, label: "Enable all",           icon: "notifications-circle-outline" },
                  { key: "focus"           as const, label: "Focus & breaks",        icon: "timer-outline"                },
                  { key: "tasks"           as const, label: "Task reminders",        icon: "checkmark-circle-outline"     },
                  { key: "calendar"        as const, label: "Calendar events",       icon: "calendar-outline"             },
                  { key: "dailySummaries"  as const, label: "Morning agenda",        icon: "sunny-outline"                },
                  { key: "tomorrowPreview" as const, label: "Tomorrow preview",      icon: "moon-outline"                 },
                  { key: "coach"           as const, label: "Coach suggestions",     icon: "bulb-outline"                 },
                ] as { key: keyof NotifSettings; label: string; icon: any }[]).map((row) => (
                  <React.Fragment key={row.key}>
                    <Divider C={C} />
                    <View
                      style={[
                        styles.settingsRow,
                        { paddingLeft: s(12) },
                        row.key !== "master" && !notifSettings.master && { opacity: 0.4 },
                      ]}
                    >
                      <View style={styles.rowLeft}>
                        <View style={[styles.iconWrap, { backgroundColor: C.accent + "10" }]}>
                          <Ionicons name={row.icon} size={s(16)} color={C.accent} />
                        </View>
                        <View>
                          <Text style={[styles.rowLabel, { color: C.text }]}>{row.label}</Text>
                          {row.key === "coach" && (
                            <Text style={{ color: C.muted, fontSize: s(10), fontWeight: "600" }}>Off by default</Text>
                          )}
                        </View>
                      </View>
                      <Switch
                        style={{ marginTop: s(12) }}
                        disabled={row.key !== "master" && !notifSettings.master}
                        value={notifSettings[row.key] as boolean}
                        onValueChange={async (v) => {
                          const next = { ...notifSettings, [row.key]: v };
                          setNotifSettings(next);
                          await saveNotifSettings(next);
                          await rescheduleAllNotifications();
                        }}
                        trackColor={{ false: C.line, true: C.accent + "88" }}
                        thumbColor={(notifSettings[row.key] as boolean) ? C.accent : C.muted}
                      />
                    </View>
                  </React.Fragment>
                ))}
              </>
            )}
          </View>

          {/* APPEARANCE */}
          <SectionHeader title="Appearance" C={C} />
          <View style={[styles.listCard, { backgroundColor: C.card, borderColor: C.line }]}>
            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: C.muted + "14" }]}>
                  <Ionicons name="contrast-outline" size={s(16)} color={C.muted} />
                </View>
                <Text style={[styles.rowLabel, { color: C.text }]}>Dark mode</Text>
              </View>
              <Switch
                style={{ marginTop: s(12) }}
                value={darkEnabled}
                onValueChange={toggleDark}
                trackColor={{ false: C.line, true: C.accent + "88" }}
                thumbColor={darkEnabled ? C.accent : C.muted}
              />
            </View>
            <Divider C={C} />
            <Pressable onPress={() => setAccentSheetVisible(true)} style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: C.muted + "14" }]}>
                  <Ionicons name="color-palette-outline" size={s(16)} color={C.muted} />
                </View>
                <Text style={[styles.rowLabel, { color: C.text }]}>Accent color</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
                <View
                  style={{
                    width: s(22),
                    height: s(22),
                    borderRadius: s(8),
                    backgroundColor: C.accent,
                  }}
                />
                <Ionicons name="chevron-forward" size={s(16)} color={C.muted} />
              </View>
            </Pressable>
            <Divider C={C} />
            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: C.muted + "14" }]}>
                  <Ionicons name="time-outline" size={s(16)} color={C.muted} />
                </View>
                <Text style={[styles.rowLabel, { color: C.text }]}>24-hour time</Text>
              </View>
              <Switch
                style={{ marginTop: s(12) }}
                value={timeFormat24h}
                onValueChange={async (v) => {
                  setTimeFormat24h(v);
                  await saveTimeFormat24h(v);
                }}
                trackColor={{ false: C.line, true: C.accent + "88" }}
                thumbColor={timeFormat24h ? C.accent : C.muted}
              />
            </View>
          </View>

          {/* ABOUT */}
          <SectionHeader title="About" C={C} />
          <View style={[styles.listCard, { backgroundColor: C.card, borderColor: C.line }]}>
            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: C.muted + "14" }]}>
                  <Ionicons
                    name="information-circle-outline"
                    size={s(16)}
                    color={C.muted}
                  />
                </View>
                <Text style={[styles.rowLabel, { color: C.text }]}>Version</Text>
              </View>
              <Text style={[styles.rowValue, { color: C.muted }]}>1.0.0 (1)</Text>
            </View>
            <Divider C={C} />
            <ActionRow
              icon="shield-checkmark-outline"
              label="Privacy policy"
              C={C}
              onPress={() => Alert.alert("Privacy Policy", "Coming soon.")}
            />
            <Divider C={C} />
            <ActionRow
              icon="document-text-outline"
              label="Terms and conditions"
              C={C}
              onPress={() => Alert.alert("Terms and Conditions", "Coming soon.")}
            />
            <Divider C={C} />
            <ActionRow
              icon="chatbubble-ellipses-outline"
              label="Contact support"
              C={C}
              onPress={() =>
                Linking.openURL(
                  "mailto:admin@flussoapp.com?subject=Flusso%20Support&body=For%20any%20question%20or%20to%20report%20a%20bug%2C%20please%20contact%20us%20at%20admin%40flussoapp.com"
                )
              }
            />
          </View>

          {/* DANGER ZONE */}
          <SectionHeader title="Danger zone" C={C} />
          <View style={[styles.listCard, { backgroundColor: C.card, borderColor: C.line }]}>
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [styles.settingsRow, { opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: C.danger + "14" }]}>
                  <Ionicons name="log-out-outline" size={s(16)} color={C.danger} />
                </View>
                <Text style={[styles.rowLabel, { color: C.danger }]}>Log out</Text>
              </View>
            </Pressable>
            <Divider C={C} />
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Delete Account",
                  "This will permanently delete your account and all data. This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Continue",
                      style: "destructive",
                      onPress: () => setDeleteModalVisible(true),
                    },
                  ]
                )
              }
              style={({ pressed }) => [styles.settingsRow, { opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: C.danger + "14" }]}>
                  <Ionicons name="warning-outline" size={s(16)} color={C.danger} />
                </View>
                <Text style={[styles.rowLabel, { color: C.danger }]}>Delete account</Text>
              </View>
            </Pressable>
          </View>

          {/* BLG GROUP */}
          <View style={{ alignItems: "center", paddingVertical: s(20), gap: s(4) }}>
            <Text style={{ color: C.muted, fontSize: s(11), fontWeight: "700", letterSpacing: 1.5 }}>
              BLG GROUP
            </Text>
            <Text style={{ color: C.muted, fontSize: s(10), fontWeight: "500" }}>
              Flusso · All rights reserved
            </Text>
          </View>

          <View style={{ height: s(16) }} />
        </ScrollView>
      )}

      {/* ══════════════════════════════════════════════════════════
          ACHIEVEMENTS TAB
      ══════════════════════════════════════════════════════════ */}
      {tab === "achievements" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Trophy shelf ──────────────────────────────────────── */}
          <View style={[styles.achieveSummary, { backgroundColor: C.card, borderColor: C.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.achieveTitle, { color: C.text }]}>
                {totalUnlocked}/{TROPHY_TIERS.flat().length} badges · {completedTierCount}/5 trophies
              </Text>
              <Text style={[styles.achieveSub, { color: C.muted }]}>
                Complete all 7 badges in a tier to earn a trophy
              </Text>
            </View>
            <View style={[styles.achieveBadge, { backgroundColor: C.accent + "18", borderColor: C.accent + "30" }]}>
              <Ionicons name="trophy" size={s(22)} color={C.accent} />
            </View>
          </View>

          {/* Trophy row */}
          <View style={{ flexDirection: "row", gap: s(8), marginBottom: s(4), marginTop: s(8) }}>
            {TROPHY_META.map((meta, t) => {
              const earned  = t < completedTierCount;
              const current = t === activeTierIndex && !earned;
              const viewing = t === displayedTier;
              return (
                <Pressable
                  key={t}
                  onPress={() => setViewingTier(viewing ? null : t)}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: s(10),
                    borderRadius: s(14),
                    borderWidth: s(1.5),
                    borderColor: viewing
                      ? meta.color
                      : earned
                      ? meta.color + "55"
                      : C.line,
                    backgroundColor: viewing
                      ? meta.color + "18"
                      : earned
                      ? meta.color + "10"
                      : C.card + "88",
                    opacity: pressed ? 0.75 : 1,
                    gap: s(4),
                  })}
                >
                  <Ionicons
                    name={meta.icon}
                    size={s(22)}
                    color={earned || current ? meta.color : C.muted + "60"}
                  />
                  {earned && (
                    <View style={{
                      position: "absolute", top: s(4), right: s(4),
                      backgroundColor: meta.color,
                      borderRadius: s(6), width: s(10), height: s(10),
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Ionicons name="checkmark" size={s(7)} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Tier name + progress */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: s(4) }}>
            <Text style={{ color: C.muted, fontSize: s(11), fontWeight: "700", letterSpacing: 0.8 }}>
              {TROPHY_META[displayedTier].name.toUpperCase()}
            </Text>
            <Text style={{ color: C.muted, fontSize: s(11), fontWeight: "700" }}>
              {displayedBadges.filter((b) => b.progress >= b.total).length}/7
            </Text>
          </View>

          {/* Badges for displayed tier */}
          <View style={[styles.listCard, { backgroundColor: C.card, borderColor: C.line }]}>
            {displayedBadges.map((badge, i) => {
              const done  = badge.progress >= badge.total;
              const ratio = badge.total > 0 ? clamp01(badge.progress / badge.total) : 0;
              const locked = displayedTier > activeTierIndex && !done;
              return (
                <React.Fragment key={badge.id}>
                  {i > 0 && <Divider C={C} />}
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        badge.title,
                        done
                          ? "Unlocked! 🎉"
                          : locked
                          ? "Complete the current tier first."
                          : `${badge.subtitle}\n\nProgress: ${formatProgress(badge.progress, badge.total)}`
                      )
                    }
                    style={({ pressed }) => [styles.inProgressRow, { opacity: pressed ? 0.8 : locked ? 0.4 : 1 }]}
                  >
                    <View
                      style={[
                        styles.badgeIcon,
                        done
                          ? { backgroundColor: TROPHY_META[displayedTier].color + "22", borderColor: TROPHY_META[displayedTier].color + "44" }
                          : { backgroundColor: C.muted + "12", borderColor: C.line },
                      ]}
                    >
                      <Ionicons
                        name={done ? badge.icon : locked ? "lock-closed-outline" : badge.icon}
                        size={s(18)}
                        color={done ? TROPHY_META[displayedTier].color : C.muted}
                      />
                    </View>
                    <View style={{ flex: 1, gap: s(3) }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={[styles.badgeTitle, { color: done ? C.text : C.muted }]}>
                          {badge.title}
                        </Text>
                        <Text style={{ fontSize: s(11), fontWeight: "800", color: done ? TROPHY_META[displayedTier].color : C.muted }}>
                          {done ? "✓" : formatProgress(badge.progress, badge.total)}
                        </Text>
                      </View>
                      <Text style={[styles.badgeSub, { color: C.muted }]} numberOfLines={1}>
                        {badge.subtitle}
                      </Text>
                      {!done && !locked && (
                        <View style={[styles.miniProgressTrack, { backgroundColor: C.muted + "20" }]}>
                          <View
                            style={[styles.miniProgressFill, {
                              width: `${Math.round(ratio * 100)}%`,
                              backgroundColor: TROPHY_META[displayedTier].color,
                            }]}
                          />
                        </View>
                      )}
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>

          <View style={{ height: s(32) }} />
        </ScrollView>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════ */}

      {/* Accent color sheet */}
      <Modal
        visible={accentSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAccentSheetVisible(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setAccentSheetVisible(false)}
        />
        <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.line }]}>
          <View style={[styles.sheetHandle, { backgroundColor: C.line }]} />
          <Text style={[styles.sheetTitle, { color: C.text }]}>Accent color</Text>
          <Text style={[styles.sheetSub, { color: C.muted }]}>
            Choose a color for buttons, highlights, and indicators.
          </Text>
          <View style={styles.colorGrid}>
            {accentPalette.map(({ hex, label }) => {
              const selected = hex.toLowerCase() === (accent || "").toLowerCase();
              return (
                <Pressable
                  key={hex}
                  onPress={() => {
                    setAccent(hex);
                    setAccentSheetVisible(false);
                  }}
                  style={({ pressed }) => [
                    styles.colorSwatch,
                    {
                      backgroundColor: hex,
                      opacity: pressed ? 0.85 : 1,
                      borderWidth: selected ? s(2.5) : s(1),
                      borderColor: selected ? "#fff" : hex + "44",
                    },
                  ]}
                >
                  {selected && <Ionicons name="checkmark" size={s(18)} color="#fff" />}
                  <Text style={styles.colorLabel}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Android name modal */}
      <SimpleModal visible={nameModal} onClose={() => setNameModal(false)} C={C}>
        <Text style={[styles.modalTitle, { color: C.text }]}>Edit name</Text>
        <Text style={[styles.modalSub, { color: C.muted }]}>
          This is shown on your profile.
        </Text>
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Your name"
          placeholderTextColor={C.muted}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={saveNameAndroid}
          style={[
            styles.modalInput,
            { color: C.text, borderColor: C.line, backgroundColor: C.card2 },
          ]}
        />
        <View style={styles.modalActions}>
          <Pressable
            onPress={() => setNameModal(false)}
            style={[styles.modalCancelBtn, { borderColor: C.line }]}
          >
            <Text style={[styles.modalBtnText, { color: C.muted }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={saveNameAndroid}
            style={[styles.modalPrimaryBtn, { backgroundColor: C.accent }]}
          >
            <Text style={[styles.modalBtnText, { color: "#fff" }]}>Save</Text>
          </Pressable>
        </View>
      </SimpleModal>

      {/* Android goal modal */}
      <SimpleModal visible={goalModal} onClose={() => setGoalModal(false)} C={C}>
        <Text style={[styles.modalTitle, { color: C.text }]}>Daily task goal</Text>
        <Text style={[styles.modalSub, { color: C.muted }]}>
          How many tasks do you want to complete each day?
        </Text>
        <TextInput
          value={goalDraft}
          onChangeText={setGoalDraft}
          placeholder="5"
          placeholderTextColor={C.muted}
          keyboardType="number-pad"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={saveGoalAndroid}
          style={[
            styles.modalInput,
            { color: C.text, borderColor: C.line, backgroundColor: C.card2 },
          ]}
        />
        <View style={styles.modalActions}>
          <Pressable
            onPress={() => setGoalModal(false)}
            style={[styles.modalCancelBtn, { borderColor: C.line }]}
          >
            <Text style={[styles.modalBtnText, { color: C.muted }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={saveGoalAndroid}
            style={[styles.modalPrimaryBtn, { backgroundColor: C.accent }]}
          >
            <Text style={[styles.modalBtnText, { color: "#fff" }]}>Save</Text>
          </Pressable>
        </View>
      </SimpleModal>

      {/* Android focus goal modal */}
      <SimpleModal visible={focusGoalModal} onClose={() => setFocusGoalModal(false)} C={C}>
        <Text style={[styles.modalTitle, { color: C.text }]}>Daily focus goal</Text>
        <Text style={[styles.modalSub, { color: C.muted }]}>
          How many minutes do you want to focus each day?
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(8), marginTop: s(6) }}>
          {FOCUS_GOAL_PRESETS.map(({ minutes, label, sub }) => {
            const sel = dailyFocusMinutes === minutes;
            return (
              <Pressable
                key={minutes}
                onPress={() => saveFocusGoalAndroid(minutes)}
                style={({ pressed }) => [{
                  flex: 1,
                  minWidth: "44%",
                  paddingVertical: s(12),
                  paddingHorizontal: s(12),
                  borderRadius: s(12),
                  borderWidth: s(1.5),
                  borderColor: sel ? C.accent : C.line,
                  backgroundColor: sel ? C.accent + "18" : C.card2,
                  opacity: pressed ? 0.8 : 1,
                  gap: s(2),
                }]}
              >
                <Text style={{ color: sel ? C.accent : C.text, fontWeight: "800", fontSize: s(13) }}>{label}</Text>
                <Text style={{ color: C.muted, fontWeight: "600", fontSize: s(11) }}>{sub}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => setFocusGoalModal(false)}
          style={[styles.modalCancelBtn, { borderColor: C.line, marginTop: s(10), alignSelf: "flex-end" }]}
        >
          <Text style={[styles.modalBtnText, { color: C.muted }]}>Cancel</Text>
        </Pressable>
      </SimpleModal>

      {/* Edit profile modal */}
      <Modal
        visible={editProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditProfileModal(false)}
      >
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setEditProfileModal(false)} />
          <View
            style={{
              backgroundColor: C.card,
              borderTopLeftRadius: s(24),
              borderTopRightRadius: s(24),
              padding: s(24),
              paddingBottom: s(40),
              gap: s(20),
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: C.text, fontSize: s(17), fontWeight: "900" }}>Edit Profile</Text>
              <Pressable onPress={() => setEditProfileModal(false)}>
                <Ionicons name="close" size={s(22)} color={C.muted} />
              </Pressable>
            </View>

            {/* Avatar picker */}
            <View style={{ alignItems: "center", gap: s(10) }}>
              <Pressable
                onPress={() => {
                  Alert.alert("Profile Photo", "Choose an option", [
                    {
                      text: "Take Photo",
                      onPress: async () => {
                        const perm = await ImagePicker.requestCameraPermissionsAsync();
                        if (!perm.granted) { Alert.alert("Permission required", "Camera access was denied."); return; }
                        const result = await ImagePicker.launchCameraAsync({
                          base64: true,
                          quality: 0.3,
                          allowsEditing: true,
                          aspect: [1, 1],
                        });
                        if (!result.canceled && result.assets[0].base64) {
                          setEditPicDraft(result.assets[0].base64);
                        }
                      },
                    },
                    {
                      text: "Choose from Library",
                      onPress: async () => {
                        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (!perm.granted) { Alert.alert("Permission required", "Photo library access was denied."); return; }
                        const result = await ImagePicker.launchImageLibraryAsync({
                          base64: true,
                          quality: 0.3,
                          allowsEditing: true,
                          aspect: [1, 1],
                        });
                        if (!result.canceled && result.assets[0].base64) {
                          setEditPicDraft(result.assets[0].base64);
                        }
                      },
                    },
                    editPicDraft
                      ? {
                          text: "Remove Photo",
                          style: "destructive",
                          onPress: () => setEditPicDraft(null),
                        }
                      : { text: "Cancel", style: "cancel" },
                    editPicDraft ? { text: "Cancel", style: "cancel" } : undefined,
                  ].filter(Boolean) as any[]);
                }}
              >
                <ProfileAvatar pic={editPicDraft} name={editNameDraft || profileName} accent={C.accent} size={80} />
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    backgroundColor: C.accent,
                    borderRadius: s(12),
                    padding: s(4),
                  }}
                >
                  <Ionicons name="camera" size={s(13)} color="#fff" />
                </View>
              </Pressable>
              <Text style={{ color: C.muted, fontSize: s(11), fontWeight: "600" }}>Tap to change photo</Text>
            </View>

            {/* Name field */}
            <View style={{ gap: s(6) }}>
              <Text style={{ color: C.muted, fontSize: s(11), fontWeight: "700", letterSpacing: 0.8 }}>DISPLAY NAME</Text>
              <TextInput
                value={editNameDraft}
                onChangeText={setEditNameDraft}
                placeholder="Your name"
                placeholderTextColor={C.muted + "88"}
                style={{
                  backgroundColor: C.bg,
                  color: C.text,
                  fontSize: s(15),
                  fontWeight: "700",
                  borderRadius: s(12),
                  borderWidth: s(1),
                  borderColor: C.line,
                  paddingHorizontal: s(14),
                  paddingVertical: s(12),
                }}
                returnKeyType="done"
              />
            </View>

            {/* Save button */}
            <Pressable
              onPress={async () => {
                const v = editNameDraft.trim();
                setProfileNameState(v);
                await saveSetupName(v);
                setProfilePic(editPicDraft);
                if (editPicDraft !== profilePic) {
                  await saveProfilePicture(editPicDraft);
                }
                setEditProfileModal(false);
              }}
              style={{
                backgroundColor: C.accent,
                borderRadius: s(14),
                paddingVertical: s(14),
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: s(15), fontWeight: "900" }}>Save changes</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Delete account confirmation */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingAccount) {
            setDeleteModalVisible(false);
            setDeletePassword("");
          }
        }}
      >
        <View
          style={[
            styles.sheetBackdrop,
            { alignItems: "center", justifyContent: "center", padding: s(20) },
          ]}
        >
          <View style={[styles.modalCard, { backgroundColor: C.card, borderColor: C.line }]}>
            <View style={{ alignItems: "center", marginBottom: s(14) }}>
              <View
                style={[styles.dangerIconWrap, { backgroundColor: C.danger + "18" }]}
              >
                <Ionicons name="warning" size={s(28)} color={C.danger} />
              </View>
              <Text
                style={[
                  styles.modalTitle,
                  { color: C.text, marginTop: s(12), textAlign: "center" },
                ]}
              >
                Delete account
              </Text>
              <Text
                style={[
                  styles.modalSub,
                  { color: C.muted, textAlign: "center", marginTop: s(6) },
                ]}
              >
                Enter your password to permanently delete your account and all data. This
                cannot be undone.
              </Text>
            </View>
            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Enter your password"
              placeholderTextColor={C.muted}
              secureTextEntry
              autoCapitalize="none"
              editable={!deletingAccount}
              style={[
                styles.modalInput,
                { color: C.text, borderColor: C.line, backgroundColor: C.card2 },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setDeleteModalVisible(false);
                  setDeletePassword("");
                }}
                disabled={deletingAccount}
                style={[styles.modalCancelBtn, { borderColor: C.line }]}
              >
                <Text style={[styles.modalBtnText, { color: C.muted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteAccount}
                disabled={deletingAccount || !deletePassword.trim()}
                style={[
                  styles.modalPrimaryBtn,
                  {
                    backgroundColor: C.danger,
                    opacity: deletingAccount || !deletePassword.trim() ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  {deletingAccount ? "Deleting..." : "Delete"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Deletion loading */}
      <Modal visible={showDeletionLoading} transparent animationType="fade">
        <View style={[styles.loadingScreen, { backgroundColor: C.bg }]}>
          <ActivityIndicator size="large" color={C.danger} />
          <Text style={[styles.loadingTitle, { color: C.text }]}>Deleting account…</Text>
          <Text style={[styles.loadingSub, { color: C.muted }]}>
            Permanently removing your account and all data.
          </Text>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function SectionHeader({ title, C }: { title: string; C: any }) {
  return (
    <Text style={[styles.sectionHeader, { color: C.muted }]}>
      {title.toUpperCase()}
    </Text>
  );
}

function Divider({ C }: { C: any }) {
  return <View style={[styles.divider, { backgroundColor: C.line }]} />;
}

function ActionRow({
  icon,
  label,
  value,
  C,
  onPress,
  showChevron = true,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  C: any;
  onPress: () => void;
  showChevron?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        { backgroundColor: pressed ? C.muted + "08" : "transparent" },
      ]}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.iconWrap, { backgroundColor: C.muted + "14" }]}>
          <Ionicons name={icon} size={s(16)} color={C.muted} />
        </View>
        <Text style={[styles.rowLabel, { color: C.text }]}>{label}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}>
        {!!value && (
          <Text style={[styles.rowValue, { color: C.muted }]} numberOfLines={1}>
            {value}
          </Text>
        )}
        {right}
        {showChevron && (
          <Ionicons name="chevron-forward" size={s(15)} color={C.muted + "80"} />
        )}
      </View>
    </Pressable>
  );
}

function StatCard({
  value,
  label,
  icon,
  C,
  iconColor,
}: {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  C: any;
  iconColor?: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.line }]}>
      <Ionicons name={icon} size={s(16)} color={iconColor ?? C.muted} />
      <Text style={[styles.statValue, { color: C.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: C.muted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function WeeklyActivityChart({
  data,
  C,
}: {
  data: {
    dateKey: string;
    label: string;
    focusMin: number;
    tasksDone: number;
    isToday: boolean;
    isFuture: boolean;
  }[];
  C: any;
}) {
  const { width: screenW } = useWindowDimensions();
  // Subtract horizontal padding: scrollContent (16*2) + card padding (14*2)
  const CHART_W = Math.max(200, screenW - s(60));
  const CHART_H = s(120);
  const P_TOP    = s(8);
  const P_BOTTOM = s(18); // space for day labels
  const P_LEFT   = s(4);
  const P_RIGHT  = s(4);
  const PLOT_W   = CHART_W - P_LEFT - P_RIGHT;
  const PLOT_H   = CHART_H - P_TOP - P_BOTTOM;

  const n = data.length || 7;
  const maxFocus = Math.max(1, ...data.map((d) => d.focusMin));
  const maxTasks = Math.max(1, ...data.map((d) => d.tasksDone));

  const xOf   = (i: number) => P_LEFT + (i / (n - 1)) * PLOT_W;
  const yFocus = (v: number) => P_TOP + PLOT_H - (v / maxFocus) * PLOT_H;
  const yTasks = (v: number) => P_TOP + PLOT_H - (v / maxTasks) * PLOT_H;

  // Clamp future points to the baseline
  const focusPoints = data
    .map((d, i) => `${xOf(i)},${yFocus(d.isFuture ? 0 : d.focusMin)}`)
    .join(" ");
  const taskPoints = data
    .map((d, i) => `${xOf(i)},${yTasks(d.isFuture ? 0 : d.tasksDone)}`)
    .join(" ");

  // Fade-in animation when data loads
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (data.length === 0) return;
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [data]);

  const hasAnyData = data.some((d) => d.focusMin > 0 || d.tasksDone > 0);
  // Horizontal grid lines at 33 %, 66 %, 100 %
  const gridYs = [0.33, 0.66, 1.0].map((t) => P_TOP + PLOT_H - t * PLOT_H);

  // Baseline Y (bottom of plot area)
  const baselineY = P_TOP + PLOT_H;

  return (
    <View style={[wStyles.card, { backgroundColor: C.card, borderColor: C.line }]}>
      {/* Legend */}
      <View style={wStyles.legend}>
        <View style={wStyles.legendItem}>
          <View style={[wStyles.legendDot, { backgroundColor: C.accent }]} />
          <Text style={[wStyles.legendLabel, { color: C.muted }]}>Focus mins</Text>
        </View>
        <View style={wStyles.legendItem}>
          <View style={[wStyles.legendDot, { backgroundColor: C.success }]} />
          <Text style={[wStyles.legendLabel, { color: C.muted }]}>Tasks done</Text>
        </View>
      </View>

      {!hasAnyData ? (
        <View style={wStyles.empty}>
          <Ionicons name="stats-chart-outline" size={s(28)} color={C.muted + "50"} />
          <Text style={[wStyles.emptyText, { color: C.muted }]}>No activity yet this week</Text>
        </View>
      ) : (
        <Animated.View style={{ opacity: fadeAnim }}>
          <Svg width={CHART_W} height={CHART_H}>
            {/* Baseline */}
            <SvgLine
              x1={P_LEFT} y1={baselineY}
              x2={P_LEFT + PLOT_W} y2={baselineY}
              stroke={C.line}
              strokeWidth={1}
            />
            {/* Horizontal grid lines */}
            {gridYs.map((y, i) => (
              <SvgLine
                key={i}
                x1={P_LEFT} y1={y}
                x2={P_LEFT + PLOT_W} y2={y}
                stroke={C.line}
                strokeWidth={0.5}
                strokeDasharray="3,5"
              />
            ))}
            {/* Focus line */}
            <Polyline
              points={focusPoints}
              fill="none"
              stroke={C.accent}
              strokeWidth={s(2)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Tasks line */}
            <Polyline
              points={taskPoints}
              fill="none"
              stroke={C.success}
              strokeWidth={s(2)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dots + labels */}
            {data.map((d, i) => {
              const cx  = xOf(i);
              const cyF = yFocus(d.isFuture ? 0 : d.focusMin);
              const cyT = yTasks(d.isFuture ? 0 : d.tasksDone);
              const op  = d.isFuture ? 0.2 : 1;
              const r   = d.isToday ? s(4.5) : s(3);
              return (
                <React.Fragment key={d.dateKey}>
                  {/* Focus dot */}
                  <Circle
                    cx={cx} cy={cyF} r={r}
                    fill={d.isFuture ? C.card : d.isToday ? C.accent : C.card}
                    stroke={C.accent}
                    strokeWidth={s(1.5)}
                    opacity={op}
                  />
                  {/* Tasks dot */}
                  <Circle
                    cx={cx} cy={cyT} r={r}
                    fill={d.isFuture ? C.card : d.isToday ? C.success : C.card}
                    stroke={C.success}
                    strokeWidth={s(1.5)}
                    opacity={op}
                  />
                  {/* Day label */}
                  <SvgText
                    x={cx}
                    y={CHART_H - s(2)}
                    textAnchor="middle"
                    fill={d.isToday ? C.accent : C.muted}
                    fillOpacity={d.isFuture ? 0.35 : 1}
                    fontSize={s(10)}
                    fontWeight="800"
                  >
                    {d.label}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const wStyles = StyleSheet.create({
  card: {
    borderRadius: s(16),
    borderWidth: s(1),
    padding: s(14),
    paddingBottom: s(10),
  },
  legend: {
    flexDirection: "row",
    gap: s(14),
    marginBottom: s(8),
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: s(5) },
  legendDot: { width: s(8), height: s(8), borderRadius: s(4) },
  legendLabel: { fontSize: s(11), fontWeight: "700" },
  empty: {
    alignItems: "center",
    paddingVertical: s(24),
    gap: s(6),
  },
  emptyText: { fontSize: s(12), fontWeight: "700" },
});

function SimpleModal({
  visible,
  onClose,
  C,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  C: any;
  children: React.ReactNode;
}) {
  if (!visible) return null;
  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        styles.sheetBackdrop,
        { alignItems: "center", justifyContent: "center", padding: s(20) },
      ]}
    >
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      <View style={[styles.modalCard, { backgroundColor: C.card, borderColor: C.line }]}>
        {children}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },

  pageHeader: {
    paddingHorizontal: s(16),
    paddingTop: s(10),
    paddingBottom: s(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageTitle: { fontSize: s(24), fontWeight: "900", letterSpacing: -0.5 },
  pageSubtitle: { fontSize: s(13), fontWeight: "600", marginTop: s(2) },

  tabBar: {
    flexDirection: "row",
    marginHorizontal: s(16),
    marginBottom: s(12),
    borderRadius: s(16),
    borderWidth: s(1),
    overflow: "hidden",
    position: "relative",
  },
  tabPill: {
    position: "absolute",
    top: s(4),
    bottom: s(4),
    borderRadius: s(12),
  },

  scrollContent: {
    paddingHorizontal: s(16),
    paddingBottom: s(110),
  },

  sectionHeader: {
    fontSize: s(11),
    fontWeight: "800",
    letterSpacing: s(0.8),
    marginTop: s(20),
    marginBottom: s(6),
    marginLeft: s(2),
  },

  listCard: {
    borderRadius: s(16),
    borderWidth: s(1),
    overflow: "hidden",
  },

  settingsRow: {
    height: s(52),
    paddingHorizontal: s(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
    flex: 1,
    paddingRight: s(8),
  },
  rowLabel: { fontSize: s(14), fontWeight: "700" },
  rowValue: { fontSize: s(13), fontWeight: "600", maxWidth: s(120) },

  iconWrap: {
    width: s(30),
    height: s(30),
    borderRadius: s(9),
    alignItems: "center",
    justifyContent: "center",
  },

  divider: { height: StyleSheet.hairlineWidth, marginLeft: s(54) },

  notifWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: s(8),
    marginHorizontal: s(12),
    marginBottom: s(10),
    padding: s(10),
    borderRadius: s(10),
    borderWidth: s(1),
  },

  identityCard: {
    borderRadius: s(16),
    borderWidth: s(1),
    padding: s(14),
    flexDirection: "row",
    alignItems: "center",
    gap: s(12),
  },
  identityName: { fontSize: s(16), fontWeight: "900" },
  identityEmail: { fontSize: s(12), fontWeight: "600" },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(4),
    paddingVertical: s(5),
    paddingHorizontal: s(9),
    borderRadius: s(8),
    borderWidth: s(1),
  },

  statsRow: { flexDirection: "row", gap: s(8), marginTop: s(12) },
  statCard: {
    flex: 1,
    borderRadius: s(14),
    borderWidth: s(1),
    padding: s(10),
    alignItems: "center",
    gap: s(4),
    minHeight: s(90),
    justifyContent: "center",
  },
  statValue: { fontSize: s(15), fontWeight: "900" },
  statLabel: { fontSize: s(10), fontWeight: "700", textAlign: "center", lineHeight: s(13) },

  emptyActivityCard: {
    borderRadius: s(16),
    borderWidth: s(1),
    padding: s(28),
    alignItems: "center",
    gap: s(8),
  },
  emptyTitle: { fontSize: s(15), fontWeight: "800" },
  emptySubtitle: {
    fontSize: s(13),
    fontWeight: "600",
    textAlign: "center",
    lineHeight: s(18),
  },

  achieveSummary: {
    borderRadius: s(16),
    borderWidth: s(1),
    padding: s(16),
    flexDirection: "row",
    alignItems: "center",
    gap: s(12),
  },
  achieveTitle: { fontSize: s(18), fontWeight: "900" },
  achieveSub: { fontSize: s(13), fontWeight: "600", marginTop: s(2) },
  achieveBadge: {
    width: s(50),
    height: s(50),
    borderRadius: s(16),
    borderWidth: s(1),
    alignItems: "center",
    justifyContent: "center",
  },
  progressBarWrap: {
    height: s(6),
    borderRadius: s(99),
    borderWidth: s(1),
    overflow: "hidden",
    marginTop: s(10),
  },
  progressBarFill: { height: "100%", borderRadius: s(99) },

  inProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(16),
    padding: s(14),
  },
  badgeIcon: {
    width: s(40),
    height: s(40),
    borderRadius: s(13),
    borderWidth: s(1),
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTitle: { fontSize: s(14), fontWeight: "800" },
  badgeProgress: { fontSize: s(12), fontWeight: "700" },
  badgeSub: { fontSize: s(12), fontWeight: "600" },
  miniProgressTrack: { height: s(4), borderRadius: s(99), overflow: "hidden" },
  miniProgressFill: { height: "100%", borderRadius: s(99) },

  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: s(24),
    borderTopRightRadius: s(24),
    borderWidth: s(1),
    paddingTop: s(12),
    paddingHorizontal: s(20),
    paddingBottom: s(36),
  },
  sheetHandle: {
    width: s(40),
    height: s(4),
    borderRadius: s(99),
    alignSelf: "center",
    marginBottom: s(16),
  },
  sheetTitle: { fontSize: s(17), fontWeight: "900" },
  sheetSub: {
    fontSize: s(13),
    fontWeight: "600",
    marginTop: s(4),
    marginBottom: s(16),
  },

  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: s(10) },
  colorSwatch: {
    width: s(68),
    height: s(68),
    borderRadius: s(18),
    alignItems: "center",
    justifyContent: "flex-end",
    padding: s(6),
  },
  colorLabel: {
    color: "#fff",
    fontSize: s(10),
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  modalCard: {
    width: "100%",
    maxWidth: s(480),
    borderRadius: s(20),
    borderWidth: s(1),
    padding: s(18),
  },
  modalTitle: { fontSize: s(17), fontWeight: "900" },
  modalSub: { fontSize: s(13), fontWeight: "600", marginTop: s(6) },
  modalInput: {
    marginTop: s(14),
    borderWidth: s(1),
    borderRadius: s(12),
    paddingHorizontal: s(14),
    paddingVertical: s(11),
    fontSize: s(15),
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    gap: s(10),
    marginTop: s(14),
    justifyContent: "flex-end",
  },
  modalCancelBtn: {
    height: s(42),
    paddingHorizontal: s(16),
    borderRadius: s(12),
    borderWidth: s(1),
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryBtn: {
    height: s(42),
    paddingHorizontal: s(20),
    borderRadius: s(12),
    alignItems: "center",
    justifyContent: "center",
    minWidth: s(80),
  },
  modalBtnText: { fontSize: s(14), fontWeight: "800" },

  dangerIconWrap: {
    width: s(56),
    height: s(56),
    borderRadius: s(20),
    alignItems: "center",
    justifyContent: "center",
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: s(12),
    paddingHorizontal: s(32),
  },
  loadingTitle: { fontSize: s(20), fontWeight: "900", textAlign: "center" },
  loadingSub: {
    fontSize: s(14),
    fontWeight: "600",
    textAlign: "center",
    lineHeight: s(20),
  },
});