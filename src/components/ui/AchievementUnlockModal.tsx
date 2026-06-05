// src/components/ui/AchievementUnlockModal.tsx
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
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = SCREEN_W * 0.78;

// How long the card stays before auto-dismissing
const AUTO_DISMISS_MS = 3000;

export type AchievementModalData = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type Props = {
  visible: boolean;
  achievement: AchievementModalData | null;
  accentColor?: string;
  onDismiss: () => void;
};

export function AchievementUnlockModal({
  visible,
  achievement,
  accentColor = "#1C7ED6",
  onDismiss,
}: Props) {
  // ── Animated values ───────────────────────────────────────────────────────
  const backdropOpacity  = useRef(new Animated.Value(0)).current;
  const cardScale        = useRef(new Animated.Value(0.72)).current;
  const cardTranslateY   = useRef(new Animated.Value(24)).current;
  const labelOpacity     = useRef(new Animated.Value(0)).current;
  const titleScale       = useRef(new Animated.Value(0.8)).current;
  const titleOpacity     = useRef(new Animated.Value(0)).current;
  const subtitleOpacity  = useRef(new Animated.Value(0)).current;
  const iconScale        = useRef(new Animated.Value(0)).current;
  const iconGlow         = useRef(new Animated.Value(0)).current;

  // Auto-dismiss timer ref
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetAnims = useCallback(() => {
    backdropOpacity.setValue(0);
    cardScale.setValue(0.72);
    cardTranslateY.setValue(24);
    labelOpacity.setValue(0);
    titleScale.setValue(0.8);
    titleOpacity.setValue(0);
    subtitleOpacity.setValue(0);
    iconScale.setValue(0);
    iconGlow.setValue(0);
  }, []);

  // ── Dismiss with fade-out ─────────────────────────────────────────────────
  const handleDismiss = useCallback(() => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.88, duration: 180, useNativeDriver: true }),
      Animated.timing(cardTranslateY, { toValue: 16, duration: 180, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }, [onDismiss]);

  // ── Play sequence ─────────────────────────────────────────────────────────
  const playSequence = useCallback(() => {
    // 1. Backdrop (0ms)
    Animated.timing(backdropOpacity, {
      toValue: 1, duration: 200, useNativeDriver: true,
    }).start();

    // 2. Card springs in (0ms)
    Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1, tension: 140, friction: 8, useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0, tension: 140, friction: 8, useNativeDriver: true,
      }),
    ]).start();

    // 3. Icon pops in (180ms delay)
    Animated.sequence([
      Animated.delay(180),
      Animated.spring(iconScale, {
        toValue: 1, tension: 200, friction: 6, useNativeDriver: true,
      }),
    ]).start(() => {
      // Glow pulse loop after icon settles
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconGlow, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(iconGlow, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    });

    // 4. "Achievement Unlocked" label (320ms)
    Animated.sequence([
      Animated.delay(320),
      Animated.timing(labelOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    // 5. Badge title springs in (440ms)
    Animated.sequence([
      Animated.delay(440),
      Animated.parallel([
        Animated.spring(titleScale, {
          toValue: 1, tension: 160, friction: 7, useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]),
    ]).start();

    // 6. Subtitle fades (600ms)
    Animated.sequence([
      Animated.delay(600),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();

    // 7. Auto-dismiss
    autoDismissTimer.current = setTimeout(handleDismiss, AUTO_DISMISS_MS);
  }, [handleDismiss]);

  // ── Trigger on open ───────────────────────────────────────────────────────
  useEffect(() => {
    if (visible && achievement) {
      resetAnims();
      const t = setTimeout(playSequence, 30);
      return () => {
        clearTimeout(t);
        if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
      };
    }
  }, [visible, achievement]);

  if (!visible || !achievement) return null;

  // Glow color interpolation
  const glowOpacity = iconGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.45],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
        <Animated.View
          style={[StyleSheet.absoluteFillObject, styles.backdropFill, { opacity: backdropOpacity }]}
          pointerEvents="none"
        />

        {/* ── Card ── */}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
            },
          ]}
        >
          {/* Glow ring behind icon */}
          <Animated.View
            style={[
              styles.iconGlowRing,
              {
                backgroundColor: accentColor,
                opacity: glowOpacity,
                transform: [{ scale: iconScale }],
              },
            ]}
          />

          {/* Icon */}
          <Animated.View
            style={[
              styles.iconCircle,
              {
                backgroundColor: accentColor + "18",
                borderColor: accentColor + "35",
                transform: [{ scale: iconScale }],
              },
            ]}
          >
            <Ionicons name={achievement.icon} size={32} color={accentColor} />
          </Animated.View>

          {/* "Achievement Unlocked" label */}
          <Animated.Text
            style={[styles.unlockedLabel, { color: accentColor, opacity: labelOpacity }]}
          >
            Achievement Unlocked
          </Animated.Text>

          {/* Badge title */}
          <Animated.Text
            style={[
              styles.badgeTitle,
              {
                opacity: titleOpacity,
                transform: [{ scale: titleScale }],
              },
            ]}
          >
            {achievement.title}
          </Animated.Text>

          {/* Subtitle */}
          <Animated.Text
            style={[styles.badgeSubtitle, { opacity: subtitleOpacity }]}
          >
            {achievement.subtitle}
          </Animated.Text>

          {/* Tap hint */}
          <Animated.Text
            style={[styles.tapHint, { opacity: subtitleOpacity }]}
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backdropFill: {
    backgroundColor: "rgba(8, 16, 28, 0.78)",
  },

  card: {
    width: CARD_W,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },

  iconGlowRing: {
    position: "absolute",
    top: 24,
    width: 84,
    height: 84,
    borderRadius: 42,
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  unlockedLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  badgeTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F1923",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 8,
  },

  badgeSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7A8D",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },

  tapHint: {
    fontSize: 12,
    color: "#A0ADB8",
    fontWeight: "500",
  },
});