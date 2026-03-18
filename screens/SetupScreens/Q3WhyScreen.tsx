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

type Props = NativeStackScreenProps<RootStackParamList, "Q3WhyScreen">;

const TASKS = [
  "reply emails",
  "complete assignment",
  "prepare meeting",
  "organize notes",
  "read article",
];

const SCATTER_POSITIONS = [
  { x: -s(95), y: -s(80) },
  { x: s(85), y: -s(100) },
  { x: -s(120), y: s(30) },
  { x: s(105), y: s(60) },
  { x: -s(40), y: s(110) },
];

const ROTATIONS = ["-13deg", "9deg", "-19deg", "15deg", "-7deg"];

const STEPS = [
  "Most tools only manage tasks.",
  "Without direction, nothing anchors them.",
  "So effort stays scattered.",
];

const Q3WhyScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { isTablet } = useDeviceClass();

  const taskAnims = useRef(
    TASKS.map((_, i) => ({
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(SCATTER_POSITIONS[i].x),
      translateY: new Animated.Value(SCATTER_POSITIONS[i].y),
    }))
  ).current;

  // Ghost objective card
  const ghostOpacity = useRef(new Animated.Value(0)).current;
  const ghostScale = useRef(new Animated.Value(0.82)).current;

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
      // Phase 1: scattered tasks fade in
      Animated.stagger(220, TASKS.map((_, i) =>
        Animated.timing(taskAnims[i].opacity, { toValue: 0.55, duration: 300, useNativeDriver: true })
      )).start(() => {
        if (cancelled) return;

        // Text 0: "Most tools only manage tasks."
        showText(0, () => {
          if (cancelled) return;

          // Ghost objective card springs in as text 1 starts
          Animated.parallel([
            Animated.spring(ghostScale, {
              toValue: 1,
              friction: 7,
              tension: 90,
              useNativeDriver: true,
            }),
            Animated.timing(ghostOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
          ]).start();

          // Text 1: "Without direction, nothing anchors them." — ghost visible during this
          showText(1, () => {
            if (cancelled) return;

            // Ghost fades away as text 2 starts — revealing the void
            Animated.timing(ghostOpacity, { toValue: 0, duration: 550, useNativeDriver: true }).start();

            // Text 2: "So effort stays scattered."
            showText(2, () => {
              if (cancelled) return;

              // Tasks dim further — the void is complete
              Animated.parallel(
                TASKS.map((_, i) =>
                  Animated.timing(taskAnims[i].opacity, { toValue: 0.12, duration: 700, useNativeDriver: true })
                )
              ).start(() => {
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
                }, 400);
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
      <LinearGradient colors={["#020B30", "#05186A", "#082490"]} start={{ x: 0, y: 0.25 }} end={{ x: 1, y: 0.75 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["transparent", "rgba(0,80,200,0.28)", "rgba(20,120,220,0.16)", "transparent"]} start={{ x: 1, y: 0.1 }} end={{ x: 0, y: 0.9 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(40,120,230,0.10)", "transparent", "rgba(0,40,180,0.14)"]} start={{ x: 0.68, y: 0 }} end={{ x: 0.1, y: 1 }} style={StyleSheet.absoluteFill} />

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: screenSlide }] }]}>
      <View style={[
        styles.container,
        isTablet && { maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" as const, width: "100%" },
      ]}>
        {/* Main stage */}
        <View style={[styles.stage, { paddingTop: insets.top + s(32) }]}>
          {/* Scattered task area */}
          <View style={styles.taskArea}>
            {/* Ghost objective card — the missing anchor */}
            <Animated.View
              style={[
                styles.ghostCard,
                { opacity: ghostOpacity, transform: [{ scale: ghostScale }] },
              ]}
            >
              <Text style={styles.ghostEyebrow}>OBJECTIVE</Text>
              <View style={styles.ghostDivider} />
              <Text style={styles.ghostEmpty}>???</Text>
            </Animated.View>

            {/* Scattered tilted tasks */}
            {TASKS.map((label, i) => (
              <Animated.View
                key={label}
                style={[
                  styles.bubble,
                  {
                    opacity: taskAnims[i].opacity,
                    transform: [
                      { translateX: taskAnims[i].translateX },
                      { translateY: taskAnims[i].translateY },
                      { rotate: ROTATIONS[i] },
                    ],
                  },
                ]}
              >
                <Text style={styles.bubbleText}>{label}</Text>
              </Animated.View>
            ))}
          </View>

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
          <Text style={styles.finalText}>Scattered effort rarely produces meaningful progress.</Text>
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[styles.ctaWrap, { bottom: insets.bottom + s(16), opacity: ctaOpacity }]}>
          <TouchableOpacity
            style={styles.cta}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("Q4QuoteScreen", { setup: route.params?.setup ?? {} })}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
      </Animated.View>
    </View>
  );
};

export default Q3WhyScreen;

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
  },

  taskArea: {
    width: s(260),
    height: s(260),
    alignItems: "center",
    justifyContent: "center",
  },

  ghostCard: {
    position: "absolute",
    width: s(190),
    paddingHorizontal: s(20),
    paddingVertical: s(16),
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: "rgba(160,110,255,0.50)",
    alignItems: "center",
  },
  ghostEyebrow: {
    color: "rgba(180,130,255,0.70)",
    fontSize: s(10),
    fontWeight: "700",
    letterSpacing: 1.8,
  },
  ghostDivider: {
    height: 1,
    width: "100%",
    backgroundColor: "rgba(160,110,255,0.22)",
    marginVertical: s(8),
  },
  ghostEmpty: {
    color: "rgba(255,255,255,0.20)",
    fontSize: s(18),
    fontWeight: "300",
    letterSpacing: 4,
  },

  bubble: {
    position: "absolute",
    paddingHorizontal: s(16),
    paddingVertical: s(9),
    borderRadius: s(10),
    backgroundColor: "#0d2845",
    borderWidth: 1,
    borderColor: "rgba(140,100,255,0.35)",
  },
  bubbleText: {
    color: "#F4F6F2",
    fontSize: s(13),
    fontWeight: "600",
  },

  stepTextWrap: {
    position: "absolute",
    bottom: s(24),
    left: 0,
    right: 0,
    alignItems: "center",
  },
  stepText: {
    backgroundColor: "rgba(10,20,55,0.90)",
    borderRadius: s(12),
    paddingHorizontal: s(22),
    paddingVertical: s(13),
    color: "rgba(244,246,242,0.95)",
    fontSize: s(16),
    fontWeight: "600",
    textAlign: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,140,60,0.18)",
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
