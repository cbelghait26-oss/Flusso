import React, { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";
import { s } from "../../src/ui/ts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../src/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDeviceClass, CONTENT_MAX_WIDTH } from "../../src/ui/responsive";

type Props = NativeStackScreenProps<RootStackParamList, "Q2MovementScreen">;

const TASKS = [
  "reply emails",
  "complete assignment",
  "prepare meeting",
  "organize notes",
  "read article",
];

const STEPS = [
  "You start the day with a full list.",
  "One by one, tasks get done.",
  "But what actually moved forward?",
];

const TRACK_W = s(240);
const FILL_W = TRACK_W * 0.15;

const Q2MovementScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { isTablet } = useDeviceClass();

  const taskAnims = useRef(
    TASKS.map(() => ({ opacity: new Animated.Value(0) }))
  ).current;

  // scaleX: 0 -> 1, native driver (expands from center through text)
  const strikeAnims = useRef(TASKS.map(() => new Animated.Value(0))).current;

  // progress bar section
  const progressOpacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current; // useNativeDriver: false

  const [textIndex, setTextIndex] = useState(-1);
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textRise = useRef(new Animated.Value(10)).current;

  const finalTextOpacity = useRef(new Animated.Value(0)).current;
  const finalTextRise = useRef(new Animated.Value(10)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const screenSlide = useRef(new Animated.Value(24)).current;

  const showText = (idx: number, onDone?: () => void) => {
    textOpacity.setValue(0);
    textRise.setValue(10);
    setTextIndex(idx);
    Animated.parallel([
      Animated.timing(textOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(textRise, { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(textOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(onDone);
      }, 1950);
    });
  };

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      // Phase 1: tasks appear stacked one by one
      Animated.stagger(300, TASKS.map((_, i) =>
        Animated.timing(taskAnims[i].opacity, { toValue: 1, duration: 320, useNativeDriver: true })
      )).start(() => {
        if (cancelled) return;
        showText(0, () => {
          if (cancelled) return;
          // Phase 2: strikethroughs animate across tasks
          Animated.stagger(180, TASKS.map((_, i) =>
            Animated.timing(strikeAnims[i], {
              toValue: 1,
              duration: 300,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            })
          )).start(() => {
            if (cancelled) return;
            showText(1, () => {
              if (cancelled) return;
              // Phase 3: progress bar fades in, fills to 15%
              Animated.timing(progressOpacity, { toValue: 1, duration: 380, useNativeDriver: true }).start();
              Animated.timing(progressWidth, {
                toValue: FILL_W,
                duration: 1100,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
              }).start();
              showText(2, () => {
                if (cancelled) return;
                setTimeout(() => {
                  if (cancelled) return;
                  Animated.parallel([
                    Animated.timing(finalTextOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
                    Animated.timing(finalTextRise, { toValue: 0, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                  ]).start(() => {
                    if (cancelled) return;
                    setTimeout(() => {
                      Animated.timing(ctaOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
                    }, 700);
                  });
                }, 700);
              });
            });
          });
        });
      });
    };

    Animated.timing(screenSlide, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const timer = setTimeout(run, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <View style={styles.outerBg}>
      <LinearGradient colors={["#001820", "#003840", "#006065"]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["transparent", "rgba(0,140,160,0.32)", "rgba(0,180,190,0.18)", "transparent"]} start={{ x: 1, y: 0.15 }} end={{ x: 0, y: 0.85 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(0,200,200,0.10)", "transparent", "rgba(0,100,150,0.15)"]} start={{ x: 0.65, y: 0 }} end={{ x: 0.1, y: 1 }} style={StyleSheet.absoluteFill} />

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: screenSlide }] }]}>
      <View style={[
        styles.container,
        isTablet && { maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" as const, width: "100%" },
      ]}>
        {/* Main stage */}
        <View style={[styles.stage, { paddingTop: insets.top + s(32) }]}>
          {/* Stacked task bubbles */}
          <View style={styles.taskStack}>
            {TASKS.map((label, i) => (
              <Animated.View
                key={label}
                style={[styles.bubble, { opacity: taskAnims[i].opacity }]}
              >
                <Text style={styles.bubbleText}>{label}</Text>
                {/* Strikethrough overlay — scaleX 0->1 expands from center */}
                <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                  <View style={styles.strikeRow}>
                    <Animated.View
                      style={[styles.strikeLine, { transform: [{ scaleX: strikeAnims[i] }] }]}
                    />
                  </View>
                </View>
              </Animated.View>
            ))}
          </View>

          {/* Progress section — fades in during text 3 */}
          <Animated.View style={[styles.progressSection, { opacity: progressOpacity }]}>
            <Text style={styles.progressLabel}>Today{"\u2019"}s Progress</Text>
            <View style={[styles.progressBarTrack, { width: TRACK_W }]}>
              <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
            </View>
          </Animated.View>

          {/* Cycling step text */}
          {textIndex >= 0 && (
            <Animated.View
              style={[
                styles.stepTextWrap,
                { opacity: textOpacity, transform: [{ translateY: textRise }] },
              ]}
            >
              <Text style={styles.stepText}>{STEPS[textIndex]}</Text>
            </Animated.View>
          )}
        </View>

        {/* Final punchline */}
        <Animated.View style={[styles.finalWrap, { opacity: finalTextOpacity, transform: [{ translateY: finalTextRise }] }]}>
          <Text style={styles.finalText}>Movement does not always mean progress.</Text>
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[styles.ctaWrap, { bottom: insets.bottom + s(16), opacity: ctaOpacity }]}>
          <TouchableOpacity
            style={styles.cta}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("Q3WhyScreen", { setup: route.params?.setup ?? {} })}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
      </Animated.View>
    </View>
  );
};

export default Q2MovementScreen;

const styles = StyleSheet.create({
  outerBg: { flex: 1, backgroundColor: "#000612" },
  container: {
    flex: 1,
    position: "relative",
    paddingHorizontal: s(20),
    paddingBottom: s(90),
  },

  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: s(28),
  },

  taskStack: {
    alignItems: "center",
    gap: s(10),
  },

  bubble: {
    minWidth: s(196),
    paddingHorizontal: s(18),
    paddingVertical: s(11),
    borderRadius: s(10),
    backgroundColor: "#0f3f87",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    overflow: "hidden",
  },
  bubbleText: {
    color: "#F4F6F2",
    fontSize: s(14),
    fontWeight: "600",
  },

  strikeRow: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: s(18),
  },
  strikeLine: {
    height: s(2),
    backgroundColor: "rgba(244,246,242,0.80)",
    borderRadius: s(1),
  },

  progressSection: {
    alignItems: "center",
    gap: s(8),
  },
  progressLabel: {
    color: "rgba(244,246,242,0.45)",
    fontSize: s(11),
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  progressBarTrack: {
    height: s(6),
    borderRadius: s(999),
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "rgba(244,246,242,0.50)",
    borderRadius: s(999),
  },

  stepTextWrap: {
    position: "absolute",
    bottom: s(24),
    left: 0,
    right: 0,
    alignItems: "center",
  },
  stepText: {
    backgroundColor: "rgba(2,12,55,0.82)",
    borderRadius: s(12),
    paddingHorizontal: s(20),
    paddingVertical: s(12),
    color: "rgba(244,246,242,0.95)",
    fontSize: s(17),
    fontWeight: "600",
    textAlign: "center",
    overflow: "hidden",
  },

  finalWrap: {
    paddingHorizontal: s(12),
    paddingBottom: s(16),
  },
  finalText: {
    color: "#F4F6F2",
    fontSize: s(22),
    fontWeight: "800",
    textAlign: "center",
    lineHeight: s(30),
  },

  ctaWrap: {
    position: "absolute",
    left: s(20),
    right: s(20),
  },
  cta: {
    height: s(48),
    borderRadius: s(14),
    backgroundColor: "#F4F6F2",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "#002640",
    fontSize: s(18),
    fontWeight: "700",
  },
});
