// src/components/ui/FocusRoomTutorial.tsx
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

// ─── Step config ─────────────────────────────────────────────────────────────

type StepVisual = "timer" | "task" | "modes" | "controls";

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
    title: "Tap the timer to focus",
    body: "Tap anywhere on the big timer to start or pause your session. Every minute you focus is automatically saved toward your daily goal.",
    visual: "timer",
    icon: "timer-outline",
    iconColor: "#6EC6FF",
    iconBg: "rgba(110,198,255,0.15)",
  },
  {
    title: "Link it to your goal",
    body: "Open Settings → Tasks to attach a task to this session. Flusso shows which objective you're working on so every minute feels purposeful.",
    visual: "task",
    icon: "bookmark-outline",
    iconColor: "#A78BFA",
    iconBg: "rgba(167,139,250,0.15)",
  },
  {
    title: "Choose your session style",
    body: "Pomodoro counts down in focused work intervals followed by breaks. Stopwatch counts up freely — useful when you just want to track raw time.",
    visual: "modes",
    icon: "stopwatch-outline",
    iconColor: "#34D399",
    iconBg: "rgba(52,211,153,0.15)",
  },
  {
    title: "Bottom bar controls",
    body: "Toggle ambient music on or off. Cycle the timer display between the countdown / clock / hidden views to keep you in the zone.",
    visual: "controls",
    icon: "musical-notes",
    iconColor: "#FBBF24",
    iconBg: "rgba(251,191,36,0.15)",
  },
];

// ─── Visual mocks ─────────────────────────────────────────────────────────────

function TimerMock({ pulse }: { pulse: Animated.Value }) {
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  return (
    <Animated.View style={[vm.card, { transform: [{ scale }] }]}>
      <Text style={vm.timerNum}>24:59</Text>
      <View style={vm.subRow}>
        <View style={[vm.dot, { backgroundColor: "#34D399" }]} />
        <Text style={vm.subText}>Focusing…</Text>
      </View>
      <Text style={vm.hint}>↑ tap to pause</Text>
    </Animated.View>
  );
}

function TaskMock({ pulse }: { pulse: Animated.Value }) {
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  return (
    <Animated.View style={[vm.card, { transform: [{ scale }] }]}>
      <View style={vm.settingsRow}>
        <Ionicons name="options-outline" size={s(14)} color="rgba(255,255,255,0.7)" />
        <Text style={vm.settingsLabel}>Settings</Text>
        <View style={vm.settingsBadge}><Text style={vm.settingsBadgeText}>Tasks</Text></View>
      </View>
      <View style={vm.divider} />
      <View style={vm.taskItem}>
        <Ionicons name="bookmark-outline" size={s(13)} color="#A78BFA" />
        <View style={{ flex: 1 }}>
          <Text style={vm.taskTitle} numberOfLines={1}>Finish study chapter 3</Text>
          <Text style={vm.taskObj}>Academic → Study Plan</Text>
        </View>
        <Ionicons name="checkmark-circle" size={s(16)} color="rgba(255,255,255,0.7)" />
      </View>
    </Animated.View>
  );
}

function ModesMock({ pulse }: { pulse: Animated.Value }) {
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  return (
    <Animated.View style={[vm.card, { transform: [{ scale }], gap: s(8) }]}>
      {[
        { icon: "timer-outline" as const, label: "Pomodoro", sub: "25m work · 5m break", active: true, color: "#34D399" },
        { icon: "stopwatch-outline" as const, label: "Stopwatch", sub: "Count up freely", active: false, color: "rgba(255,255,255,0.5)" },
      ].map(({ icon, label, sub, active, color }) => (
        <View key={label} style={[vm.modeCard, active && vm.modeCardActive]}>
          <Ionicons name={icon} size={s(16)} color={color} />
          <View style={{ flex: 1 }}>
            <Text style={[vm.modeLabel, { color: active ? "#fff" : "rgba(255,255,255,0.55)" }]}>{label}</Text>
            <Text style={vm.modeSub}>{sub}</Text>
          </View>
          {active && <Ionicons name="checkmark-circle" size={s(14)} color="rgba(255,255,255,0.7)" />}
        </View>
      ))}
    </Animated.View>
  );
}

function ControlsMock({ pulse }: { pulse: Animated.Value }) {
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  return (
    <Animated.View style={[vm.card, { transform: [{ scale }] }]}>
      <View style={vm.bottomBar}>
        {[
          { icon: "musical-notes" as const, label: "Disable Music", active: true, color: "#FBBF24" },
          { icon: "eye-off" as const, label: "Hide", active: false, color: "rgba(255,255,255,0.6)" },
        ].map(({ icon, label, active, color }) => (
          <View key={label} style={[vm.ctrlPill, active && vm.ctrlPillActive]}>
            <Ionicons name={icon} size={s(15)} color={color} />
            <Text style={[vm.ctrlLabel, { color }]}>{label}</Text>
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
  targetMinutes?: number;
};

export function FocusRoomTutorial({ visible, onDone, targetMinutes = 60 }: Props) {
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
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
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

  const handleSkip = () => onDone();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
      <Pressable style={styles.backdrop} onPress={handleSkip}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, s(20)) }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Step dots */}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === step ? styles.dotActive : styles.dotInactive,
                ]}
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
              {current.visual === "timer"    && <TimerMock    pulse={pulseAnim} />}
              {current.visual === "task"     && <TaskMock     pulse={pulseAnim} />}
              {current.visual === "modes"    && <ModesMock    pulse={pulseAnim} />}
              {current.visual === "controls" && <ControlsMock pulse={pulseAnim} />}
            </View>

            {/* Daily goal note on step 1 */}
            {step === 0 && (
              <View style={styles.goalNote}>
                <Ionicons name="flash" size={s(14)} color="#FBBF24" />
                <Text style={styles.goalNoteText}>
                  Your daily focus goal is <Text style={{ color: "#FBBF24", fontWeight: "700" }}>{targetMinutes} min</Text>. Every session counts.
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Actions */}
          <View style={styles.actions}>
            {!isLast ? (
              <Pressable onPress={handleSkip} style={styles.skipBtn} hitSlop={8}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable
              onPress={handleNext}
              style={styles.nextBtn}
            >
              <Text style={styles.nextText}>{isLast ? "Let's focus!" : "Next"}</Text>
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
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: s(16),
    padding: s(14),
    alignItems: "center",
    gap: s(6),
  },
  timerNum: {
    color: "#fff",
    fontSize: s(40),
    fontWeight: "900",
    letterSpacing: -1,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
  },
  dot: {
    width: s(7),
    height: s(7),
    borderRadius: s(4),
  },
  subText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: s(13),
    fontWeight: "700",
  },
  hint: {
    color: "rgba(255,255,255,0.3)",
    fontSize: s(11),
    fontWeight: "700",
    marginTop: s(2),
  },
  // Task mock
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
    alignSelf: "stretch",
  },
  settingsLabel: {
    color: "rgba(255,255,255,0.65)",
    fontWeight: "700",
    fontSize: s(13),
    flex: 1,
  },
  settingsBadge: {
    backgroundColor: "rgba(167,139,250,0.25)",
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: s(999),
  },
  settingsBadgeText: {
    color: "#A78BFA",
    fontWeight: "700",
    fontSize: s(11),
  },
  divider: {
    height: s(1),
    backgroundColor: "rgba(255,255,255,0.1)",
    alignSelf: "stretch",
    marginVertical: s(4),
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    alignSelf: "stretch",
  },
  taskTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: s(13),
  },
  taskObj: {
    color: "rgba(255,255,255,0.38)",
    fontWeight: "700",
    fontSize: s(10),
    marginTop: s(1),
  },
  // Modes mock
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
    padding: s(10),
    borderRadius: s(10),
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignSelf: "stretch",
  },
  modeCardActive: {
    borderColor: "rgba(52,211,153,0.35)",
    backgroundColor: "rgba(52,211,153,0.08)",
  },
  modeLabel: {
    fontWeight: "800",
    fontSize: s(13),
  },
  modeSub: {
    color: "rgba(255,255,255,0.35)",
    fontWeight: "700",
    fontSize: s(10),
    marginTop: s(1),
  },
  // Controls mock
  bottomBar: {
    flexDirection: "row",
    gap: s(8),
    alignSelf: "stretch",
    justifyContent: "center",
  },
  ctrlPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(6),
    paddingVertical: s(10),
    borderRadius: s(999),
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  ctrlPillActive: {
    borderColor: "rgba(251,191,36,0.3)",
    backgroundColor: "rgba(251,191,36,0.08)",
  },
  ctrlLabel: {
    fontWeight: "700",
    fontSize: s(12),
  },
});

// ─── Main styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1A1A2E",
    borderTopLeftRadius: s(26),
    borderTopRightRadius: s(26),
    paddingTop: s(20),
    paddingHorizontal: s(22),
    borderTopWidth: s(1),
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: s(6),
    marginBottom: s(20),
  },
  dot: {
    height: s(6),
    borderRadius: s(3),
  },
  dotActive: {
    width: s(20),
    backgroundColor: "#6EC6FF",
  },
  dotInactive: {
    width: s(6),
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  body: {
    alignItems: "center",
    gap: s(12),
  },
  iconBadge: {
    width: s(60),
    height: s(60),
    borderRadius: s(18),
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontWeight: "900",
    fontSize: s(20),
    textAlign: "center",
  },
  bodyText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: s(14),
    fontWeight: "500",
    textAlign: "center",
    lineHeight: s(21),
  },
  visualArea: {
    width: "100%",
    marginTop: s(4),
  },
  goalNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    backgroundColor: "rgba(251,191,36,0.08)",
    borderWidth: s(1),
    borderColor: "rgba(251,191,36,0.2)",
    borderRadius: s(12),
    paddingHorizontal: s(12),
    paddingVertical: s(10),
    width: "100%",
  },
  goalNoteText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: s(12),
    fontWeight: "500",
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: s(20),
  },
  skipBtn: {
    paddingVertical: s(12),
    paddingHorizontal: s(4),
  },
  skipText: {
    color: "rgba(255,255,255,0.38)",
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
    backgroundColor: "#6EC6FF",
  },
  nextText: {
    color: "#fff",
    fontSize: s(16),
    fontWeight: "700",
  },
});
