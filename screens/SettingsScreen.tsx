// screens/SettingsScreen.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
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
import { EmailAuthProvider, reauthenticateWithCredential, deleteUser, signOut } from "firebase/auth";

import { useTheme } from "../src/components/theme/theme";
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
  progress: number; // 0..total
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function formatProgress(p: number, t: number) {
  if (t <= 0) return "";
  return `${Math.min(p, t)}/${t}`;
}

export default function SettingsScreen() {
  const theme = useTheme();
  const { colors, isDark, themeMode, setThemeMode, accent, setAccent } = theme;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { width } = useWindowDimensions();

  // ---------- Local data loaded from storage ----------
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

  // Password confirmation modal for account deletion
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeletionLoading, setShowDeletionLoading] = useState(false);

  // Week mini-graph (stub until you track per-day counts)
  const weekBars = useMemo(() => [0, 0, 0, 0, 0, 0, 0], []);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const n = await loadSetupName();
    setProfileNameState(n || "");

    // Load email from Firebase auth
    const currentUser = auth.currentUser;
    if (currentUser?.email) {
      setProfileEmail(currentUser.email);
    }

    const tasks = await loadTasks();
    const completed = tasks.filter(
      (t: any) => t.status === "completed",
    ).length;
    setCompletedCount(completed);

    const objs = await loadObjectives();
    setObjectives(objs);

    const fm = await loadFocusMinutesToday();
   
    setFocusMinToday(fm);

    // Update login streak
    const sd = await updateLoginStreak();
    setStreakDays(sd);

    // Load focus sessions for achievements
    const sessions = await loadFocusSessions();
    setFocusSessionsCount(sessions.length);

    // Count achievement progress
    const earlyBird = sessions.filter((s) => {
      const hour = parseInt(s.startTime.split(":")[0]);
      return hour < 8;
    }).length;
    setEarlyBirdCount(earlyBird > 0 ? 1 : 0);

    const nightOwl = sessions.filter((s) => {
      const hour = parseInt(s.startTime.split(":")[0]);
      return hour >= 20;
    }).length;
    setNightOwlCount(nightOwl > 0 ? 1 : 0);

    const marathon = sessions.filter((s) => s.minutes >= 120).length;
    setMarathonCount(marathon > 0 ? 1 : 0);

    // Load daily goal tracking
    const goal = await loadDailyGoal();
    setDailyGoal(goal);

    const completedToday = await loadTasksCompletedToday();
    setTasksCompletedToday(completedToday);
  };

  // ---------- Delete Account with Password Confirmation ----------
  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      Alert.alert("Password Required", "Please enter your password to confirm account deletion.");
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

      // Reauthenticate user with password
      console.log("Reauthenticating user...");
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);
      console.log("User reauthenticated successfully");

      // Close modal and show loading screen
      setDeleteModalVisible(false);
      setDeletePassword("");
      setShowDeletionLoading(true);

      // Delete all cloud data from Firestore (parallel, optimized)
      console.log("Deleting all cloud data...");
      await deleteAllCloudData();
      console.log("Cloud data deleted");

      // Clear local storage
      console.log("Clearing local data...");
      await clearUserData();
      console.log("Local data cleared");

      // Delete Firebase Auth account
      console.log("Deleting Firebase Auth account...");
      await deleteUser(user);
      console.log("Firebase Auth account deleted");

      // Hide loading screen
      setShowDeletionLoading(false);
      setDeletingAccount(false);

      Alert.alert(
        "Account Deleted",
        "Your account and all associated data have been permanently deleted.",
        [
          {
            text: "OK",
            onPress: () => navigation.navigate("SignIn"),
          },
        ]
      );
    } catch (error: any) {
      console.error("Error deleting account:", error);
      setShowDeletionLoading(false);
      setDeletingAccount(false);
      
      let errorMessage = "An error occurred while deleting your account.";
      
      if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password. Please try again.";
        // Keep modal open for password retry
        setDeleteModalVisible(true);
        setDeletePassword("");
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many attempts. Please try again later.";
      } else if (error.code === "auth/requires-recent-login") {
        errorMessage = "Please sign out and sign in again before deleting your account.";
      }
      
      Alert.alert("Delete Failed", errorMessage);
    }
  };

  // ---------- Dark toggle (no choice sheet) ----------
  const darkEnabled = themeMode === "system" ? isDark : themeMode === "dark";
  const toggleDark = () => setThemeMode(darkEnabled ? "light" : "dark");

  // ---------- Accent palette ----------
  const accentPalette = useMemo(
    () => [
      "#1C7ED6",
      "#2EC4B6",
      "#38BDF8",
      "#22C55E",
      "#A855F7",
      "#F97316",
      "#F43F5E",
      "#FACC15",
    ],
    [],
  );

  // ---------- Settings toggles (local until you persist) ----------
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [weekStartsMonday, setWeekStartsMonday] = useState(true);
  const [timeFormat24h, setTimeFormat24h] = useState(false);

  // ---------- Achievements ----------
  const badges: Badge[] = useMemo(
    () => [
      {
        id: "first_task",
        title: "First Task",
        subtitle: "Complete your first task",
        icon: "checkmark-circle-outline",
        total: 1,
        progress: completedCount > 0 ? 1 : 0,
      },
      {
        id: "streak_7",
        title: "7-Day Streak",
        subtitle: "Maintain a 7-day focus streak",
        icon: "flame-outline",
        total: 7,
        progress: Math.min(streakDays, 7),
      },
      {
        id: "focus_10",
        title: "Focus Master",
        subtitle: "Complete 10 focus sessions",
        icon: "bulb-outline",
        total: 10,
        progress: Math.min(focusSessionsCount, 10),
      },
      {
        id: "early",
        title: "Early Bird",
        subtitle: "Start a focus session before 8 AM",
        icon: "sunny-outline",
        total: 1,
        progress: earlyBirdCount,
      },
      {
        id: "night",
        title: "Night Owl",
        subtitle: "Start a focus session after 8 PM",
        icon: "moon-outline",
        total: 1,
        progress: nightOwlCount,
      },
      {
        id: "marathon",
        title: "Marathon",
        subtitle: "Complete a 120 min focus session",
        icon: "walk-outline",
        total: 1,
        progress: marathonCount,
      },
    ],
    [completedCount, streakDays, focusSessionsCount, earlyBirdCount, nightOwlCount, marathonCount],
  );

  // ---------- Tabs ----------
  const tabs: {
    key: TabKey;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = useMemo(
    () => [
      { key: "profile", label: "Profile", icon: "person-circle-outline" },
      { key: "settings", label: "Settings", icon: "settings-outline" },
      { key: "achievements", label: "Achievements", icon: "trophy-outline" },
    ],
    [],
  );
  const [tab, setTab] = useState<TabKey>("settings");

  // animated indicator
  const indicator = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const idx = tabs.findIndex((t) => t.key === tab);
    Animated.spring(indicator, {
      toValue: idx,
      useNativeDriver: true,
      stiffness: 220,
      damping: 28,
      mass: 0.9,
    }).start();
  }, [tab, indicator, tabs]);

  const segmentWidth = Math.min(520, width - 32);
  const segItemW = segmentWidth / tabs.length;

  const indicatorTranslateX = indicator.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, segItemW, segItemW * 2],
  });

  // ---------- Visual aliases for this screen ----------
  const C = useMemo(() => {
    return {
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      muted: colors.muted,
      line: colors.border,
      accent: colors.accent,
      aqua: colors.success,
      danger: "#FF5A5F",
    };
  }, [colors]);

  // ---------- Name editor (iOS prompt + Android modal) ----------
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
        profileName,
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

  // ---------- Daily goal editor ----------
  const [goalModal, setGoalModal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");

  const openGoalEditor = () => {
    if (Platform.OS === "ios" && (Alert as any).prompt) {
      (Alert as any).prompt(
        "Set daily goal",
        "How many tasks do you want to complete each day?",
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
                Alert.alert("Invalid", "Please enter a number between 1 and 100.");
              }
            },
          },
        ],
        "plain-text",
        String(dailyGoal),
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
      Alert.alert("Invalid", "Please enter a number between 1 and 100.");
    }
  };

  // ---------- Logout handler ----------
  const handleLogout = async () => {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            try {
              await clearUserData();
              await auth.signOut();
              navigation.reset({
                index: 0,
                routes: [{ name: "SignIn" }],
              });
            } catch (error) {
              Alert.alert("Error", "Failed to log out. Please try again.");
            }
          },
        },
      ]
    );
  };

  const onComingSoon = (label: string) =>
    Alert.alert(label, "Wire this to your real screen / store.");

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: C.bg }]}
      edges={["top", "left", "right"]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: C.text }]}>Account</Text>
      </View>

      {/* Segmented Tabs */}
      <View
        style={[
          styles.segmentWrap,
          { width: segmentWidth, backgroundColor: C.card, borderColor: C.line },
        ]}
      >
        {tabs.map((t, idx) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={({ pressed }) => [
                styles.segmentItem,
                { 
                  width: segItemW, 
                  opacity: pressed ? 0.9 : 1,
                  backgroundColor: active 
                    ? `${C.accent}14` // accent with 8% opacity
                    : "transparent",
                  borderRadius: s(16),
                },
              ]}
            >
              <Ionicons
                name={t.icon}
                size={s(18)}
                color={active ? C.accent : C.muted}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? C.accent : C.muted },
                ]}
                numberOfLines={1}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {tab === "profile" && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollPad}
          >
            {/* Identity */}
            <View
              style={[
                styles.heroCard,
                { backgroundColor: C.card, borderColor: C.line },
              ]}
            >
              <View style={styles.heroRow}>
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(10,22,48,0.06)",
                    },
                  ]}
                >
                  <Ionicons name="person" size={22} color={C.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.heroName, { color: C.text }]}
                    numberOfLines={1}
                  >
                    {profileName || "Your name"}
                  </Text>
                  <Text
                    style={[styles.heroSub, { color: C.muted }]}
                    numberOfLines={1}
                  >
                    {profileEmail || "Set up your profile"}
                  </Text>
                </View>
                <Pressable
                  onPress={openNameEditor}
                  style={({ pressed }) => [
                    styles.heroAction,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(10,22,48,0.06)",
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Ionicons name="pencil" size={s(16)} color={C.text} />
                  <Text style={[styles.heroActionText, { color: C.text }]}>
                    Edit
                  </Text>
                </Pressable>
              </View>

              {/* Mini “week” graph */}
              <View style={styles.weekRow}>
                {weekBars.map((v, i) => {
                  const h = s(8) + Math.round(clamp01(v) * s(18));
                  return (
                    <View
                      key={i}
                      style={[
                        styles.weekBarWrap,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.04)"
                            : "rgba(10,22,48,0.04)",
                        },
                      ]}
                    >
                      <View
                        style={{
                          height: h,
                          width: "100%",
                          borderRadius: s(10),
                          backgroundColor: i === 6 ? C.accent : C.aqua,
                          opacity: v > 0 ? 1 : 0.25,
                        }}
                      />
                    </View>
                  );
                })}
              </View>

              <View style={styles.heroStatsRow}>
                <StatPill
                  label="Daily goal"
                  value={`${tasksCompletedToday}/${dailyGoal}`}
                  icon="flag-outline"
                  C={C}
                />
                <StatPill
                  label="Streak"
                  value={`${streakDays}d`}
                  icon="flame-outline"
                  iconColor="#F97316"
                  C={C}
                />
                <StatPill
                  label="Focus today"
                  value={`${focusMinToday} min`}
                  icon="time-outline"
                  C={C}
                />
              </View>
            </View>

            {/* Next best action */}
            <View
              style={[
                styles.card,
                { backgroundColor: C.card, borderColor: C.line },
              ]}
            >
              <Text style={[styles.cardTitle, { color: C.text }]}>
                Start here
              </Text>
              <Text style={[styles.cardSub, { color: C.muted }]}>
                Pick one task you can finish in under 5 min.
              </Text>
              <Pressable
                onPress={() => onComingSoon("Quick add")}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: C.accent, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Quick add</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}

        {tab === "settings" && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollPad}
          >
            <Section title="Account" C={C}>
              <Row
                label="Name"
                value={profileName || "Set name"}
                icon="person-outline"
                C={C}
                onPress={openNameEditor}
              />
              <Row
                label="Email"
                value={profileEmail || "Not set"}
                icon="mail-outline"
                C={C}
                onPress={() => {}}
              />
              <ToggleRow
                label="Notifications"
                icon="notifications-outline"
                C={C}
                value={notifEnabled}
                onChange={setNotifEnabled}
              />
            </Section>

            <Section title="Appearance" C={C}>
              {/* Dark mode toggle (requested) */}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Ionicons name="contrast-outline" size={18} color={C.muted} />
                  <Text
                    style={[styles.rowLabel, { color: C.text }]}
                    numberOfLines={1}
                  >
                    Dark mode
                  </Text>
                </View>
                <Switch value={darkEnabled} onValueChange={toggleDark} />
              </View>

              {/* Accent swatches (global) */}
              <View
                style={[
                  styles.colorRowWrap,
                  { backgroundColor: C.card, borderColor: C.line },
                ]}
              >
                <View style={styles.colorRowHeader}>
                  <Ionicons
                    name="color-palette-outline"
                    size={18}
                    color={C.muted}
                  />
                  <Text style={[styles.rowLabel, { color: C.text }]}>
                    Accent color
                  </Text>
                </View>

                <View style={styles.swatches}>
                  {accentPalette.map((hex) => {
                    const selected =
                      hex.toLowerCase() === (accent || "").toLowerCase();
                    return (
                      <Pressable
                        key={hex}
                        onPress={() => setAccent(hex)}
                        style={({ pressed }) => [
                          styles.swatch,
                          {
                            backgroundColor: hex,
                            opacity: pressed ? 0.85 : 1,
                            borderColor: selected
                              ? "rgba(255,255,255,0.85)"
                              : "rgba(255,255,255,0.25)",
                            borderWidth: selected ? 2 : 1,
                          },
                        ]}
                      >
                        {selected && (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Section>

            <Section title="Calendar & Planning" C={C}>
              <Row
                label="Daily task goal"
                value={`${dailyGoal} tasks`}
                icon="flag-outline"
                C={C}
                onPress={openGoalEditor}
              />
              <ToggleRow
                label="Week starts on Monday"
                icon="calendar-number-outline"
                C={C}
                value={weekStartsMonday}
                onChange={setWeekStartsMonday}
              />
              <ToggleRow
                label="24-hour time"
                icon="time-outline"
                C={C}
                value={timeFormat24h}
                onChange={setTimeFormat24h}
              />
              <Row
                label="Default reminder"
                value="None"
                icon="alarm-outline"
                C={C}
                onPress={() => onComingSoon("Default reminder")}
              />
            </Section>



            <Section title="About" C={C}>
              <Row
                label="Version"
                value="1.0.0"
                icon="information-circle-outline"
                C={C}
                onPress={() => {}}
              />
              <Row
                label="Privacy policy"
                value=""
                icon="shield-checkmark-outline"
                C={C}
                onPress={() => onComingSoon("Privacy policy")}
              />
              <Row
                label="Contact support"
                value=""
                icon="chatbubble-ellipses-outline"
                C={C}
                onPress={() => onComingSoon("Support")}
              />
            </Section>

            <View
              style={[
                styles.dangerCard,
                { borderColor: C.line, backgroundColor: C.card },
              ]}
            >
              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [
                  styles.dangerRow,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Ionicons name="log-out-outline" size={18} color={C.danger} />
                <Text style={[styles.dangerText, { color: C.danger }]}>
                  Log out
                </Text>
              </Pressable>

              <View style={[styles.sep, { backgroundColor: C.line }]} />

              <Pressable
                onPress={() => {
                  Alert.alert(
                    "Delete Account",
                    "This will permanently delete your account and all associated data. This action cannot be undone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Continue",
                        style: "destructive",
                        onPress: () => setDeleteModalVisible(true),
                      },
                    ]
                  );
                }}
                style={({ pressed }) => [
                  styles.dangerRow,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Ionicons name="warning-outline" size={s(18)} color={C.danger} />
                <Text style={[styles.dangerText, { color: C.danger }]}>
                  Delete account
                </Text>
              </Pressable>
            </View>

            <View style={{ height: s(24) }} />
          </ScrollView>
        )}

        {tab === "achievements" && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollPad}
          >
            <View
              style={[
                styles.card,
                { backgroundColor: C.card, borderColor: C.line },
              ]}
            >
              <Text style={[styles.cardTitle, { color: C.text }]}>
                Your achievements
              </Text>
              <Text style={[styles.cardSub, { color: C.muted }]}>
                Unlock badges by finishing tasks and focus sessions. Progress is
                always visible.
              </Text>
            </View>

            <FlatList
              data={badges}
              numColumns={2}
              keyExtractor={(b) => b.id}
              scrollEnabled={false}
              columnWrapperStyle={{ gap: s(12) }}
              contentContainerStyle={{ gap: s(12), paddingBottom: s(24) }}
              renderItem={({ item }) => (
                <BadgeCard
                  badge={item}
                  C={C}
                  onPress={() => {
                    const done = item.progress >= item.total && item.total > 0;
                    Alert.alert(
                      item.title,
                      done
                        ? "Unlocked."
                        : `Progress: ${formatProgress(item.progress, item.total)}\n\n${item.subtitle}`,
                    );
                  }}
                />
              )}
            />
          </ScrollView>
        )}
      </View>

      {/* Android name modal */}
      {nameModal && (
        <View
          style={[
            styles.modalOverlay,
            {
              backgroundColor: isDark ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.25)",
            },
          ]}
        >
          <View
            style={[
              styles.modalCard,
              { backgroundColor: C.card, borderColor: C.line },
            ]}
          >
            <Text style={[styles.modalTitle, { color: C.text }]}>
              Edit name
            </Text>
            <Text style={[styles.modalSub, { color: C.muted }]}>
              This is shown on your profile.
            </Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Your name"
              placeholderTextColor={C.muted}
              style={[
                styles.modalInput,
                {
                  color: C.text,
                  borderColor: C.line,
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(10,22,48,0.04)",
                },
              ]}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveNameAndroid}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setNameModal(false)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: C.muted }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={saveNameAndroid}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  { backgroundColor: C.accent, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Android daily goal modal */}
      {goalModal && (
        <View
          style={[
            styles.modalOverlay,
            {
              backgroundColor: isDark ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.25)",
            },
          ]}
        >
          <View
            style={[
              styles.modalCard,
              { backgroundColor: C.card, borderColor: C.line },
            ]}
          >
            <Text style={[styles.modalTitle, { color: C.text }]}>
              Set daily goal
            </Text>
            <Text style={[styles.modalSub, { color: C.muted }]}>
              How many tasks do you want to complete each day?
            </Text>
            <TextInput
              value={goalDraft}
              onChangeText={setGoalDraft}
              placeholder="5"
              placeholderTextColor={C.muted}
              keyboardType="number-pad"
              style={[
                styles.modalInput,
                {
                  color: C.text,
                  borderColor: C.line,
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(10,22,48,0.04)",
                },
              ]}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveGoalAndroid}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setGoalModal(false)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: C.muted }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={saveGoalAndroid}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  { backgroundColor: C.accent, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Password Confirmation Modal for Account Deletion */}
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
            styles.modalOverlay,
            { backgroundColor: "rgba(0,0,0,0.5)" },
          ]}
        >
          <View
            style={[
              styles.modalCard,
              { backgroundColor: C.card, borderColor: C.line },
            ]}
          >
            <View style={{ alignItems: "center", marginBottom: s(12) }}>
              <Ionicons name="warning" size={s(32)} color={C.danger} />
              <Text
                style={[
                  styles.modalTitle,
                  { color: C.text, marginTop: s(12), textAlign: "center" },
                ]}
              >
                Confirm Account Deletion
              </Text>
              <Text
                style={[
                  styles.modalSub,
                  { color: C.muted, textAlign: "center" },
                ]}
              >
                Enter your password to permanently delete your account and all data.
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
                {
                  color: C.text,
                  backgroundColor: C.bg,
                  borderColor: C.line,
                },
              ]}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setDeleteModalVisible(false);
                  setDeletePassword("");
                }}
                disabled={deletingAccount}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    borderWidth: s(1),
                    borderColor: C.line,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: C.text }]}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={handleDeleteAccount}
                disabled={deletingAccount || !deletePassword.trim()}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  {
                    backgroundColor: C.danger,
                    opacity: deletingAccount || !deletePassword.trim() ? 0.5 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  {deletingAccount ? "Deleting..." : "Delete Account"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-Screen Loading During Account Deletion */}
      <Modal
        visible={showDeletionLoading}
        transparent
        animationType="fade"
      >
        <View
          style={[
            styles.loadingOverlay,
            { backgroundColor: C.bg },
          ]}
        >
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={C.danger} />
            <Text
              style={[
                styles.loadingTitle,
                { color: C.text, marginTop: s(24) },
              ]}
            >
              Deleting Account...
            </Text>
            <Text
              style={[
                styles.loadingSubtitle,
                { color: C.muted, marginTop: s(8) },
              ]}
            >
              Please wait while we permanently delete your account and all data.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
  C,
}: {
  title: string;
  children: React.ReactNode;
  C: any;
}) {
  return (
    <View style={{ marginTop: s(14) }}>
      <Text style={[styles.sectionTitle, { color: C.muted }]}>{title}</Text>
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: C.card, borderColor: C.line },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  icon,
  onPress,
  C,
}: {
  label: string;
  value?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  C: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.86 : 1 }]}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={s(18)} color={C.muted} />
        <Text style={[styles.rowLabel, { color: C.text }]} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <View style={styles.rowRight}>
        {!!value && (
          <Text style={[styles.rowValue, { color: C.muted }]} numberOfLines={1}>
            {value}
          </Text>
        )}
        <Ionicons name="chevron-forward" size={s(18)} color={C.muted} />
      </View>
    </Pressable>
  );
}

function ToggleRow({
  label,
  icon,
  value,
  onChange,
  C,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: boolean;
  onChange: (v: boolean) => void;
  C: any;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={18} color={C.muted} />
        <Text style={[styles.rowLabel, { color: C.text }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function StatPill({
  label,
  value,
  icon,
  iconColor,
  C,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  C: any;
}) {
  return (
    <View
      style={[
        styles.statPill,
        { backgroundColor: "rgba(255,255,255,0.05)", borderColor: C.line },
      ]}
    >
      <Ionicons name={icon} size={16} color={iconColor || C.muted} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.statLabel, { color: C.muted }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.statValue, { color: C.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function BadgeCard({
  badge,
  C,
  onPress,
}: {
  badge: Badge;
  C: any;
  onPress: () => void;
}) {
  const done = badge.total > 0 && badge.progress >= badge.total;
  const ratio = badge.total > 0 ? clamp01(badge.progress / badge.total) : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.badgeCard,
        {
          backgroundColor: C.card,
          borderColor: C.line,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.badgeTop}>
        <View
          style={[
            styles.badgeIconWrap,
            {
              backgroundColor: done
                ? "rgba(46,196,182,0.18)"
                : "rgba(255,255,255,0.05)",
              borderColor: C.line,
            },
          ]}
        >
          <Ionicons
            name={badge.icon}
            size={20}
            color={done ? C.aqua : C.muted}
          />
        </View>

        <View
          style={[
            styles.progressTrack,
            { backgroundColor: "rgba(255,255,255,0.05)", borderColor: C.line },
          ]}
        >
          <View
            style={{
              width: `${Math.round(ratio * 100)}%`,
              height: "100%",
              backgroundColor: done ? C.aqua : C.accent,
              opacity: done ? 1 : 0.8,
            }}
          />
        </View>
      </View>

      <Text style={[styles.badgeTitle, { color: C.text }]} numberOfLines={1}>
        {badge.title}
      </Text>
      <Text style={[styles.badgeSub, { color: C.muted }]} numberOfLines={2}>
        {badge.subtitle}
      </Text>

      <Text
        style={[styles.badgeFoot, { color: done ? C.aqua : C.muted }]}
        numberOfLines={1}
      >
        {done
          ? "Unlocked"
          : `Locked • ${formatProgress(badge.progress, badge.total)}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: s(16),
    paddingTop: s(10),
    paddingBottom: s(8),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: s(22), fontWeight: "800", letterSpacing: s(0.2) },
  doneBtn: {
    height: s(36),
    width: s(44),
    borderRadius: s(14),
    alignItems: "center",
    justifyContent: "center",
  },

  segmentWrap: {
    alignSelf: "center",
    marginTop: s(6),
    marginBottom: s(10),
    borderRadius: s(18),
    borderWidth: s(1),
    overflow: "hidden",
    flexDirection: "row",
    position: "relative",
  },
  segmentIndicator: {
    position: "absolute",
    left: s(0),
    top: s(0),
    bottom: s(0),
    borderRadius: s(18),
  },
  segmentItem: {
    paddingVertical: s(10),
    paddingHorizontal: s(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(8),
  },
  segmentText: { fontSize: s(13), fontWeight: "700" },

  content: { flex: 1 },
  scrollPad: { paddingHorizontal: s(16), paddingTop: s(8), paddingBottom: s(100) },

  heroCard: {
    borderWidth: s(1),
    borderRadius: s(20),
    padding: s(14),
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: s(12) },
  avatar: {
    width: s(46),
    height: s(46),
    borderRadius: s(18),
    alignItems: "center",
    justifyContent: "center",
  },
  heroName: { fontSize: s(18), fontWeight: "800" },
  heroSub: { marginTop: s(2), fontSize: s(13), fontWeight: "600" },
  heroAction: {
    height: s(36),
    paddingHorizontal: s(12),
    borderRadius: s(14),
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
  },
  heroActionText: { fontSize: s(13), fontWeight: "800" },

  weekRow: {
    marginTop: s(14),
    flexDirection: "row",
    gap: s(8),
    justifyContent: "space-between",
  },
  weekBarWrap: {
    flex: 1,
    height: s(28),
    borderRadius: s(12),
    alignItems: "center",
    justifyContent: "flex-end",
    padding: s(5),
  },

  heroStatsRow: { marginTop: s(12), flexDirection: "row", gap: s(10) },
  statPill: {
    flex: 1,
    borderWidth: s(1),
    borderRadius: s(16),
    paddingVertical: s(10),
    paddingHorizontal: s(10),
    flexDirection: "row",
    gap: s(10),
    alignItems: "center",
  },
  statLabel: { fontSize: s(11), fontWeight: "700" },
  statValue: { marginTop: s(2), fontSize: s(14), fontWeight: "900" },

  card: {
    marginTop: s(12),
    borderWidth: s(1),
    borderRadius: s(20),
    padding: s(14),
  },
  cardTitle: { fontSize: s(16), fontWeight: "900" },
  cardSub: { marginTop: s(6), fontSize: s(13), fontWeight: "600", lineHeight: s(18) },

  primaryBtn: {
    marginTop: s(12),
    height: s(44),
    borderRadius: s(16),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(8),
  },
  primaryBtnText: { color: "#fff", fontSize: s(14), fontWeight: "900" },

  sectionTitle: {
    marginTop: s(10),
    marginBottom: s(8),
    fontSize: s(12),
    fontWeight: "800",
    letterSpacing: s(0.4),
  },
  sectionCard: {
    borderWidth: s(1),
    borderRadius: s(20),
    overflow: "hidden",
  },

  row: {
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
    paddingRight: s(10),
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
    maxWidth: "50%",
  },
  rowLabel: { fontSize: s(14), fontWeight: "800" },
  rowValue: { fontSize: s(13), fontWeight: "700" },

  colorRowWrap: {
    marginTop: s(10),
    borderWidth: s(1),
    borderRadius: s(20),
    padding: s(14),
  },
  colorRowHeader: { flexDirection: "row", alignItems: "center", gap: s(10) },
  swatches: { marginTop: s(12), flexDirection: "row", flexWrap: "wrap", gap: s(10) },
  swatch: {
    width: s(34),
    height: s(34),
    borderRadius: s(12),
    alignItems: "center",
    justifyContent: "center",
  },

  dangerCard: {
    marginTop: s(14),
    borderWidth: s(1),
    borderRadius: s(20),
    overflow: "hidden",
  },
  dangerRow: {
    height: s(52),
    paddingHorizontal: s(14),
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
  },
  dangerText: { fontSize: s(14), fontWeight: "900" },
  sep: { height: s(1), width: "100%" },

  badgeCard: {
    flex: 1,
    borderWidth: s(1),
    borderRadius: s(20),
    padding: s(14),
    minHeight: s(150),
  },
  badgeTop: { flexDirection: "row", alignItems: "center", gap: s(10) },
  badgeIconWrap: {
    width: s(42),
    height: s(42),
    borderRadius: s(16),
    borderWidth: s(1),
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    flex: 1,
    height: s(10),
    borderRadius: s(8),
    borderWidth: s(1),
    overflow: "hidden",
  },
  badgeTitle: { marginTop: s(10), fontSize: s(14), fontWeight: "900" },
  badgeSub: { marginTop: s(6), fontSize: s(12.5), fontWeight: "700", lineHeight: s(17) },
  badgeFoot: { marginTop: s(10), fontSize: s(12), fontWeight: "900" },

  modalOverlay: {
    position: "absolute",
    left: s(0),
    right: s(0),
    top: s(0),
    bottom: s(0),
    alignItems: "center",
    justifyContent: "center",
    padding: s(16),
  },
  modalCard: {
    width: "100%",
    maxWidth: s(520),
    borderRadius: s(20),
    borderWidth: s(1),
    padding: s(14),
  },
  modalTitle: { fontSize: s(16), fontWeight: "900" },
  modalSub: { marginTop: s(6), fontSize: s(13), fontWeight: "700" },
  modalInput: {
    marginTop: s(12),
    borderWidth: s(1),
    borderRadius: s(14),
    paddingHorizontal: s(12),
    paddingVertical: s(10),
    fontSize: s(14),
    fontWeight: "800",
  },
  modalActions: {
    marginTop: s(12),
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: s(10),
  },
  modalBtn: {
    height: s(40),
    paddingHorizontal: s(12),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: s(12),
  },
  modalBtnPrimary: {},
  modalBtnText: { fontSize: s(14), fontWeight: "900" },
  
  // Loading screen styles
  loadingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s(32),
  },
  loadingContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingTitle: {
    fontSize: s(20),
    fontWeight: "900",
    textAlign: "center",
  },
  loadingSubtitle: {
    fontSize: s(14),
    fontWeight: "600",
    textAlign: "center",
    lineHeight: s(20),
  },
});
