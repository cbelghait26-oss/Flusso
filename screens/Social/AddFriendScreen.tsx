// screens/Social/AddFriendScreen.tsx
// ─── Search users by username and send friend requests ────────────────────────
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useTheme } from "../../src/components/theme/theme";
import { s } from "../../src/ui/ts";
import {
  lookupByFriendTag,
  sendFriendRequest,
  type UserProfile,
} from "../../src/services/SocialService";

export default function AddFriendScreen() {
  const navigation = useNavigation();
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

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<UserProfile | null | "not-found">(null);
  const [searching, setSearching] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Normalise: strip leading # and uppercase
  function normalise(raw: string) {
    return raw.replace(/^#/, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function handleQueryChange(text: string) {
    // Strip any # the user typed, keep it clean in the box; prefix shown separately
    const stripped = text.replace(/^#+/, "");
    setQuery(stripped);
    setResult(null);
    setSent(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const normalised = normalise(stripped);
    if (normalised.length < 6) return;

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await lookupByFriendTag(normalised);
        setResult(found ?? "not-found");
      } catch {
        setResult("not-found");
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  async function handleSendRequest() {
    if (!result || result === "not-found") return;
    setSending(true);
    try {
      const res = await sendFriendRequest(result.uid);
      if (res.ok) {
        setSent(true);
      } else {
        Alert.alert("Could not send request", res.error ?? "Unknown error.");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to send request.");
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={[ss.safe, { backgroundColor: C.bg }]} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[ss.header, { borderBottomColor: C.line }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: s(8) })}
        >
          <Ionicons name="chevron-back" size={s(22)} color={C.text} />
        </Pressable>
        <Text style={[ss.headerTitle, { color: C.text }]}>Add Friend</Text>
      </View>

      {/* Search input */}
      <View style={[ss.searchWrap, { backgroundColor: C.card, borderColor: C.line }]}>
        <Text style={[ss.tagHash, { color: C.accent }]}>#</Text>
        <TextInput
          value={query}
          onChangeText={handleQueryChange}
          placeholder="Enter friend tag…"
          placeholderTextColor={C.muted}
          style={[ss.searchInput, { color: C.text }]}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          maxLength={6}
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(""); setResult(null); setSent(false); }}>
            <Ionicons name="close-circle" size={s(16)} color={C.muted} />
          </Pressable>
        )}
      </View>

      <Text style={[ss.tagHint, { color: C.muted }]}>Example: #A4K92T</Text>

      <ScrollView
        contentContainerStyle={ss.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {searching && (
          <ActivityIndicator color={C.accent} style={{ marginTop: s(32) }} />
        )}

        {/* Not found */}
        {!searching && result === "not-found" && (
          <View style={ss.emptyWrap}>
            <Ionicons name="person-outline" size={s(32)} color={C.muted + "50"} />
            <Text style={[ss.emptyText, { color: C.muted }]}>No user found for #{normalise(query)}</Text>
          </View>
        )}

        {/* Found profile card */}
        {!searching && result && result !== "not-found" && (
          <View style={[ss.card, { backgroundColor: C.card, borderColor: C.line }]}>
            <View style={ss.resultRow}>
              {/* Avatar */}
              <View
                style={[
                  ss.avatar,
                  { backgroundColor: C.accent + "22", borderColor: C.accent + "44" },
                ]}
              >
                <Text style={[ss.avatarText, { color: C.accent }]}>
                  {(result.displayName ?? "")
                    .trim()
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() ?? "")
                    .join("") || "?"}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[ss.resultName, { color: C.text }]} numberOfLines={1}>
                  {result.displayName}
                </Text>
                <Text style={[ss.resultTag, { color: C.accent }]}>
                  #{result.friendTag}
                </Text>
              </View>

              {sending ? (
                <ActivityIndicator size="small" color={C.accent} />
              ) : sent ? (
                <View style={[ss.sentBadge, { backgroundColor: C.success + "18", borderColor: C.success + "44" }]}>
                  <Ionicons name="checkmark" size={s(12)} color={C.success} />
                  <Text style={[ss.sentLabel, { color: C.success }]}>Sent</Text>
                </View>
              ) : (
                <Pressable
                  onPress={handleSendRequest}
                  style={({ pressed }) => [
                    ss.addBtn,
                    { backgroundColor: C.accent + "18", borderColor: C.accent + "44", opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="person-add-outline" size={s(14)} color={C.accent} />
                  <Text style={[ss.addBtnLabel, { color: C.accent }]}>Add</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {!searching && !result && (
          <View style={ss.emptyWrap}>
            <Ionicons name="at-outline" size={s(40)} color={C.muted + "40"} />
            <Text style={[ss.emptyTitle, { color: C.text }]}>Find by tag</Text>
            <Text style={[ss.emptyText, { color: C.muted }]}>
              Enter a 6-character friend tag{"\n"}to find the exact person.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(16),
    paddingVertical: s(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: s(18), fontWeight: "800", flex: 1 },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: s(16),
    marginTop: s(12),
    marginBottom: s(2),
    borderRadius: s(12),
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: s(12),
    paddingVertical: s(10),
  },
  tagHash: {
    fontSize: s(16),
    fontWeight: "900",
    marginRight: s(4),
  },
  tagHint: {
    fontSize: s(12),
    textAlign: "center",
    marginBottom: s(8),
    opacity: 0.7,
  },
  searchInput: {
    flex: 1,
    fontSize: s(16),
    fontWeight: "800",
    letterSpacing: s(2),
    paddingVertical: 0,
  },

  scrollContent: {
    paddingHorizontal: s(16),
    paddingTop: s(10),
    paddingBottom: s(120),
  },

  card: {
    borderRadius: s(14),
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: s(16) },

  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(14),
    paddingVertical: s(13),
    gap: s(12),
  },

  avatar: {
    width: s(40),
    height: s(40),
    borderRadius: s(15),
    borderWidth: s(1.5),
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: s(14), fontWeight: "900" },

  resultName: { fontSize: s(14), fontWeight: "700" },
  resultTag: { fontSize: s(13), fontWeight: "800", marginTop: s(1), letterSpacing: 0.5 },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(4),
    paddingVertical: s(6),
    paddingHorizontal: s(10),
    borderRadius: s(8),
    borderWidth: s(1),
  },
  addBtnLabel: { fontSize: s(12), fontWeight: "800" },

  sentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(4),
    paddingVertical: s(6),
    paddingHorizontal: s(10),
    borderRadius: s(8),
    borderWidth: s(1),
  },
  sentLabel: { fontSize: s(12), fontWeight: "800" },

  emptyWrap: {
    alignItems: "center",
    paddingTop: s(60),
    gap: s(10),
  },
  emptyTitle: { fontSize: s(16), fontWeight: "800" },
  emptyText: {
    fontSize: s(13),
    textAlign: "center",
    maxWidth: s(240),
    lineHeight: s(18),
  },
});
