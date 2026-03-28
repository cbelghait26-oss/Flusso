// src/components/ui/TrainingRoomTutorial.tsx
//
// One-time animated tutorial for the Training Room screen.
//
// Steps:
//  1. "Pick your session"     — select from active training plan tasks
//  2. "Log every set"         — track reps, weight, and notes
//  3. "Rest between sets"     — auto-countdown rest timer
//  4. "Finish & save"         — complete the workout and earn focus time

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { s } from "../../ui/ts";

const BLUE   = "#4A9DFF";
const PURPLE = "#AF52DE";
const GREEN  = "#34D399";
const AMBER  = "#FBBF24";

// ─── Step config ──────────────────────────────────────────────────────────────

type StepVisual = "select" | "log" | "rest" | "finish";

type Step = {
  title: string;
  body: string;
  visual: StepVisual;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
};

const STEPS: Step[] = [
  {
    title: "Pick your session",
    body: "The Training Room shows one card per active training plan — the next scheduled workout. Tap Start to begin your session.",
    visual: "select",
    icon: "barbell-outline",
    iconColor: BLUE,
    iconBg: "rgba(74,157,255,0.15)",
  },
  {
    title: "Log every set",
    body: "For each set enter your reps, weight, and optional notes. Hit Log Set to save it — your full workout is recorded automatically.",
    visual: "log",
    icon: "create-outline",
    iconColor: PURPLE,
    iconBg: "rgba(175,82,222,0.15)",
  },
  {
    title: "Rest between sets",
    body: "After logging a set the rest timer starts automatically. You can skip or change the rest duration anytime in Settings.",
    visual: "rest",
    icon: "timer-outline",
    iconColor: GREEN,
    iconBg: "rgba(52,211,153,0.15)",
  },
  {
    title: "Finish & save",
    body: "When all sets are done, complete the workout. Flusso marks the task done and logs your session time toward your daily focus goal.",
    visual: "finish",
    icon: "trophy-outline",
    iconColor: AMBER,
    iconBg: "rgba(251,191,36,0.15)",
  },
];

// ─── Visual mocks ─────────────────────────────────────────────────────────────

function SelectMock({ pulse }: { pulse: Animated.Value }) {
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  return (
    <Animated.View style={[vm.card, { transform: [{ scale }], gap: s(10) }]}>
      {[
        { plan: "PPL Cycle", workout: "Push Day A", color: PURPLE },
        { plan: "5-Day Split", workout: "Back & Biceps", color: BLUE },
      ].map(({ plan, workout, color }) => (
        <View key={plan} style={vm.taskCard}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: s(5), marginBottom: s(3) }}>
              <Ionicons name="fitness-outline" size={s(11)} color="rgba(74,157,255,0.7)" />
              <Text style={vm.planLabel}>{plan}</Text>
            </View>
            <Text style={vm.taskTitle}>{workout}</Text>
          </View>
          <View style={[vm.startBadge, { borderColor: color + "55" }]}>
            <Text style={[vm.startText, { color }]}>Start</Text>
            <Ionicons name="arrow-forward" size={s(11)} color={color} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

function LogMock({ pulse }: { pulse: Animated.Value }) {
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  return (
    <Animated.View style={[vm.card, { transform: [{ scale }], gap: s(8) }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(8), marginBottom: s(2) }}>
        <View style={[vm.setChip, { backgroundColor: PURPLE + "22", borderColor: PURPLE + "44" }]}>
          <Text style={[vm.setChipText, { color: PURPLE }]}>Set 2</Text>
        </View>
        <Text style={vm.exerciseName}>Bench Press</Text>
      </View>
      {[
        { label: "Reps", value: "8" },
        { label: "Weight", value: "135 lbs" },
      ].map(({ label, value }) => (
        <View key={label} style={vm.inputRow}>
          <Text style={vm.inputLabel}>{label}</Text>
          <View style={vm.inputBox}><Text style={vm.inputValue}>{value}</Text></View>
        </View>
      ))}
      <View style={[vm.logBtn, { backgroundColor: PURPLE + "22", borderColor: PURPLE + "44" }]}>
        <Ionicons name="checkmark-circle" size={s(14)} color={PURPLE} />
        <Text style={[vm.logBtnText, { color: PURPLE }]}>Log Set</Text>
      </View>
    </Animated.View>
  );
}

function RestMock({ pulse }: { pulse: Animated.Value }) {
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const width = pulse.interpolate({ inputRange: [0, 1], outputRange: ["70%", "40%"] });
  return (
    <Animated.View style={[vm.card, { transform: [{ scale }], alignItems: "center", gap: s(10) }]}>
      <Text style={vm.restLabel}>REST</Text>
      <Text style={vm.restTime}>01:12</Text>
      <View style={vm.restTrack}>
        <Animated.View style={[vm.restFill, { width }]} />
      </View>
      <View style={vm.restRow}>
        <View style={vm.restPill}>
          <Ionicons name="play-skip-forward-outline" size={s(13)} color="rgba(255,255,255,0.7)" />
          <Text style={vm.restPillText}>Skip</Text>
        </View>
        <View style={[vm.restPill, { backgroundColor: GREEN + "18", borderColor: GREEN + "44" }]}>
          <Ionicons name="add" size={s(13)} color={GREEN} />
          <Text style={[vm.restPillText, { color: GREEN }]}>+30s</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function FinishMock({ pulse }: { pulse: Animated.Value }) {
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  return (
    <Animated.View style={[vm.card, { transform: [{ scale }], alignItems: "center", gap: s(10) }]}>
      <View style={[vm.trophyBadge]}>
        <Ionicons name="trophy" size={s(32)} color={AMBER} />
      </View>
      <Text style={vm.finishTitle}>Workout Complete!</Text>
      <View style={{ flexDirection: "row", gap: s(12) }}>
        {[
          { icon: "time-outline" as const, value: "42 min" },
          { icon: "barbell-outline" as const, value: "4 sets" },
        ].map(({ icon, value }) => (
          <View key={value} style={vm.statChip}>
            <Ionicons name={icon} size={s(12)} color="rgba(255,255,255,0.6)" />
            <Text style={vm.statText}>{value}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onDone: () => void;
};

export function TrainingRoomTutorial({ visible, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  // Pulse loop
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulseAnim]);

  // Reset on open
  useEffect(() => {
    if (visible) { setStep(0); fadeAnim.setValue(1); slideAnim.setValue(0); }
  }, [visible]);

  const animateToStep = (next: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -s(20), duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideAnim.setValue(s(20));
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (isLast) { onDone(); return; }
    animateToStep(step + 1);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <Pressable style={styles.backdrop} onPress={onDone}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, s(20)) }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Step dots */}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>

          <Animated.View style={[styles.body, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
            {/* Icon badge */}
            <View style={[styles.iconBadge, { backgroundColor: current.iconBg }]}>
              <Ionicons name={current.icon} size={s(26)} color={current.iconColor} />
            </View>

            {/* Title */}
            <Text style={styles.title}>{current.title}</Text>

            {/* Body */}
            <Text style={styles.bodyText}>{current.body}</Text>

            {/* Visual mock */}
            <View style={styles.visualArea}>
              {current.visual === "select" && <SelectMock pulse={pulseAnim} />}
              {current.visual === "log"    && <LogMock    pulse={pulseAnim} />}
              {current.visual === "rest"   && <RestMock   pulse={pulseAnim} />}
              {current.visual === "finish" && <FinishMock pulse={pulseAnim} />}
            </View>
          </Animated.View>

          {/* Actions */}
          <View style={styles.actions}>
            {!isLast ? (
              <Pressable onPress={onDone} style={styles.skipBtn} hitSlop={8}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable onPress={handleNext} style={styles.nextBtn}>
              <Text style={styles.nextText}>{isLast ? "Let's train!" : "Next"}</Text>
              {!isLast && <Ionicons name="arrow-forward" size={s(15)} color="#fff" style={{ marginLeft: s(6) }} />}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Visual mock styles ───────────────────────────────────────────────────────
const vm = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.11)",
    borderRadius: s(16),
    padding: s(14),
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: s(12),
    paddingHorizontal: s(12),
    paddingVertical: s(10),
  },
  planLabel: { color: "rgba(74,157,255,0.8)", fontSize: s(10), fontWeight: "700" },
  taskTitle: { color: "#fff", fontSize: s(13), fontWeight: "800" },
  startBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(4),
    paddingHorizontal: s(8),
    paddingVertical: s(5),
    borderRadius: s(999),
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: s(1),
  },
  startText: { fontSize: s(11), fontWeight: "800" },
  // Log mock
  setChip: {
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: s(999),
    borderWidth: s(1),
  },
  setChipText: { fontSize: s(11), fontWeight: "800" },
  exerciseName: { color: "#fff", fontSize: s(13), fontWeight: "700", flex: 1 },
  inputRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  inputLabel: { color: "rgba(255,255,255,0.5)", fontSize: s(12), fontWeight: "600" },
  inputBox: {
    paddingHorizontal: s(10),
    paddingVertical: s(5),
    borderRadius: s(8),
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.12)",
  },
  inputValue: { color: "#fff", fontSize: s(12), fontWeight: "700" },
  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(6),
    paddingVertical: s(8),
    borderRadius: s(10),
    borderWidth: s(1),
    marginTop: s(2),
  },
  logBtnText: { fontSize: s(12), fontWeight: "800" },
  // Rest mock
  restLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: s(10),
    fontWeight: "900",
    letterSpacing: s(2),
    textTransform: "uppercase",
  },
  restTime: { color: "#fff", fontSize: s(38), fontWeight: "300", letterSpacing: -1 },
  restTrack: {
    width: "100%",
    height: s(4),
    borderRadius: s(999),
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  restFill: {
    height: "100%",
    borderRadius: s(999),
    backgroundColor: GREEN,
  },
  restRow: { flexDirection: "row", gap: s(10) },
  restPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(5),
    paddingHorizontal: s(12),
    paddingVertical: s(6),
    borderRadius: s(999),
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.12)",
  },
  restPillText: { color: "rgba(255,255,255,0.7)", fontSize: s(12), fontWeight: "700" },
  // Finish mock
  trophyBadge: {
    width: s(64),
    height: s(64),
    borderRadius: s(32),
    backgroundColor: "rgba(251,191,36,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: s(1),
    borderColor: "rgba(251,191,36,0.3)",
  },
  finishTitle: { color: "#fff", fontSize: s(16), fontWeight: "900" },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(5),
    paddingHorizontal: s(10),
    paddingVertical: s(5),
    borderRadius: s(999),
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.12)",
  },
  statText: { color: "rgba(255,255,255,0.7)", fontSize: s(11), fontWeight: "700" },
});

// ─── Sheet styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "rgba(8,12,22,0.98)",
    borderTopLeftRadius: s(24),
    borderTopRightRadius: s(24),
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: s(20),
    paddingTop: s(14),
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: s(6),
    marginBottom: s(16),
  },
  dot: { width: s(7), height: s(7), borderRadius: s(4) },
  dotActive:   { backgroundColor: BLUE },
  dotInactive: { backgroundColor: "rgba(255,255,255,0.2)" },
  body: { alignItems: "center", gap: s(10) },
  iconBadge: {
    width: s(56),
    height: s(56),
    borderRadius: s(28),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: s(4),
  },
  title: {
    color: "#fff",
    fontSize: s(20),
    fontWeight: "900",
    textAlign: "center",
  },
  bodyText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: s(14),
    fontWeight: "500",
    lineHeight: s(20),
    textAlign: "center",
  },
  visualArea: { width: "100%", marginTop: s(8) },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: s(20),
  },
  skipBtn: { paddingVertical: s(10), paddingHorizontal: s(4) },
  skipText: { color: "rgba(255,255,255,0.45)", fontSize: s(14), fontWeight: "600" },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BLUE,
    paddingVertical: s(12),
    paddingHorizontal: s(22),
    borderRadius: s(999),
  },
  nextText: { color: "#fff", fontSize: s(15), fontWeight: "800" },
});
