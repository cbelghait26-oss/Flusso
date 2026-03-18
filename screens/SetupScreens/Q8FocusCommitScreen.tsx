import React, { useState, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { s } from "../../src/ui/ts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../src/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDeviceClass, CONTENT_MAX_WIDTH } from "../../src/ui/responsive";

type Props = NativeStackScreenProps<RootStackParamList, "Q8FocusCommitScreen">;

type Minutes = 15 | 30 | 60 | 90 | 120;

const OPTIONS: { minutes: Minutes; label: string }[] = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "60 minutes" },
  { minutes: 90, label: "90 minutes" },
  { minutes: 120, label: "120+ minutes" },
];

const Q8FocusCommitScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { isTablet } = useDeviceClass();

  const [selected, setSelected] = useState<Minutes | null>(null);

  const onContinue = () => {
    if (!selected) return;
    navigation.navigate("Q9ClosingScreen", {
      setup: { ...(route.params?.setup ?? {}), focusMinutes: selected },
    });
  };

  return (
    <View style={styles.outerBg}>
      <LinearGradient colors={["#14003E", "#22006A", "#300898"]} start={{ x: 0, y: 0.88 }} end={{ x: 1, y: 0.12 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["transparent", "rgba(160,20,240,0.24)", "rgba(200,60,255,0.14)", "transparent"]} start={{ x: 1, y: 0.1 }} end={{ x: 0, y: 0.9 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(200,80,255,0.09)", "transparent", "rgba(130,10,220,0.13)"]} start={{ x: 0.65, y: 0 }} end={{ x: 0.08, y: 1 }} style={StyleSheet.absoluteFill} />

      <View style={StyleSheet.absoluteFill}>
      <View style={[
        styles.container,
        isTablet && { maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" as const, width: "100%" },
      ]}>
        {/* Content */}
        <View style={[styles.content, { paddingTop: insets.top + s(32) }]}>
          <Text style={styles.question}>
            How many minutes of intentional focus can you protect each day?
          </Text>
          <Text style={styles.sub}>Consistency matters more than intensity.</Text>

          <View style={styles.list}>
            {OPTIONS.map((opt, idx) => {
              const isSelected = selected === opt.minutes;
              return (
                <TouchableOpacity
                  key={opt.minutes}
                  style={[
                    styles.row,
                    idx === 0 && styles.rowFirst,
                    isSelected && styles.rowSelected,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => setSelected(opt.minutes)}
                >
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.rowLabel}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[
            styles.ctaFixed,
            { bottom: insets.bottom + s(16) },
            !selected && styles.ctaDisabled,
          ]}
          disabled={!selected}
          activeOpacity={0.9}
          onPress={onContinue}
        >
          <Text style={styles.ctaText}>Continue</Text>
        </TouchableOpacity>
      </View>
      </View>
    </View>
  );
};

export default Q8FocusCommitScreen;

const styles = StyleSheet.create({
  outerBg: { flex: 1, backgroundColor: "#000612" },
  container: {
    flex: 1,
    position: "relative",
    paddingHorizontal: s(20),
    paddingBottom: s(90),
  },

  progressFixed: {
    position: "absolute",
    left: s(20),
    right: s(20),
  },
  progressTrack: {
    height: s(6),
    borderRadius: s(999),
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#F4F6F2",
    borderRadius: s(999),
  },
  progressText: {
    marginTop: s(8),
    textAlign: "right",
    color: "rgba(244,246,242,0.8)",
    fontSize: s(12),
  },

  content: { flex: 1 },

  question: {
    color: "#F4F6F2",
    fontSize: s(24),
    fontWeight: "800",
    lineHeight: s(32),
    marginBottom: s(8),
  },
  sub: {
    color: "rgba(244,246,242,0.6)",
    fontSize: s(13),
    marginBottom: s(20),
  },

  list: {
    borderRadius: s(14),
    backgroundColor: "#0f3f87",
    overflow: "hidden",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.10)",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(16),
    paddingVertical: s(16),
    borderTopWidth: s(1),
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  rowFirst: { borderTopWidth: 0 },
  rowSelected: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  radioOuter: {
    height: s(20),
    width: s(20),
    borderRadius: s(10),
    borderWidth: s(2),
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: s(14),
  },
  radioOuterSelected: { borderColor: "#F4F6F2" },
  radioInner: {
    height: s(10),
    width: s(10),
    borderRadius: s(5),
    backgroundColor: "#F4F6F2",
  },

  rowLabel: {
    color: "#F4F6F2",
    fontSize: s(15),
    fontWeight: "700",
  },

  ctaFixed: {
    position: "absolute",
    left: s(20),
    right: s(20),
    height: s(48),
    borderRadius: s(14),
    backgroundColor: "#F4F6F2",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: {
    color: "#002640",
    fontSize: s(18),
    fontWeight: "700",
  },
});
