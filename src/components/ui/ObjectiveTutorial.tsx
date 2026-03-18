/**
 * ObjectiveTutorial
 *
 * A one-time animated tutorial that explains the Objective → Task hierarchy
 * to new users. Shown the first time a user lands on TasksObjectivesScreen.
 *
 * Steps:
 *  1. "Start with an Objective" — what an objective is
 *  2. "Build Tasks beneath it" — what tasks are and why they link up
 *  3. "Track your progress"    — the payoff (progress ring, streaks)
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { s } from "../../ui/ts";
import { useTheme } from "../theme/theme";

const { width: SW } = Dimensions.get("window");

// ─── Step definitions ────────────────────────────────────────────────────────

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  body: string;
  /** The animated "mock UI card" rendered beneath the text */
  visual: "objective" | "task" | "progress" | "training";
};

const STEPS: Step[] = [
  {
    icon: "trophy-outline",
    iconColor: "#FFCC00",
    title: "Start with an Objective",
    body: "An Objective is your big goal — a project, a habit, or anything you want to achieve. Create one first so your work stays focused.",
    visual: "objective",
  },
  {
    icon: "checkmark-circle-outline",
    iconColor: "#34C759",
    title: "Add Tasks beneath it",
    body: "Tasks are the concrete steps that move your Objective forward. Every task belongs to an objective — that's what keeps your effort connected to your goals.",
    visual: "task",
  },
  {
    icon: "trending-up-outline",
    iconColor: "#007AFF",
    title: "Watch your progress grow",
    body: "Flusso automatically tracks how many tasks you complete per objective, so you always know how close you are to achieving it.",
    visual: "progress",
  },
  {
    icon: "barbell-outline",
    iconColor: "#AF52DE",
    title: "Train with a plan",
    body: "Under any Health & Fitness objective you can attach a Training Plan. Choose a cycle split (Push/Pull/Legs…) or a weekly schedule — Flusso generates your workouts as tasks automatically, showing only the next one at a time.",
    visual: "training",
  },
];

// ─── Mock visuals ─────────────────────────────────────────────────────────────

function ObjectiveCard({ colors, radius, pulse }: { colors: any; radius: any; pulse: Animated.Value }) {
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  return (
    <Animated.View style={[styles.mockCard, { backgroundColor: colors.surface, borderRadius: radius.lg, transform: [{ scale }] }]}>
      <View style={[styles.mockColorDot, { backgroundColor: "#007AFF" }]} />
      <View style={styles.mockCardBody}>
        <View style={[styles.mockLine, { width: "60%", backgroundColor: colors.text, opacity: 0.8 }]} />
        <View style={[styles.mockLine, { width: "40%", backgroundColor: colors.muted, opacity: 0.5, marginTop: s(6) }]} />
      </View>
      <View style={[styles.mockBadge, { backgroundColor: "#007AFF22" }]}>
        <Text style={[styles.mockBadgeText, { color: "#007AFF" }]}>Objective</Text>
      </View>
    </Animated.View>
  );
}

function TaskCard({ colors, radius, pulse }: { colors: any; radius: any; pulse: Animated.Value }) {
  const translateY = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  return (
    <View>
      {/* Parent objective ghost */}
      <View style={[styles.mockCard, styles.mockCardBehind, { backgroundColor: colors.surface, borderRadius: radius.lg, opacity: 0.45 }]}>
        <View style={[styles.mockColorDot, { backgroundColor: "#007AFF" }]} />
        <View style={styles.mockCardBody}>
          <View style={[styles.mockLine, { width: "55%", backgroundColor: colors.text, opacity: 0.6 }]} />
        </View>
      </View>
      {/* Task card rising up */}
      <Animated.View style={[styles.mockCard, { backgroundColor: colors.surface, borderRadius: radius.lg, marginTop: s(8), transform: [{ translateY }] }]}>
        <Ionicons name="checkmark-circle-outline" size={s(20)} color="#34C759" style={{ marginRight: s(10) }} />
        <View style={styles.mockCardBody}>
          <View style={[styles.mockLine, { width: "50%", backgroundColor: colors.text, opacity: 0.8 }]} />
          <View style={[styles.mockLine, { width: "30%", backgroundColor: "#007AFF", opacity: 0.6, marginTop: s(5) }]} />
        </View>
        <View style={[styles.mockBadge, { backgroundColor: "#34C75922" }]}>
          <Text style={[styles.mockBadgeText, { color: "#34C759" }]}>Task</Text>
        </View>
      </Animated.View>
    </View>
  );
}

function ProgressCard({ colors, radius, pulse }: { colors: any; radius: any; pulse: Animated.Value }) {
  const width = pulse.interpolate({ inputRange: [0, 1], outputRange: ["35%", "65%"] });
  return (
    <View style={[styles.mockCard, { backgroundColor: colors.surface, borderRadius: radius.lg, flexDirection: "column", alignItems: "flex-start" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: s(12) }}>
        <View style={[styles.mockColorDot, { backgroundColor: "#007AFF" }]} />
        <View style={[styles.mockLine, { width: s(100), backgroundColor: colors.text, opacity: 0.8 }]} />
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.progressFill, { width, backgroundColor: "#007AFF" }]} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: s(8) }}>
        <Text style={[styles.mockSmallText, { color: colors.muted }]}>4 / 6 tasks done</Text>
        <Text style={[styles.mockSmallText, { color: "#007AFF", fontWeight: "700" }]}>67 %</Text>
      </View>
    </View>
  );
}

function TrainingCard({ colors, radius, pulse }: { colors: any; radius: any; pulse: Animated.Value }) {
  const translateY = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const DAYS = ["Push", "Pull", "Legs", "Rest"];
  const COLORS = ["#AF52DE", "#007AFF", "#34C759", colors.border];
  return (
    <View style={[styles.mockCard, { backgroundColor: colors.surface, borderRadius: radius.lg, flexDirection: "column", alignItems: "flex-start", gap: s(8) }]}>
      {/* Plan header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(8), width: "100%" }}>
        <Ionicons name="barbell-outline" size={s(16)} color="#AF52DE" />
        <View style={[styles.mockLine, { flex: 1, backgroundColor: colors.text, opacity: 0.8 }]} />
        <View style={{ paddingHorizontal: s(8), paddingVertical: s(2), borderRadius: s(999), backgroundColor: "#AF52DE22" }}>
          <Text style={{ color: "#AF52DE", fontSize: s(10), fontWeight: "800" }}>Cycle</Text>
        </View>
      </View>
      {/* Cycle day chips */}
      <View style={{ flexDirection: "row", gap: s(6), flexWrap: "wrap" }}>
        {DAYS.map((label, i) => (
          <View key={label} style={{ paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: s(999), backgroundColor: COLORS[i] + "22", borderWidth: s(1), borderColor: COLORS[i] + "55" }}>
            <Text style={{ color: COLORS[i], fontSize: s(11), fontWeight: "800" }}>{label}</Text>
          </View>
        ))}
      </View>
      {/* Next workout task */}
      <Animated.View style={{ flexDirection: "row", alignItems: "center", gap: s(8), width: "100%", transform: [{ translateY }] }}>
        <Ionicons name="checkmark-circle-outline" size={s(18)} color="#AF52DE" />
        <View style={[styles.mockLine, { flex: 1, backgroundColor: colors.text, opacity: 0.7 }]} />
        <View style={{ paddingHorizontal: s(6), paddingVertical: s(2), borderRadius: s(999), backgroundColor: "#AF52DE15" }}>
          <Text style={{ color: "#AF52DE", fontSize: s(10), fontWeight: "700" }}>Next</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onDone: () => void;
};

export function ObjectiveTutorial({ visible, onDone }: Props) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Fade + slide in when step changes
  useEffect(() => {
    if (!visible) return;

    fadeAnim.setValue(0);
    slideAnim.setValue(24);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }, [step, visible]);

  // Gentle pulse loop for the visual
  useEffect(() => {
    if (!visible) return;
    pulseAnim.setValue(0);
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1100, useNativeDriver: false }),
      ])
    );
    pulseLoop.current.start();
    return () => pulseLoop.current?.stop();
  }, [step, visible]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onDone();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    onDone();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={undefined}>
        <View style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            paddingBottom: insets.bottom + s(16),
          }
        ]}>
          {/* Step dots */}
          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === step ? colors.accent : colors.border,
                    width: i === step ? s(20) : s(7),
                  },
                ]}
              />
            ))}
          </View>

          {/* Animated content */}
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: current.iconColor + "22" }]}>
              <Ionicons name={current.icon} size={s(32)} color={current.iconColor} />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>{current.title}</Text>

            {/* Body */}
            <Text style={[styles.body, { color: colors.muted }]}>{current.body}</Text>

            {/* Visual mock */}
            <View style={styles.visualContainer}>
              {current.visual === "objective" && <ObjectiveCard colors={colors} radius={radius} pulse={pulseAnim} />}
              {current.visual === "task"      && <TaskCard      colors={colors} radius={radius} pulse={pulseAnim} />}
              {current.visual === "progress"  && <ProgressCard  colors={colors} radius={radius} pulse={pulseAnim} />}
              {current.visual === "training"  && <TrainingCard  colors={colors} radius={radius} pulse={pulseAnim} />}
            </View>
          </Animated.View>

          {/* Actions */}
          <View style={styles.actions}>
            {!isLast ? (
              <Pressable onPress={handleSkip} style={styles.skipBtn} hitSlop={8}>
                <Text style={[styles.skipText, { color: colors.muted }]}>Skip</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable
              onPress={handleNext}
              style={[styles.nextBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.nextText}>{isLast ? "Got it!" : "Next"}</Text>
              {!isLast && <Ionicons name="arrow-forward" size={s(16)} color="#fff" style={{ marginLeft: s(6) }} />}
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    marginHorizontal: s(12),
    marginBottom: s(12),
    padding: s(22),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
    marginBottom: s(20),
    alignSelf: "center",
  },
  dot: {
    height: s(7),
    borderRadius: s(99),
  },
  iconCircle: {
    width: s(60),
    height: s(60),
    borderRadius: s(30),
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: s(14),
  },
  title: {
    fontSize: s(22),
    fontWeight: "700",
    textAlign: "center",
    marginBottom: s(10),
  },
  body: {
    fontSize: s(15),
    lineHeight: s(22),
    textAlign: "center",
    marginBottom: s(20),
  },
  visualContainer: {
    marginBottom: s(24),
  },

  // Mock card
  mockCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: s(14),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  mockCardBehind: {
    marginBottom: -s(4),
  },
  mockColorDot: {
    width: s(10),
    height: s(10),
    borderRadius: s(5),
    marginRight: s(10),
  },
  mockCardBody: {
    flex: 1,
  },
  mockLine: {
    height: s(10),
    borderRadius: s(5),
  },
  mockBadge: {
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: s(99),
    marginLeft: s(8),
  },
  mockBadgeText: {
    fontSize: s(11),
    fontWeight: "600",
  },
  mockSmallText: {
    fontSize: s(12),
  },

  // Progress bar mock
  progressTrack: {
    height: s(8),
    borderRadius: s(99),
    width: "100%",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: s(99),
  },

  // Actions
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skipBtn: {
    paddingVertical: s(12),
    paddingHorizontal: s(4),
  },
  skipText: {
    fontSize: s(15),
    fontWeight: "500",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: s(12),
    paddingHorizontal: s(20),
    borderRadius: s(14),
  },
  nextText: {
    color: "#fff",
    fontSize: s(16),
    fontWeight: "700",
  },
});
