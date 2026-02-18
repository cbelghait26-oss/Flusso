import React, { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { s } from "react-native-size-matters";

export function SideDrawer(props: {
  theme: any;
  visible: boolean;
  width: number;
  insets: { top: number; bottom: number; left: number; right: number };

  showEvents: boolean;
  setShowEvents: (v: boolean) => void;
  showTasks: boolean;
  setShowTasks: (v: boolean) => void;
  showBirthdays: boolean;
  setShowBirthdays: (v: boolean) => void;
  showHolidays: boolean;
  setShowHolidays: (v: boolean) => void;

  onClose: () => void;
  onLinkGoogle: () => void;
}) {
  const { theme, visible, width, insets, showEvents, setShowEvents, showTasks, setShowTasks, showBirthdays, setShowBirthdays, showHolidays, setShowHolidays, onClose, onLinkGoogle } = props;

  const x = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(x, { toValue: visible ? 0 : width, duration: 180, useNativeDriver: true }).start();
  }, [visible, width, x]);

  if (!visible) return null;

  return (
    <>
      <Pressable
        style={{ position: "absolute", left: s(0), right: s(0), top: s(0), bottom: s(0), backgroundColor: "rgba(0,0,0,0.35)", zIndex: 50 }}
        onPress={onClose}
      />
      <Animated.View
        style={{
          position: "absolute",
          top: s(0),
          right: s(0),
          bottom: s(0),
          width: s(310),
          backgroundColor: theme.colors.card,
          borderLeftWidth: s(1),
          borderLeftColor: theme.colors.border,
          paddingHorizontal: s(14),
          paddingTop: s(10) + insets.top * 0.15,
          zIndex: 60,
          transform: [{ translateX: x }],
        }}
      >
        <SafeAreaView style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ color: theme.colors.text, fontWeight: "700", fontSize: s(25) }}>Calendar</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} style={{ width: s(34), height: s(34), borderRadius: s(12), alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={s(18)} color={theme.colors.muted} />
          </Pressable>
        </SafeAreaView>

        <Text style={{ marginTop: s(16), color: theme.colors.muted, fontWeight: "900", fontSize: s(12) }}>FILTERS</Text>

        <Toggle theme={theme} label="Events" value={showEvents} onToggle={() => setShowEvents(!showEvents)} />
        <Toggle theme={theme} label="Tasks" value={showTasks} onToggle={() => setShowTasks(!showTasks)} />
        <Toggle theme={theme} label="Birthdays" value={showBirthdays} onToggle={() => setShowBirthdays(!showBirthdays)} />
        <Toggle theme={theme} label="Holidays" value={showHolidays} onToggle={() => setShowHolidays(!showHolidays)} />

        <Text style={{ marginTop: s(18), color: theme.colors.muted, fontWeight: "900", fontSize: s(12) }}>GOOGLE CALENDAR</Text>

        <Pressable
          onPress={onLinkGoogle}
          style={{
            marginTop: s(10),
            borderRadius: s(16),
            borderWidth: s(1),
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card2,
            padding: s(12),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}>
            <View style={{ width: s(34), height: s(34), borderRadius: s(12), alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card, borderWidth: s(1), borderColor: theme.colors.border }}>
              <Ionicons name="logo-google" size={s(16)} color={theme.colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(13) }}>Link Google Calendar</Text>
              <Text style={{ color: theme.colors.muted, fontWeight: "800", fontSize: s(12), marginTop: s(2) }} numberOfLines={2}>
                Sync events into Flusso’s agenda.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={s(16)} color={theme.colors.muted} />
          </View>
        </Pressable>
      </Animated.View>
    </>
  );
}

function Toggle({ theme, label, value, onToggle }: { theme: any; label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        marginTop: s(10),
        flexDirection: "row",
        alignItems: "center",
        gap: s(10),
        paddingVertical: s(10),
        paddingHorizontal: s(10),
        borderRadius: s(14),
        backgroundColor: theme.colors.card2,
        borderWidth: s(1),
        borderColor: theme.colors.border,
      }}
    >
      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(13), flex: 1 }}>{label}</Text>
      <View style={{ width: s(44), height: s(26), borderRadius: s(999), backgroundColor: value ? theme.colors.accent : theme.colors.border, padding: s(3), alignItems: value ? "flex-end" : "flex-start", justifyContent: "center" }}>
        <View style={{ width: s(20), height: s(20), borderRadius: s(999), backgroundColor: "#fff" }} />
      </View>
    </Pressable>
  );
}
