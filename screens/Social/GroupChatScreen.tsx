// screens/Social/GroupChatScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "../../src/components/theme/theme";
import { s } from "../../src/ui/ts";
import { auth } from "../../src/services/firebase";
import {
  subscribeGroupMessages,
  sendGroupMessage,
  markGroupRead,
  isGroupMuted,
  toggleGroupMute,
  type GroupMessage,
} from "../../src/services/SocialService";
import { refreshGroupBadge } from "../../src/navigation/AppTabs";
import type { RootStackParamList } from "../../src/navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  groupId: string;
  groupName: string;
  memberUids: string[];
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function GroupChatScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { groupId, groupName, memberUids } = route.params as RouteParams;

  const { colors, isDark } = useTheme();
  const myUid = auth.currentUser?.uid ?? "";

  const C = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      card2: (colors as any).card2 ?? (isDark ? "#1a1a2e" : "#f5f5f7"),
      text: colors.text,
      muted: colors.muted,
      line: colors.border,
      accent: colors.accent,
    }),
    [colors, isDark]
  );

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [muted, setMuted] = useState(false);

  // Load mute state
  useEffect(() => {
    isGroupMuted(groupId).then(setMuted).catch(() => {});
  }, [groupId]);

  // Mark as read and update badge when screen opens
  useEffect(() => {
    markGroupRead(groupId)
      .then(() => refreshGroupBadge())
      .catch(() => {});
  }, [groupId]);

  // Real-time message subscription
  useEffect(() => {
    const unsub = subscribeGroupMessages(groupId, (msgs) => {
      setMessages(msgs);
    });
    return unsub;
  }, [groupId]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    setInputText("");
    try {
      await sendGroupMessage(groupId, text, memberUids);
      await markGroupRead(groupId);
    } catch {
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, groupId, memberUids]);

  const handleToggleMute = useCallback(async () => {
    try {
      const newMuted = await toggleGroupMute(groupId);
      setMuted(newMuted);
    } catch {}
  }, [groupId]);

  const renderMessage = useCallback(
    ({ item, index }: { item: GroupMessage; index: number }) => {
      const isMe = item.senderUid === myUid;
      const prevMsg = messages[index + 1]; // list is reversed
      const showDate =
        !prevMsg ||
        formatDate(item.createdAt) !== formatDate(prevMsg.createdAt);
      const showSender =
        !isMe && (!prevMsg || prevMsg.senderUid !== item.senderUid || showDate);

      return (
        <View>
          {showDate && (
            <View style={styles.dateSeparator}>
              <Text style={[styles.dateLabel, { color: C.muted }]}>
                {formatDate(item.createdAt)}
              </Text>
            </View>
          )}
          <View
            style={[
              styles.msgRow,
              isMe ? styles.msgRowMe : styles.msgRowOther,
            ]}
          >
            {!isMe && (
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: C.accent + "22", borderColor: C.accent + "44" },
                ]}
              >
                <Text style={[styles.avatarText, { color: C.accent }]}>
                  {item.senderName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ maxWidth: "72%", gap: s(2) }}>
              {showSender && (
                <Text style={[styles.senderName, { color: C.muted }]}>
                  {item.senderName}
                </Text>
              )}
              <View
                style={[
                  styles.bubble,
                  isMe
                    ? { backgroundColor: C.accent, borderBottomRightRadius: s(4) }
                    : { backgroundColor: C.card2, borderColor: C.line, borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: s(4) },
                ]}
              >
                <Text style={[styles.bubbleText, { color: isMe ? "#fff" : C.text }]}>
                  {item.text}
                </Text>
              </View>
              <Text
                style={[
                  styles.timeLabel,
                  { color: C.muted, textAlign: isMe ? "right" : "left" },
                ]}
              >
                {formatTime(item.createdAt)}
              </Text>
            </View>
          </View>
        </View>
      );
    },
    [messages, myUid, C]
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: C.bg }]}
      edges={["top", "left", "right"]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: C.line }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={s(22)} color={C.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: C.text }]} numberOfLines={1}>
            {groupName}
          </Text>
          <Text style={[styles.headerSub, { color: C.muted }]}>
            {memberUids.length} member{memberUids.length !== 1 ? "s" : ""}
          </Text>
        </View>

        <Pressable
          onPress={handleToggleMute}
          style={({ pressed }) => [
            styles.muteBtn,
            { backgroundColor: C.card2, borderColor: C.line, opacity: pressed ? 0.7 : 1 },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={muted ? "notifications-off-outline" : "notifications-outline"}
            size={s(18)}
            color={muted ? C.muted : C.accent}
          />
        </Pressable>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={s(36)} color={C.muted + "60"} />
              <Text style={[styles.emptyText, { color: C.muted }]}>
                No messages yet.{"\n"}Say hello!
              </Text>
            </View>
          }
        />

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            { backgroundColor: C.card, borderTopColor: C.line },
          ]}
        >
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message…"
            placeholderTextColor={C.muted}
            style={[
              styles.input,
              { color: C.text, backgroundColor: C.card2, borderColor: C.line },
            ]}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor:
                  !inputText.trim() || sending ? C.accent + "40" : C.accent,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={s(18)} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(16),
    paddingVertical: s(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: s(10),
  },
  backBtn: { padding: s(4) },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: s(16), fontWeight: "900" },
  headerSub: { fontSize: s(11), fontWeight: "600", marginTop: s(1) },
  muteBtn: {
    width: s(36),
    height: s(36),
    borderRadius: s(18),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  messageList: {
    padding: s(16),
    gap: s(4),
    flexGrow: 1,
    justifyContent: "flex-end",
  },

  dateSeparator: {
    alignItems: "center",
    marginVertical: s(10),
  },
  dateLabel: {
    fontSize: s(11),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  msgRow: {
    flexDirection: "row",
    marginVertical: s(2),
    gap: s(8),
    alignItems: "flex-end",
  },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowOther: { justifyContent: "flex-start" },

  avatar: {
    width: s(28),
    height: s(28),
    borderRadius: s(14),
    borderWidth: s(1),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: s(16),
  },
  avatarText: { fontSize: s(12), fontWeight: "900" },

  senderName: {
    fontSize: s(11),
    fontWeight: "700",
    marginLeft: s(2),
  },

  bubble: {
    borderRadius: s(16),
    paddingHorizontal: s(12),
    paddingVertical: s(8),
  },
  bubbleText: {
    fontSize: s(14),
    fontWeight: "500",
    lineHeight: s(20),
  },

  timeLabel: {
    fontSize: s(10),
    fontWeight: "600",
    marginHorizontal: s(4),
  },

  emptyWrap: {
    alignItems: "center",
    paddingVertical: s(60),
    gap: s(12),
  },
  emptyText: {
    fontSize: s(14),
    textAlign: "center",
    fontWeight: "600",
    lineHeight: s(22),
  },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: s(12),
    paddingTop: s(10),
    paddingBottom: s(16),
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: s(8),
  },
  input: {
    flex: 1,
    borderRadius: s(20),
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: s(14),
    paddingVertical: s(10),
    fontSize: s(14),
    maxHeight: s(120),
    fontWeight: "500",
  },
  sendBtn: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    alignItems: "center",
    justifyContent: "center",
  },
});
