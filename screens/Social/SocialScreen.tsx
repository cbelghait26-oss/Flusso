// screens/Social/SocialScreen.tsx
// ─── Social Hub: Friends | Leaderboard | Shared ───────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "../../src/components/theme/theme";
import { s } from "../../src/ui/ts";
import { auth } from "../../src/services/firebase";
import {
  acceptFriendRequest,
  acceptSharedInvite,
  createSharedEvent,
  createSharedObjective,
  declineFriendRequest,
  declineSharedInvite,
  ensureUserProfile,
  getFriends,
  getIncomingRequests,
  getLeaderboard,
  getMySharedEvents,
  getMySharedInvites,
  getMySharedObjectives,
  pushMyMetrics,
  removeFriend,
  type Friendship,
  type LeaderboardEntry,
  type LeaderboardRange,
  type SharedEvent,
  type SharedInvite,
  type SharedObjective,
  type UserProfile,
} from "../../src/services/SocialService";
import {
  loadFocusMinutesToday,
  loadStreakDays,
  loadSetupName,
  loadTasksCompletedToday,
} from "../../src/data/storage";
import type { RootStackParamList } from "../../src/navigation/types";
import { refreshPendingBadge } from "../../src/navigation/AppTabs";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type SocialTab = "friends" | "leaderboard" | "shared";

const MEDAL_COLORS = [
  { bg: "#FFD700", text: "#7A5800", bar: "#FFD700" }, // gold
  { bg: "#C0C0C0", text: "#505050", bar: "#B0B0B0" }, // silver
  { bg: "#CD7F32", text: "#5A2D00", bar: "#CD7F32" }, // bronze
];

const TABS: { key: SocialTab; label: string }[] = [
  { key: "friends", label: "Friends" },
  { key: "leaderboard", label: "Leaderboard" },
  { key: "shared", label: "Shared" },
];

const LEADERBOARD_RANGES: { key: LeaderboardRange; label: string }[] = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "Week" },
  { key: "monthly", label: "Month" },
  { key: "yearly", label: "Year" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({
  name,
  size = 40,
  accent,
}: {
  name?: string;
  size?: number;
  accent: string;
}) {
  const initials = (name ?? "")
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
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
      <Text
        style={{
          color: accent,
          fontSize: s(size * 0.36),
          fontWeight: "900",
        }}
      >
        {initials || "?"}
      </Text>
    </View>
  );
}

function SectionHeader({ title, C }: { title: string; C: any }) {
  return (
    <Text
      style={{
        fontSize: s(11),
        fontWeight: "800",
        color: C.muted,
        letterSpacing: 1.1,
        textTransform: "uppercase",
        marginTop: s(20),
        marginBottom: s(8),
        paddingHorizontal: s(2),
      }}
    >
      {title}
    </Text>
  );
}

function EmptyState({
  icon,
  text,
  C,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  C: any;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: s(36),
        gap: s(10),
      }}
    >
      <Ionicons name={icon} size={s(32)} color={C.muted + "60"} />
      <Text
        style={{
          color: C.muted,
          fontSize: s(13),
          textAlign: "center",
          maxWidth: s(220),
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function FocusBar({ minutes, max, accent }: { minutes: number; max: number; accent: string }) {
  const pct = max > 0 ? Math.min(minutes / max, 1) : 0;
  return (
    <View
      style={{
        height: s(4),
        backgroundColor: accent + "1A",
        borderRadius: s(2),
        flex: 1,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${Math.round(pct * 100)}%`,
          height: "100%",
          backgroundColor: accent,
          borderRadius: s(2),
        }}
      />
    </View>
  );
}

// ── Friend Picker (used inside creation modals) ─────────────────────────────

function FriendPicker({
  friends,
  selected,
  onToggle,
}: {
  friends: { profile: UserProfile }[];
  selected: Set<string>;
  onToggle: (uid: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const C = useMemo(
    () => ({
      text: colors.text,
      muted: colors.muted,
      accent: colors.accent,
      line: colors.border,
      card2: (colors as any).card2 ?? (isDark ? "#1a1a2e" : "#f5f5f7"),
    }),
    [colors, isDark]
  );
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? friends.filter(
        (f) =>
          f.profile.displayName.toLowerCase().includes(search.toLowerCase()) ||
          (f.profile.friendTag ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : friends;

  if (friends.length === 0) return null;

  return (
    <View style={{ marginTop: s(14) }}>
      <Text style={{ fontSize: s(11), fontWeight: "700", color: C.muted, marginBottom: s(8), letterSpacing: 0.5 }}>
        SHARE WITH FRIENDS
      </Text>
      {friends.length > 3 && (
        <View style={{ flexDirection: "row", alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, borderRadius: s(9), paddingHorizontal: s(10), marginBottom: s(8), backgroundColor: C.card2 }}>
          <Ionicons name="search" size={s(14)} color={C.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search friends…"
            placeholderTextColor={C.muted}
            style={{ flex: 1, fontSize: s(13), paddingVertical: s(8), paddingLeft: s(6), color: C.text }}
          />
        </View>
      )}
      <ScrollView style={{ maxHeight: s(180) }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {filtered.map((f) => {
          const isSel = selected.has(f.profile.uid);
          return (
            <Pressable
              key={f.profile.uid}
              onPress={() => onToggle(f.profile.uid)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: s(9),
                gap: s(10),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{
                width: s(20), height: s(20), borderRadius: s(6),
                borderWidth: s(1.5),
                borderColor: isSel ? C.accent : C.line,
                backgroundColor: isSel ? C.accent : "transparent",
                alignItems: "center", justifyContent: "center",
              }}>
                {isSel && <Ionicons name="checkmark" size={s(12)} color="#fff" />}
              </View>
              <Text style={{ flex: 1, fontSize: s(13), fontWeight: "700", color: C.text }} numberOfLines={1}>
                {f.profile.displayName}
              </Text>
              <Text style={{ fontSize: s(11), color: C.accent }}>#{f.profile.friendTag ?? ""}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SocialScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, isDark } = useTheme();

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

  const myUid = auth.currentUser?.uid ?? "";

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<SocialTab>("friends");

  // ── Friends state ──────────────────────────────────────────────────────────
  const [friends, setFriends] = useState<{ profile: UserProfile; friendship: Friendship }[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState<Record<string, boolean>>({});

  // ── Shared invites state ──────────────────────────────────────────────────
  const [sharedInvites, setSharedInvites] = useState<SharedInvite[]>([]);
  const [inviteActioning, setInviteActioning] = useState<Record<string, boolean>>({});

  // ── Leaderboard state ──────────────────────────────────────────────────────
  const [lbRange, setLbRange] = useState<LeaderboardRange>("daily");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  // ── Shared state ──────────────────────────────────────────────────────────
  const [sharedObjectives, setSharedObjectives] = useState<SharedObjective[]>([]);
  const [sharedEvents, setSharedEvents] = useState<SharedEvent[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);

  // ── New Objective modal ────────────────────────────────────────────────────
  const [newObjModal, setNewObjModal] = useState(false);
  const [newObjTitle, setNewObjTitle] = useState("");
  const [newObjSaving, setNewObjSaving] = useState(false);
  const [newObjInvitees, setNewObjInvitees] = useState<Set<string>>(new Set());

  // ── New Event modal ────────────────────────────────────────────────────────
  const [newEvtModal, setNewEvtModal] = useState(false);
  const [newEvtTitle, setNewEvtTitle] = useState("");
  const [newEvtDate, setNewEvtDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newEvtSaving, setNewEvtSaving] = useState(false);
  const [newEvtInvitees, setNewEvtInvitees] = useState<Set<string>>(new Set());

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadFriendsData = useCallback(async () => {
    setFriendsLoading(true);
    try {
      const [f, r, inv] = await Promise.all([
        getFriends().catch(() => [] as typeof friends),
        getIncomingRequests().catch(() => [] as Friendship[]),
        getMySharedInvites().catch(() => [] as SharedInvite[]),
      ]);
      setFriends(f);
      setRequests(r);
      setSharedInvites(inv);
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      // Fetch friends directly instead of relying on state to avoid race
      // condition where state is empty when the tab first activates.
      const [currentFriends, fm, tc, sk] = await Promise.all([
        getFriends().catch(() => [] as typeof friends),
        loadFocusMinutesToday(),
        loadTasksCompletedToday(),
        loadStreakDays(),
      ]);

      // Push our own metrics so friends see up-to-date data
      pushMyMetrics(fm, tc, sk).catch(() => {});

      const friendUids = currentFriends.map((f) => f.profile.uid);
      const entries = await getLeaderboard(friendUids, { focusMinutes: fm, tasksCompleted: tc, streak: sk }, lbRange);
      setLeaderboard(entries);
    } catch {
      // silent
    } finally {
      setLbLoading(false);
    }
  }, [lbRange]);

  const loadSharedData = useCallback(async () => {
    setSharedLoading(true);
    try {
      const [objs, evts] = await Promise.all([
        getMySharedObjectives(),
        getMySharedEvents(),
      ]);
      const today = new Date().toISOString().slice(0, 10);
      setSharedObjectives(objs.filter((o) => o.status !== "completed"));
      setSharedEvents(evts.filter((e) => e.date >= today));
    } catch {
      // silent
    } finally {
      setSharedLoading(false);
    }
  }, []);

  // Ensure the current user has a public profile in Firestore
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      loadSetupName().then((localName) => {
        ensureUserProfile(
          localName || user.email?.split("@")[0] || null,
          null
        ).catch(() => {});
      }).catch(() => {});
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFriendsData();
      refreshPendingBadge();
    }, [loadFriendsData])
  );

  useEffect(() => {
    if (activeTab === "leaderboard") loadLeaderboard();
    if (activeTab === "shared") loadSharedData();
  }, [activeTab, lbRange]);

  // ── Shared invite actions ────────────────────────────────────────────────

  async function handleAcceptInvite(invite: SharedInvite) {
    setInviteActioning((prev) => ({ ...prev, [invite.id]: true }));
    try {
      await acceptSharedInvite(invite);
      setSharedInvites((prev) => prev.filter((i) => i.id !== invite.id));
      refreshPendingBadge();
      // Refresh shared data so the newly joined item appears
      loadSharedData();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to accept invite.");
    } finally {
      setInviteActioning((prev) => ({ ...prev, [invite.id]: false }));
    }
  }

  async function handleDeclineInvite(invite: SharedInvite) {
    setInviteActioning((prev) => ({ ...prev, [invite.id]: true }));
    try {
      await declineSharedInvite(invite.id);
      setSharedInvites((prev) => prev.filter((i) => i.id !== invite.id));
      refreshPendingBadge();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to decline invite.");
    } finally {
      setInviteActioning((prev) => ({ ...prev, [invite.id]: false }));
    }
  }

  // ── Friend request actions ────────────────────────────────────────────────

  async function handleAccept(fromUid: string) {
    setRequestsLoading((prev) => ({ ...prev, [fromUid]: true }));
    try {
      await acceptFriendRequest(fromUid);
      await loadFriendsData();
      refreshPendingBadge();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to accept request.");
    } finally {
      setRequestsLoading((prev) => ({ ...prev, [fromUid]: false }));
    }
  }

  async function handleDecline(fromUid: string) {
    setRequestsLoading((prev) => ({ ...prev, [fromUid]: true }));
    try {
      await declineFriendRequest(fromUid);
      setRequests((prev) => prev.filter((r) => r.user_id !== fromUid));
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to decline request.");
    } finally {
      setRequestsLoading((prev) => ({ ...prev, [fromUid]: false }));
    }
  }

  function handleRemoveFriend(friendUid: string, name: string) {
    Alert.alert(
      "Remove friend",
      `Remove ${name} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeFriend(friendUid);
              setFriends((prev) => prev.filter((f) => f.profile.uid !== friendUid));
            } catch (e: any) {
              Alert.alert("Error", e.message ?? "Failed to remove friend.");
            }
          },
        },
      ]
    );
  }

  // ── Create shared objective ───────────────────────────────────────────────

  async function handleCreateObjective() {
    if (!newObjTitle.trim()) return;
    setNewObjSaving(true);
    try {
      const obj = await createSharedObjective(newObjTitle.trim(), [...newObjInvitees]);
      setSharedObjectives((prev) => [obj, ...prev]);
      setNewObjModal(false);
      setNewObjTitle("");
      setNewObjInvitees(new Set());
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to create objective.");
    } finally {
      setNewObjSaving(false);
    }
  }

  // ── Create shared event ───────────────────────────────────────────────────

  async function handleCreateEvent() {
    if (!newEvtTitle.trim() || !newEvtDate) return;
    setNewEvtSaving(true);
    try {
      const evt = await createSharedEvent(newEvtTitle.trim(), newEvtDate, [...newEvtInvitees]);
      setSharedEvents((prev) => [evt, ...prev]);
      setNewEvtModal(false);
      setNewEvtTitle("");
      setNewEvtInvitees(new Set());
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to create event.");
    } finally {
      setNewEvtSaving(false);
    }
  }

  // ── Leaderboard max value for bar scaling ─────────────────────────────────

  const lbMax = useMemo(
    () => Math.max(1, ...leaderboard.map((e) => e.focusMinutes)),
    [leaderboard]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[ss.safe, { backgroundColor: C.bg }]} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[ss.header, { borderBottomColor: C.line }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [ss.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={s(22)} color={C.text} />
        </Pressable>
        <Text style={[ss.headerTitle, { color: C.text }]}>Social</Text>
        <Pressable
          onPress={() => (navigation as any).navigate("AddFriend")}
          style={({ pressed }) => [ss.addBtn, { backgroundColor: C.accent + "18", opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="person-add-outline" size={s(16)} color={C.accent} />
        </Pressable>
      </View>

      {/* Tab bar */}
      <View style={[ss.tabBar, { backgroundColor: C.card, borderColor: C.line }]}>
        {TABS.map((t, i) => {
          const isFocused = t.key === activeTab;
          const badgeCount = t.key === "friends" ? requests.length + sharedInvites.length : 0;
          return (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={ss.tabItem}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: s(5) }}>
                <Text
                  style={[
                    ss.tabLabel,
                    { color: isFocused ? C.accent : C.muted },
                  ]}
                >
                  {t.label}
                </Text>
                {badgeCount > 0 && (
                  <View style={{ minWidth: s(17), height: s(17), borderRadius: s(9), backgroundColor: "#FF3B30", alignItems: "center", justifyContent: "center", paddingHorizontal: s(3) }}>
                    <Text style={{ color: "#fff", fontSize: s(10), fontWeight: "900" }}>{badgeCount > 99 ? "99+" : badgeCount}</Text>
                  </View>
                )}
              </View>
              {isFocused && (
                <View style={[ss.tabIndicator, { backgroundColor: C.accent }]} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ── FRIENDS TAB ──────────────────────────────────────────────────── */}
      {activeTab === "friends" && (
        <ScrollView
          contentContainerStyle={ss.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={friendsLoading}
              onRefresh={loadFriendsData}
              tintColor={C.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Shared invites (event / objective invitations pending acceptance) */}
          {sharedInvites.length > 0 && (
            <>
              <SectionHeader title={`Invites · ${sharedInvites.length}`} C={C} />
              <View style={[ss.card, { backgroundColor: C.card, borderColor: C.line }]}>
                {sharedInvites.map((inv, idx) => (
                  <View key={inv.id}>
                    {idx > 0 && <View style={[ss.divider, { backgroundColor: C.line }]} />}
                    <View style={ss.requestRow}>
                      <View style={{ width: s(38), height: s(38), borderRadius: s(14), backgroundColor: C.accent + "18", borderWidth: s(1), borderColor: C.accent + "44", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={inv.type === "event" ? "calendar-outline" : "flag-outline"} size={s(18)} color={C.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[ss.friendName, { color: C.text }]} numberOfLines={1}>{inv.title}</Text>
                        <Text style={[ss.friendSub, { color: C.muted }]} numberOfLines={1}>
                          {inv.type === "event" ? "Event" : "Objective"} from {inv.fromName}{inv.date ? ` · ${inv.date}` : ""}
                        </Text>
                      </View>
                      {inviteActioning[inv.id] ? (
                        <ActivityIndicator size="small" color={C.accent} />
                      ) : (
                        <View style={ss.requestActions}>
                          <Pressable
                            onPress={() => handleAcceptInvite(inv)}
                            style={({ pressed }) => [ss.acceptBtn, { backgroundColor: C.accent + "18", borderColor: C.accent + "44", opacity: pressed ? 0.7 : 1 }]}
                          >
                            <Text style={[ss.acceptLabel, { color: C.accent }]}>Accept</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeclineInvite(inv)}
                            style={({ pressed }) => [ss.declineBtn, { backgroundColor: C.muted + "14", borderColor: C.line, opacity: pressed ? 0.7 : 1 }]}
                          >
                            <Ionicons name="close" size={s(14)} color={C.muted} />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Incoming requests */}
          {requests.length > 0 && (
            <>
              <SectionHeader title={`Requests · ${requests.length}`} C={C} />
              <View style={[ss.card, { backgroundColor: C.card, borderColor: C.line }]}>
                {requests.map((req, idx) => (
                  <View key={req.id}>
                    {idx > 0 && <View style={[ss.divider, { backgroundColor: C.line }]} />}
                    <View style={ss.requestRow}>
                      <Avatar name={req.from_display_name} size={38} accent={C.accent} />
                      <View style={{ flex: 1 }}>
                        <Text style={[ss.friendName, { color: C.text }]}>
                          {req.from_display_name}
                        </Text>
                        <Text style={[ss.friendSub, { color: C.accent }]}>
                          #{req.from_tag}
                        </Text>
                      </View>
                      {requestsLoading[req.user_id] ? (
                        <ActivityIndicator size="small" color={C.accent} />
                      ) : (
                        <View style={ss.requestActions}>
                          <Pressable
                            onPress={() => handleAccept(req.user_id)}
                            style={({ pressed }) => [
                              ss.acceptBtn,
                              { backgroundColor: C.accent + "18", borderColor: C.accent + "44", opacity: pressed ? 0.7 : 1 },
                            ]}
                          >
                            <Text style={[ss.acceptLabel, { color: C.accent }]}>Accept</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleDecline(req.user_id)}
                            style={({ pressed }) => [
                              ss.declineBtn,
                              { backgroundColor: C.muted + "14", borderColor: C.line, opacity: pressed ? 0.7 : 1 },
                            ]}
                          >
                            <Ionicons name="close" size={s(14)} color={C.muted} />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Friends list */}
          <SectionHeader title={`Friends · ${friends.length}`} C={C} />
          {friends.length === 0 ? (
            <EmptyState
              icon="people-outline"
              text={"No friends yet.\nTap + to search and add people."}
              C={C}
            />
          ) : (
            <View style={[ss.card, { backgroundColor: C.card, borderColor: C.line }]}>
              {friends.map(({ profile }, idx) => (
                <View key={profile.uid}>
                  {idx > 0 && <View style={[ss.divider, { backgroundColor: C.line }]} />}
                  <Pressable
                    onLongPress={() => handleRemoveFriend(profile.uid, profile.displayName)}
                    style={ss.friendRow}
                  >
                    <Avatar name={profile.displayName} size={40} accent={C.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={[ss.friendName, { color: C.text }]}>
                        {profile.displayName}
                      </Text>
                      <Text style={[ss.friendSub, { color: C.accent }]}>
                        #{profile.friendTag}
                      </Text>
                    </View>
                    <Ionicons name="ellipsis-horizontal" size={s(16)} color={C.muted + "60"} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Text style={[ss.hint, { color: C.muted }]}>Long-press a friend to remove them.</Text>
        </ScrollView>
      )}

      {/* ── LEADERBOARD TAB ──────────────────────────────────────────────── */}
      {activeTab === "leaderboard" && (
        <ScrollView
          contentContainerStyle={ss.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={lbLoading}
              onRefresh={loadLeaderboard}
              tintColor={C.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Range selector */}
          <View style={[ss.rangeBar, { backgroundColor: C.card, borderColor: C.line }]}>
            {LEADERBOARD_RANGES.map((r) => {
              const isActive = r.key === lbRange;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setLbRange(r.key)}
                  style={[
                    ss.rangeBtn,
                    isActive && { backgroundColor: C.accent + "18", borderColor: C.accent + "44" },
                  ]}
                >
                  <Text
                    style={[
                      ss.rangeLabel,
                      { color: isActive ? C.accent : C.muted },
                    ]}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Metric label */}
          <SectionHeader title="Focus time · ranked" C={C} />

          {lbLoading ? (
            <ActivityIndicator
              color={C.accent}
              style={{ marginTop: s(40) }}
            />
          ) : leaderboard.length === 0 ? (
            <EmptyState
              icon="trophy-outline"
              text={"Add friends to compare\nyour focus and progress."}
              C={C}
            />
          ) : (
            <View style={[ss.card, { backgroundColor: C.card, borderColor: C.line }]}>
              {leaderboard.map((entry, idx) => {
                const medal = idx < 3 ? MEDAL_COLORS[idx] : null;
                const nameColor = medal ? medal.text : C.muted;
                const barColor = medal ? medal.bar : C.muted + "99";
                const avatarAccent = medal ? medal.bar : (entry.isMe ? C.accent : C.muted);
                return (
                  <View key={entry.uid}>
                    {idx > 0 && <View style={[ss.divider, { backgroundColor: C.line }]} />}
                    <View
                      style={[
                        ss.lbRow,
                        entry.isMe && { backgroundColor: C.accent + "08" },
                      ]}
                    >
                      {/* Rank badge */}
                      {medal ? (
                        <View style={{ width: s(28), alignItems: "center", justifyContent: "center" }}>
                          <View style={{ width: s(26), height: s(26), borderRadius: s(13), backgroundColor: medal.bg, alignItems: "center", justifyContent: "center", shadowColor: medal.bg, shadowOpacity: 0.6, shadowRadius: s(4), elevation: 3 }}>
                            <Text style={{ color: medal.text, fontSize: s(12), fontWeight: "900" }}>{idx + 1}</Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={[ss.lbRank, { color: C.muted + "66" }]}>{idx + 1}</Text>
                      )}

                      <Avatar
                        name={entry.displayName}
                        size={36}
                        accent={avatarAccent}
                      />

                      <View style={{ flex: 1, gap: s(4) }}>
                        <View style={ss.lbMeta}>
                          <Text
                            style={[
                              ss.lbName,
                              { color: medal ? nameColor : (entry.isMe ? C.text : C.muted), fontWeight: entry.isMe || medal ? "900" : "700" },
                            ]}
                            numberOfLines={1}
                          >
                            {entry.isMe ? "You" : entry.displayName}
                          </Text>
                          <Text style={[ss.lbValue, { color: medal ? medal.bar : C.accent }]}>
                            {entry.focusMinutes >= 60
                              ? `${Math.floor(entry.focusMinutes / 60)}:${String(entry.focusMinutes % 60).padStart(2, "0")}:00`
                              : `${String(entry.focusMinutes).padStart(2, "0")}:00`}
                          </Text>
                        </View>
                        <FocusBar minutes={entry.focusMinutes} max={lbMax} accent={barColor} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}


        </ScrollView>
      )}

      {/* ── SHARED TAB ───────────────────────────────────────────────────── */}
      {activeTab === "shared" && (
        <ScrollView
          contentContainerStyle={ss.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={sharedLoading}
              onRefresh={loadSharedData}
              tintColor={C.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Shared Objectives */}
          <View style={ss.sectionRow}>
            <SectionHeader title="Shared Objectives" C={C} />
            <Pressable
              onPress={() => setNewObjModal(true)}
              style={({ pressed }) => [
                ss.sectionAddBtn,
                { backgroundColor: C.accent + "14", opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="add" size={s(16)} color={C.accent} />
            </Pressable>
          </View>

          {sharedObjectives.length === 0 ? (
            <EmptyState
              icon="flag-outline"
              text={"No shared objectives yet.\nCreate one to collaborate with friends."}
              C={C}
            />
          ) : (
            <View style={[ss.card, { backgroundColor: C.card, borderColor: C.line }]}>
              {sharedObjectives.map((obj, idx) => (
                <View key={obj.id}>
                  {idx > 0 && <View style={[ss.divider, { backgroundColor: C.line }]} />}
                  <View style={ss.sharedObjRow}>
                    <View
                      style={[ss.sharedObjDot, { backgroundColor: C.accent }]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[ss.sharedObjTitle, { color: C.text }]}>
                        {obj.title}
                      </Text>
                      <Text style={[ss.sharedObjSub, { color: C.muted }]}>
                        {obj.members.map((m) => m.displayName).join(", ")}
                      </Text>
                    </View>
                    <Text style={[ss.memberCount, { color: C.muted }]}>
                      {obj.members.length} member{obj.members.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Shared Events */}
          <View style={ss.sectionRow}>
            <SectionHeader title="Shared Events" C={C} />
            <Pressable
              onPress={() => setNewEvtModal(true)}
              style={({ pressed }) => [
                ss.sectionAddBtn,
                { backgroundColor: C.accent + "14", opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="add" size={s(16)} color={C.accent} />
            </Pressable>
          </View>

          {sharedEvents.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              text={"No shared events yet.\nCreate one for your team."}
              C={C}
            />
          ) : (
            <View style={[ss.card, { backgroundColor: C.card, borderColor: C.line }]}>
              {sharedEvents.map((evt, idx) => (
                <View key={evt.id}>
                  {idx > 0 && <View style={[ss.divider, { backgroundColor: C.line }]} />}
                  <View style={ss.sharedObjRow}>
                    <Ionicons name="calendar-outline" size={s(16)} color={C.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={[ss.sharedObjTitle, { color: C.text }]}>
                        {evt.title}
                      </Text>
                      <Text style={[ss.sharedObjSub, { color: C.muted }]}>
                        {evt.date}
                      </Text>
                    </View>
                    <Text style={[ss.memberCount, { color: C.muted }]}>
                      {evt.participants.length} participant{evt.participants.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── New Objective Modal ───────────────────────────────────────────── */}
      <Modal
        visible={newObjModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setNewObjModal(false); setNewObjInvitees(new Set()); }}
      >
        <Pressable
          style={ss.modalOverlay}
          onPress={() => { setNewObjModal(false); setNewObjInvitees(new Set()); }}
        >
          <Pressable style={[ss.modalCard, { backgroundColor: C.card, borderColor: C.line }]} onPress={() => {}}>
            <Text style={[ss.modalTitle, { color: C.text }]}>New Shared Objective</Text>
            <TextInput
              value={newObjTitle}
              onChangeText={setNewObjTitle}
              placeholder="Objective title…"
              placeholderTextColor={C.muted}
              style={[ss.modalInput, { color: C.text, borderColor: C.line, backgroundColor: C.card2 }]}
              autoFocus
              maxLength={100}
            />
            <FriendPicker
              friends={friends}
              selected={newObjInvitees}
              onToggle={(uid) =>
                setNewObjInvitees((prev) => {
                  const next = new Set(prev);
                  next.has(uid) ? next.delete(uid) : next.add(uid);
                  return next;
                })
              }
            />
            <View style={ss.modalActions}>
              <Pressable
                onPress={() => { setNewObjModal(false); setNewObjInvitees(new Set()); }}
                style={({ pressed }) => [ss.modalCancelBtn, { borderColor: C.line, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[ss.modalCancelLabel, { color: C.muted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateObjective}
                disabled={newObjSaving || !newObjTitle.trim()}
                style={({ pressed }) => [
                  ss.modalConfirmBtn,
                  { backgroundColor: C.accent, opacity: (pressed || !newObjTitle.trim()) ? 0.6 : 1 },
                ]}
              >
                {newObjSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={ss.modalConfirmLabel}>Create</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── New Event Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={newEvtModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setNewEvtModal(false); setNewEvtInvitees(new Set()); }}
      >
        <Pressable
          style={ss.modalOverlay}
          onPress={() => { setNewEvtModal(false); setNewEvtInvitees(new Set()); }}
        >
          <Pressable style={[ss.modalCard, { backgroundColor: C.card, borderColor: C.line }]} onPress={() => {}}>
            <Text style={[ss.modalTitle, { color: C.text }]}>New Shared Event</Text>
            <TextInput
              value={newEvtTitle}
              onChangeText={setNewEvtTitle}
              placeholder="Event title…"
              placeholderTextColor={C.muted}
              style={[ss.modalInput, { color: C.text, borderColor: C.line, backgroundColor: C.card2 }]}
              autoFocus
              maxLength={100}
            />
            <TextInput
              value={newEvtDate}
              onChangeText={setNewEvtDate}
              placeholder="Date (YYYY-MM-DD)…"
              placeholderTextColor={C.muted}
              style={[ss.modalInput, { color: C.text, borderColor: C.line, backgroundColor: C.card2, marginTop: s(8) }]}
              maxLength={10}
              keyboardType="numeric"
            />
            <FriendPicker
              friends={friends}
              selected={newEvtInvitees}
              onToggle={(uid) =>
                setNewEvtInvitees((prev) => {
                  const next = new Set(prev);
                  next.has(uid) ? next.delete(uid) : next.add(uid);
                  return next;
                })
              }
            />
            <View style={ss.modalActions}>
              <Pressable
                onPress={() => { setNewEvtModal(false); setNewEvtInvitees(new Set()); }}
                style={({ pressed }) => [ss.modalCancelBtn, { borderColor: C.line, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[ss.modalCancelLabel, { color: C.muted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateEvent}
                disabled={newEvtSaving || !newEvtTitle.trim()}
                style={({ pressed }) => [
                  ss.modalConfirmBtn,
                  { backgroundColor: C.accent, opacity: (pressed || !newEvtTitle.trim()) ? 0.6 : 1 },
                ]}
              >
                {newEvtSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={ss.modalConfirmLabel}>Create</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(16),
    paddingVertical: s(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { marginRight: s(8) },
  headerTitle: { fontSize: s(18), fontWeight: "800", flex: 1 },
  addBtn: {
    padding: s(8),
    borderRadius: s(10),
  },

  tabBar: {
    flexDirection: "row",
    marginHorizontal: s(16),
    marginTop: s(12),
    borderRadius: s(12),
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: s(10),
    position: "relative",
  },
  tabLabel: { fontSize: s(13), fontWeight: "700" },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: "15%",
    right: "15%",
    height: s(2),
    borderRadius: s(1),
  },

  scrollContent: {
    paddingHorizontal: s(16),
    paddingBottom: s(120),
  },

  card: {
    borderRadius: s(14),
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },

  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: s(16) },

  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(14),
    paddingVertical: s(12),
    gap: s(12),
  },
  requestActions: { flexDirection: "row", alignItems: "center", gap: s(8) },
  acceptBtn: {
    paddingVertical: s(5),
    paddingHorizontal: s(12),
    borderRadius: s(8),
    borderWidth: s(1),
  },
  acceptLabel: { fontSize: s(12), fontWeight: "800" },
  declineBtn: {
    width: s(28),
    height: s(28),
    borderRadius: s(8),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(14),
    paddingVertical: s(12),
    gap: s(12),
  },
  friendName: { fontSize: s(14), fontWeight: "700" },
  friendSub: { fontSize: s(12), marginTop: s(1) },

  hint: {
    fontSize: s(11),
    textAlign: "center",
    marginTop: s(10),
    opacity: 0.6,
  },

  rangeBar: {
    flexDirection: "row",
    marginTop: s(12),
    borderRadius: s(12),
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  rangeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: s(9),
    borderRadius: s(8),
    borderWidth: s(1),
    borderColor: "transparent",
    margin: s(3),
  },
  rangeLabel: { fontSize: s(12), fontWeight: "700" },

  lbRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(14),
    paddingVertical: s(12),
    gap: s(10),
    borderRadius: s(8),
  },
  lbRank: { fontSize: s(13), fontWeight: "900", width: s(18), textAlign: "center" },
  lbMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lbName: { fontSize: s(13), fontWeight: "700", flex: 1 },
  lbValue: { fontSize: s(12), fontWeight: "800" },

  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(14),
    paddingVertical: s(11),
    gap: s(10),
  },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionAddBtn: {
    padding: s(6),
    borderRadius: s(8),
    marginTop: s(16),
  },

  sharedObjRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(14),
    paddingVertical: s(13),
    gap: s(10),
  },
  sharedObjDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
  },
  sharedObjTitle: { fontSize: s(13), fontWeight: "700" },
  sharedObjSub: { fontSize: s(11), marginTop: s(2) },
  memberCount: { fontSize: s(11), fontWeight: "700" },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: s(24),
  },
  modalCard: {
    width: "100%",
    maxWidth: s(360),
    borderRadius: s(18),
    borderWidth: StyleSheet.hairlineWidth,
    padding: s(24),
  },
  modalTitle: {
    fontSize: s(16),
    fontWeight: "800",
    marginBottom: s(16),
  },
  modalInput: {
    borderWidth: s(1),
    borderRadius: s(10),
    paddingHorizontal: s(12),
    paddingVertical: s(10),
    fontSize: s(14),
  },
  modalActions: {
    flexDirection: "row",
    gap: s(10),
    marginTop: s(20),
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: s(12),
    borderRadius: s(10),
    borderWidth: s(1),
    alignItems: "center",
  },
  modalCancelLabel: { fontSize: s(13), fontWeight: "700" },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: s(12),
    borderRadius: s(10),
    alignItems: "center",
  },
  modalConfirmLabel: { fontSize: s(13), fontWeight: "800", color: "#fff" },
});
