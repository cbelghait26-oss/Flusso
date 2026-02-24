// screens/SettingsScreen.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
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
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";

import { useTheme } from "../src/components/theme/theme";
import { ACHIEVEMENT_DEFS } from "../src/context/AchievementContext";
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
  clearUserData,
  deleteAllCloudData,
  getCurrentUser,
} from "../src/data/storage";
import { loadTasks, loadObjectives } from "../src/data/storage";
import type { Objective } from "../src/data/models";
import { auth } from "../src/services/firebase";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../src/navigation/types";

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
  const [marathonCount, setMarathonCount] = useState<number>(0);
  const [dailyGoal, setDailyGoal] = useState<number>(5);
  const [tasksCompletedToday, setTasksCompletedToday] = useState<number>(0);

  // ── Delete account ────────────────────────────────────────────────────────
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeletionLoading, setShowDeletionLoading] = useState(false);

  // ── Settings toggles ──────────────────────────────────────────────────────
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [weekStartsMonday, setWeekStartsMonday] = useState(true);
  const [timeFormat24h, setTimeFormat24h] = useState(false);

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

    setEarlyBirdCount(
      sessions.some((s) => parseInt(s.startTime.split(":")[0]) < 8) ? 1 : 0
    );
    setNightOwlCount(
      sessions.some((s) => parseInt(s.startTime.split(":")[0]) >= 20) ? 1 : 0
    );
    setMarathonCount(sessions.some((s) => s.minutes >= 120) ? 1 : 0);

    const goal = await loadDailyGoal();
    setDailyGoal(goal);

    const completedToday = await loadTasksCompletedToday();
    setTasksCompletedToday(completedToday);

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

  // ── Build badges from ACHIEVEMENT_DEFS + live progress ───────────────────
  // Single source of truth — definitions live in AchievementContext.tsx
  const badges: Badge[] = useMemo(() => {
    const progressMap: Record<string, { progress: number; total: number }> = {
      first_task: { progress: completedCount > 0 ? 1 : 0, total: 1 },
      streak_7:   { progress: Math.min(streakDays, 7), total: 7 },
      focus_10:   { progress: Math.min(focusSessionsCount, 10), total: 10 },
      early:      { progress: earlyBirdCount, total: 1 },
      night:      { progress: nightOwlCount, total: 1 },
      marathon:   { progress: marathonCount, total: 1 },
    };

    return ACHIEVEMENT_DEFS.map((def) => ({
      id: def.id,
      title: def.title,
      subtitle: def.subtitle,
      icon: def.icon,
      total: progressMap[def.id]?.total ?? 1,
      progress: progressMap[def.id]?.progress ?? 0,
    }));
  }, [completedCount, streakDays, focusSessionsCount, earlyBirdCount, nightOwlCount, marathonCount]);

  const unlockedCount = badges.filter((b) => b.progress >= b.total && b.total > 0).length;
  const nextToUnlock = badges.filter(
    (b) => !(b.progress >= b.total && b.total > 0) && b.progress > 0
  );

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

  // ── Daily goal editor ─────────────────────────────────────────────────────
  const [goalModal, setGoalModal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");

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
        <InitialsAvatar name={profileName} accent={C.accent} size={40} />
      </View>

      {/* ── Segmented tabs ── */}
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
            <InitialsAvatar name={profileName} accent={C.accent} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.identityName, { color: C.text }]} numberOfLines={1}>
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
              onPress={openNameEditor}
              style={[
                styles.editBtn,
                { backgroundColor: C.accent + "16", borderColor: C.accent + "30" },
              ]}
            >
              <Ionicons name="pencil" size={s(14)} color={C.accent} />
              <Text style={{ color: C.accent, fontSize: s(12), fontWeight: "800" }}>Edit</Text>
            </Pressable>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatCard
              value={`${tasksCompletedToday}/${dailyGoal}`}
              label="Today's goal"
              icon="flag-outline"
              C={C}
              iconColor={C.accent}
            />
            <StatCard
              value={`${streakDays}d`}
              label="Streak"
              icon="flame-outline"
              C={C}
              iconColor="#F97316"
            />
            <StatCard
              value={`${focusMinToday}m`}
              label="Focus today"
              icon="time-outline"
              C={C}
              iconColor={C.success}
            />
            <StatCard
              value={`${completedCount}`}
              label="Completed"
              icon="checkmark-done-outline"
              C={C}
              iconColor={C.accent}
            />
          </View>

          {/* Account actions */}
          <SectionHeader title="Account actions" C={C} />
          <View style={[styles.listCard, { backgroundColor: C.card, borderColor: C.line }]}>
            <ActionRow
              icon="person-outline"
              label="Edit profile name"
              C={C}
              onPress={openNameEditor}
            />
            <Divider C={C} />
            <ActionRow
              icon="mail-outline"
              label="Email address"
              value={profileEmail ? "Tap to copy" : "Not set"}
              C={C}
              onPress={copyEmail}
              showChevron={false}
              right={<Ionicons name="copy-outline" size={s(16)} color={C.muted} />}
            />
            <Divider C={C} />
            <ActionRow
              icon="notifications-outline"
              label="Manage notifications"
              C={C}
              onPress={() => Alert.alert("Notifications", "Coming soon.")}
            />
          </View>

          {/* Activity placeholder */}
          <SectionHeader title="This week's activity" C={C} />
          <View
            style={[styles.emptyActivityCard, { backgroundColor: C.card, borderColor: C.line }]}
          >
            <Ionicons name="bar-chart-outline" size={s(32)} color={C.muted + "60"} />
            <Text style={[styles.emptyTitle, { color: C.text }]}>No activity yet</Text>
            <Text style={[styles.emptySubtitle, { color: C.muted }]}>
              Complete tasks and focus sessions to see your weekly progress here.
            </Text>
          </View>
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
            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: C.muted + "14" }]}>
                  <Ionicons name="notifications-outline" size={s(16)} color={C.muted} />
                </View>
                <Text style={[styles.rowLabel, { color: C.text }]}>Notifications</Text>
              </View>
              <Switch
                style={{ marginTop: s(12) }}
                value={notifEnabled}
                onValueChange={setNotifEnabled}
                trackColor={{ false: C.line, true: C.accent + "88" }}
                thumbColor={notifEnabled ? C.accent : C.muted}
              />
            </View>
            {!notifEnabled && (
              <View
                style={[
                  styles.notifWarning,
                  {
                    backgroundColor: "#F97316" + "12",
                    borderColor: "#F97316" + "30",
                  },
                ]}
              >
                <Ionicons name="warning-outline" size={s(14)} color="#F97316" />
                <Text
                  style={{
                    color: "#F97316",
                    fontSize: s(12),
                    fontWeight: "700",
                    flex: 1,
                  }}
                >
                  Notifications are disabled. Enable them in Settings to receive reminders.
                </Text>
              </View>
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
          </View>

          {/* PLANNING */}
          <SectionHeader title="Calendar & planning" C={C} />
          <View style={[styles.listCard, { backgroundColor: C.card, borderColor: C.line }]}>
            <ActionRow
              icon="flag-outline"
              label="Daily task goal"
              value={`${dailyGoal} tasks`}
              C={C}
              onPress={openGoalEditor}
            />
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
                onValueChange={setTimeFormat24h}
                trackColor={{ false: C.line, true: C.accent + "88" }}
                thumbColor={timeFormat24h ? C.accent : C.muted}
              />
            </View>
            <Divider C={C} />
            <ActionRow
              icon="alarm-outline"
              label="Default reminder"
              value="None"
              C={C}
              onPress={() => Alert.alert("Default reminder", "Coming soon.")}
            />
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
              onPress={() => Alert.alert("Privacy policy", "Coming soon.")}
            />
            <Divider C={C} />
            <ActionRow
              icon="chatbubble-ellipses-outline"
              label="Contact support"
              C={C}
              onPress={() => Alert.alert("Support", "Coming soon.")}
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

          <View style={{ height: s(32) }} />
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
          {/* Summary bar */}
          <View
            style={[styles.achieveSummary, { backgroundColor: C.card, borderColor: C.line }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.achieveTitle, { color: C.text }]}>
                {unlockedCount}/{badges.length} unlocked
              </Text>
              <Text style={[styles.achieveSub, { color: C.muted }]}>
                Keep completing tasks and focus sessions
              </Text>
            </View>
            <View
              style={[
                styles.achieveBadge,
                { backgroundColor: C.accent + "18", borderColor: C.accent + "30" },
              ]}
            >
              <Ionicons name="trophy" size={s(22)} color={C.accent} />
            </View>
          </View>

          {/* Progress bar */}
          <View
            style={[
              styles.progressBarWrap,
              { backgroundColor: C.card2, borderColor: C.line },
            ]}
          >
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.round((unlockedCount / badges.length) * 100)}%`,
                  backgroundColor: C.accent,
                },
              ]}
            />
          </View>

          {/* In-progress section */}
          {nextToUnlock.length > 0 && (
            <>
              <SectionHeader title="In progress" C={C} />
              <View style={[styles.listCard, { backgroundColor: C.card, borderColor: C.line }]}>
                {nextToUnlock.map((badge, i) => {
                  const ratio = badge.total > 0 ? clamp01(badge.progress / badge.total) : 0;
                  return (
                    <React.Fragment key={badge.id}>
                      {i > 0 && <Divider C={C} />}
                      <Pressable
                        onPress={() =>
                          Alert.alert(
                            badge.title,
                            `${badge.subtitle}\n\nProgress: ${formatProgress(badge.progress, badge.total)}`
                          )
                        }
                        style={({ pressed }) => [
                          styles.inProgressRow,
                          { opacity: pressed ? 0.8 : 1 },
                        ]}
                      >
                        <View
                          style={[
                            styles.badgeIcon,
                            {
                              backgroundColor: C.accent + "18",
                              borderColor: C.accent + "30",
                            },
                          ]}
                        >
                          <Ionicons name={badge.icon} size={s(18)} color={C.accent} />
                        </View>
                        <View style={{ flex: 1, gap: s(4) }}>
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Text style={[styles.badgeTitle, { color: C.text }]}>
                              {badge.title}
                            </Text>
                            <Text style={[styles.badgeProgress, { color: C.muted }]}>
                              {formatProgress(badge.progress, badge.total)}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.miniProgressTrack,
                              { backgroundColor: C.muted + "20" },
                            ]}
                          >
                            <View
                              style={[
                                styles.miniProgressFill,
                                {
                                  width: `${Math.round(ratio * 100)}%`,
                                  backgroundColor: C.accent,
                                },
                              ]}
                            />
                          </View>
                          <Text
                            style={[styles.badgeSub, { color: C.muted }]}
                            numberOfLines={1}
                          >
                            {badge.subtitle}
                          </Text>
                        </View>
                      </Pressable>
                    </React.Fragment>
                  );
                })}
              </View>
            </>
          )}

          {/* All badges */}
          <SectionHeader title="All badges" C={C} />
          <View style={[styles.listCard, { backgroundColor: C.card, borderColor: C.line }]}>
            {badges.map((badge, i) => {
              const done = badge.total > 0 && badge.progress >= badge.total;
              const ratio = badge.total > 0 ? clamp01(badge.progress / badge.total) : 0;
              return (
                <React.Fragment key={badge.id}>
                  {i > 0 && <Divider C={C} />}
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        badge.title,
                        done
                          ? "Unlocked! 🎉"
                          : `${badge.subtitle}\n\nProgress: ${formatProgress(badge.progress, badge.total)}`
                      )
                    }
                    style={({ pressed }) => [
                      styles.inProgressRow,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.badgeIcon,
                        done
                          ? { backgroundColor: C.success + "20", borderColor: C.success + "40" }
                          : { backgroundColor: C.muted + "12", borderColor: C.line },
                      ]}
                    >
                      <Ionicons
                        name={badge.icon}
                        size={s(18)}
                        color={done ? C.success : C.muted}
                      />
                    </View>
                    <View style={{ flex: 1, gap: s(3) }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text style={[styles.badgeTitle, { color: done ? C.text : C.muted }]}>
                          {badge.title}
                        </Text>
                        <Text
                          style={{
                            fontSize: s(11),
                            fontWeight: "800",
                            color: done ? C.success : C.muted,
                          }}
                        >
                          {done
                            ? "Unlocked"
                            : `${formatProgress(badge.progress, badge.total)}`}
                        </Text>
                      </View>
                      <Text
                        style={[styles.badgeSub, { color: C.muted }]}
                        numberOfLines={1}
                      >
                        {badge.subtitle}
                      </Text>
                      {!done && (
                        <View
                          style={[
                            styles.miniProgressTrack,
                            { backgroundColor: C.muted + "20" },
                          ]}
                        >
                          <View
                            style={[
                              styles.miniProgressFill,
                              {
                                width: `${Math.round(ratio * 100)}%`,
                                backgroundColor: C.muted + "60",
                              },
                            ]}
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
      <Text style={[styles.statLabel, { color: C.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

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
    gap: s(5),
    paddingVertical: s(7),
    paddingHorizontal: s(12),
    borderRadius: s(10),
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
  },
  statValue: { fontSize: s(15), fontWeight: "900" },
  statLabel: { fontSize: s(10), fontWeight: "700", textAlign: "center" },

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
    gap: s(12),
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