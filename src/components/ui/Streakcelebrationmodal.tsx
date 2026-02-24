// src/components/ui/StreakCelebrationModal.tsx
import React, { useEffect, useRef, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
} from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");

// Days Mon → Sun
const WEEK_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// Orange flame color
const FLAME_COLOR = "#FF9F40";
// Ice blue for missed days
const ICE_COLOR = "#B8D8F0";
// Dot active glow
const FLAME_GLOW = "rgba(255,159,64,0.18)";

type Props = {
  visible: boolean;
  streakCount: number;
  previousStreak: number;
  /** 7 booleans Mon(0)→Sun(6), true = user was active that day */
  weekActivity: boolean[];
  onDismiss: () => void;
};

export function StreakCelebrationModal({
  visible,
  streakCount,
  previousStreak,
  weekActivity,
  onDismiss,
}: Props) {
  // ── Overlay ──────────────────────────────────────────────────────────────
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // ── Flame ────────────────────────────────────────────────────────────────
  const flameScale = useRef(new Animated.Value(0)).current;
  const flamePulse = useRef(new Animated.Value(1)).current;

  // ── Number count-up ──────────────────────────────────────────────────────
  const countAnim = useRef(new Animated.Value(previousStreak)).current;
  const [displayCount, setDisplayCount] = React.useState(previousStreak);

  // ── Label fade ───────────────────────────────────────────────────────────
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const labelTranslate = useRef(new Animated.Value(10)).current;

  // ── Dot anims (7 dots) ───────────────────────────────────────────────────
  const dotScales = useRef(
    Array.from({ length: 7 }, () => new Animated.Value(0.6))
  ).current;
  const dotOpacities = useRef(
    Array.from({ length: 7 }, () => new Animated.Value(0))
  ).current;

  // ── Warning text ─────────────────────────────────────────────────────────
  const warningOpacity = useRef(new Animated.Value(0)).current;

  // ── Reset all values before playing ──────────────────────────────────────
  const resetAnims = useCallback(() => {
    overlayOpacity.setValue(0);
    flameScale.setValue(0);
    flamePulse.setValue(1);
    countAnim.setValue(previousStreak);
    setDisplayCount(previousStreak);
    labelOpacity.setValue(0);
    labelTranslate.setValue(10);
    dotScales.forEach((d) => d.setValue(0.6));
    dotOpacities.forEach((d) => d.setValue(0));
    warningOpacity.setValue(0);
  }, [previousStreak]);

  // ── Main sequence ─────────────────────────────────────────────────────────
  const playSequence = useCallback(() => {
    // Listen to countAnim and update displayCount integer
    const listenerId = countAnim.addListener(({ value }) => {
      setDisplayCount(Math.round(value));
    });

    // 1. Overlay fades in
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    // 2. Flame spring in (200ms delay)
    Animated.sequence([
      Animated.delay(200),
      Animated.spring(flameScale, {
        toValue: 1,
        tension: 120,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Subtle infinite pulse after entry
      Animated.loop(
        Animated.sequence([
          Animated.timing(flamePulse, {
            toValue: 1.07,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(flamePulse, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // 3. Count-up (starts 500ms in, duration 600ms)
    Animated.sequence([
      Animated.delay(500),
      Animated.timing(countAnim, {
        toValue: streakCount,
        duration: 650,
        useNativeDriver: false, // number interpolation needs JS driver
      }),
    ]).start(() => {
      countAnim.removeListener(listenerId);
      setDisplayCount(streakCount);
    });

    // 4. "day streak" label fades in (800ms)
    Animated.sequence([
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(labelOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(labelTranslate, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 5. Dots stagger in (1000ms base, 80ms apart)
    const dotAnims = dotScales.map((scale, i) =>
      Animated.sequence([
        Animated.delay(1000 + i * 80),
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1,
            tension: 180,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(dotOpacities[i], {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    Animated.parallel(dotAnims).start();

    // 6. Warning text (1700ms)
    Animated.sequence([
      Animated.delay(1700),
      Animated.timing(warningOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [streakCount, previousStreak]);

  // ── Dismiss with fade-out ─────────────────────────────────────────────────
  const handleDismiss = useCallback(() => {
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [onDismiss]);

  // ── Trigger on open ───────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      resetAnims();
      // Small tick so reset has time to apply before playing
      const t = setTimeout(playSequence, 30);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!visible) return null;

  const flameAnimStyle = {
    transform: [
      { scale: Animated.multiply(flameScale, flamePulse) },
    ],
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
        <Animated.View style={[styles.backdrop, { opacity: overlayOpacity }]}>
          {/* ── Content card ── */}
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            {/* Flame */}
            <Animated.Text style={[styles.flameEmoji, flameAnimStyle]}>
              🔥
            </Animated.Text>

            {/* Count */}
            <Text style={styles.countText}>{displayCount}</Text>

            {/* Label */}
            <Animated.Text
              style={[
                styles.labelText,
                {
                  opacity: labelOpacity,
                  transform: [{ translateY: labelTranslate }],
                },
              ]}
            >
              {streakCount === 1 ? "day streak" : "day streak"}
            </Animated.Text>

            {/* Week dots */}
            <View style={styles.dotsContainer}>
              {WEEK_LABELS.map((label, i) => {
                const active = weekActivity[i] ?? false;
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.dotWrapper,
                      {
                        opacity: dotOpacities[i],
                        transform: [{ scale: dotScales[i] }],
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.dot,
                        active
                          ? { backgroundColor: FLAME_COLOR, shadowColor: FLAME_COLOR, shadowOpacity: 0.45, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4 }
                          : { backgroundColor: ICE_COLOR },
                      ]}
                    />
                    <Text
                      style={[
                        styles.dotLabel,
                        { color: active ? FLAME_COLOR : "#9BB5CA" },
                      ]}
                    >
                      {label}
                    </Text>
                  </Animated.View>
                );
              })}
            </View>

            {/* Warning */}
            <Animated.View
              style={[styles.warningBox, { opacity: warningOpacity }]}
            >
              <Text style={styles.warningText}>
                {streakCount >= 7
                  ? "🏆 Amazing! Keep the flame alive!"
                  : "Don't break it tomorrow. Watch out! 👀"}
              </Text>
            </Animated.View>
          </Pressable>

          {/* Tap hint */}
          <Animated.Text
            style={[styles.tapHint, { opacity: warningOpacity }]}
          >
            Tap anywhere to continue
          </Animated.Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 20, 35, 0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: SCREEN_W * 0.82,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: "center",
    // Subtle shadow
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },

  // ── Flame ──
  flameEmoji: {
    fontSize: 80,
    lineHeight: 96,
    marginBottom: 8,
  },

  // ── Count ──
  countText: {
    fontSize: 72,
    fontWeight: "800",
    color: FLAME_COLOR,
    lineHeight: 80,
    letterSpacing: -2,
  },

  // ── Label ──
  labelText: {
    fontSize: 20,
    fontWeight: "600",
    color: FLAME_COLOR,
    marginTop: 4,
    marginBottom: 32,
    letterSpacing: 0.3,
  },

  // ── Dots ──
  dotsContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },
  dotWrapper: {
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dotLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // ── Warning ──
  warningBox: {
    backgroundColor: "rgba(255,159,64,0.08)",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,159,64,0.18)",
  },
  warningText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8A6030",
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Tap hint ──
  tapHint: {
    marginTop: 24,
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});