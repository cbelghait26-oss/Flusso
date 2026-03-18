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

type Props = NativeStackScreenProps<RootStackParamList, "Q6DirectedFocusScreen">;

// ── Stage dimensions ─────────────────────────────────────────
const STAGE_W = s(310);
const STAGE_H = s(400);
const OBJ_H   = s(46);
const TASK_H  = s(28);
const TASK_V_GAP = s(4);
const BELOW   = s(8);

const chipW = (text: string) =>
  Math.max(s(72), Math.min(s(144), s(text.length * 7 + 14)));

// ── Objective cards — scattered positions ────────────────────
const OBJECTIVES = [
  {
    title: "Get Fit",
    left: s(8),   top: s(14),  objW: s(92),
    bgColor: "rgba(190,50,70,0.88)",
    borderColor: "rgba(255,120,140,0.40)",
  },
  {
    // Shifted right so its task chips (left=s(170)) don't conflict
    // with Save Money chips (left=s(8), max width s(144) → right s(152))
    title: "Ace Calculus Finals",
    left: s(166), top: s(80),  objW: s(144),
    bgColor: "rgba(80,20,200,0.88)",
    borderColor: "rgba(170,110,255,0.40)",
  },
  {
    title: "Save Money",
    left: s(8),   top: s(240), objW: s(132),
    bgColor: "rgba(12,72,180,0.88)",
    borderColor: "rgba(70,150,255,0.40)",
  },
];

// ── Task chips ───────────────────────────────────────────────
const TASK_DATA = [
  { label: "Chest day",        oi: 0 },
  { label: "Meal Prep",        oi: 0 },
  { label: "Morning run",      oi: 0 },
  { label: "Review Notes",     oi: 1 },
  { label: "Past Finals",      oi: 1 },
  { label: "Study group",      oi: 1 },
  { label: "Make Budget",      oi: 2 },
  { label: "Track Expenses",   oi: 2 },
  { label: "Make a Portfolio", oi: 2 },
];

// Final positions — stacked vertically under each objective
const _grpSlots = [0, 0, 0];
const TASK_FINALS = TASK_DATA.map((t) => {
  const slot = _grpSlots[t.oi]++;
  const obj  = OBJECTIVES[t.oi];
  return {
    left:  obj.left,
    top:   obj.top + OBJ_H + BELOW + slot * (TASK_H + TASK_V_GAP),
    width: chipW(t.label),
  };
});

// Scatter offsets = (abs_scatter_pos − final_pos), verified non-overlapping:
//   i=0 (210,10)   i=1 (210,165)  i=2 (185,315)
//   i=3 (10, 10)   i=4 (10, 315)  i=5 (10, 115)
//   i=6 (185,265)  i=7 (185, 65)  i=8 (10, 215)
const TASK_SCATTER = [
  { x:  s(202), y: -s(58)  },  // Chest day        final(8,68)   → abs(210,10)
  { x:  s(202), y:  s(65)  },  // Meal Prep        final(8,100)  → abs(210,165)
  { x:  s(177), y:  s(183) },  // Morning run      final(8,132)  → abs(185,315)
  { x: -s(156), y: -s(124) },  // Review Notes     final(166,134)→ abs(10,10)
  { x: -s(156), y:  s(149) },  // Past Finals      final(166,166)→ abs(10,315)
  { x: -s(156), y: -s(83)  },  // Study group      final(166,198)→ abs(10,115)
  { x:  s(177), y: -s(29)  },  // Make Budget      final(8,294)  → abs(185,265)
  { x:  s(177), y: -s(261) },  // Track Expenses   final(8,326)  → abs(185,65)
  { x:    s(2), y: -s(143) },  // Make a Portfolio final(8,358)  → abs(10,215)
];

const STEPS = [
  "Tasks everywhere — but nothing moves forward.",
  "Each task belongs to a bigger goal.",
  "Organized effort creates real, visible progress.",
];

const CHIP_BG     = "rgba(58, 32, 162, 0.85)";
const CHIP_BORDER = "rgba(135, 100, 255, 0.45)";

const Q6DirectedFocusScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { isTablet } = useDeviceClass();

  const taskAnims = useRef(
    TASK_DATA.map((_, i) => ({
      opacity: new Animated.Value(0),
      tx: new Animated.Value(TASK_SCATTER[i].x),
      ty: new Animated.Value(TASK_SCATTER[i].y),
    }))
  ).current;

  const objAnims = useRef(
    OBJECTIVES.map(() => ({
      opacity: new Animated.Value(0),
      scale:   new Animated.Value(0.78),
    }))
  ).current;

  const [textIndex, setTextIndex] = useState(-1);
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textRise    = useRef(new Animated.Value(8)).current;
  const ctaOpacity  = useRef(new Animated.Value(0)).current;

  const showText = (idx: number, onDone?: () => void) => {
    textOpacity.setValue(0);
    textRise.setValue(8);
    setTextIndex(idx);
    Animated.parallel([
      Animated.timing(textOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(textRise,    { toValue: 0, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(textOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(onDone);
      }, 1950);
    });
  };

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      // Phase 1: all 9 tasks appear at scatter positions
      Animated.stagger(90, TASK_DATA.map((_, i) =>
        Animated.timing(taskAnims[i].opacity, { toValue: 0.78, duration: 240, useNativeDriver: true })
      )).start(() => {
        if (cancelled) return;

        showText(0, () => {
          if (cancelled) return;

          // Phase 2: objective cards spring in at their scattered positions
          Animated.stagger(140, OBJECTIVES.map((_, gi) =>
            Animated.parallel([
              Animated.timing(objAnims[gi].opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
              Animated.spring(objAnims[gi].scale, {
                toValue: 1, friction: 6, tension: 88, useNativeDriver: true,
              }),
            ])
          )).start(() => {
            if (cancelled) return;

            showText(1, () => {
              if (cancelled) return;

              // Phase 3: tasks snap home vertically under their objective
              Animated.stagger(60, TASK_DATA.map((_, i) =>
                Animated.parallel([
                  Animated.timing(taskAnims[i].tx, {
                    toValue: 0, duration: 370,
                    easing: Easing.out(Easing.back(1.08)), useNativeDriver: true,
                  }),
                  Animated.timing(taskAnims[i].ty, {
                    toValue: 0, duration: 370,
                    easing: Easing.out(Easing.back(1.08)), useNativeDriver: true,
                  }),
                  Animated.timing(taskAnims[i].opacity, {
                    toValue: 1, duration: 300, useNativeDriver: true,
                  }),
                ])
              )).start(() => {
                if (cancelled) return;

                showText(2, () => {
                  if (cancelled) return;
                  setTimeout(() => {
                    Animated.timing(ctaOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
                  }, 350);
                });
              });
            });
          });
        });
      });
    };

    const timer = setTimeout(run, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <View style={styles.outerBg}>
      <LinearGradient colors={["#0D0530", "#180860", "#240C90"]} start={{ x: 0.1, y: 0.3 }} end={{ x: 0.9, y: 0.7 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["transparent", "rgba(120,60,240,0.25)", "rgba(160,90,255,0.14)", "transparent"]} start={{ x: 1, y: 0.1 }} end={{ x: 0, y: 0.9 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(180,100,255,0.09)", "transparent", "rgba(90,30,200,0.13)"]} start={{ x: 0.7, y: 0 }} end={{ x: 0.08, y: 1 }} style={StyleSheet.absoluteFill} />

      <View style={StyleSheet.absoluteFill}>
        <View style={[
          styles.container,
          isTablet && { maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" as const, width: "100%" },
        ]}>
          <View style={[styles.stage, { paddingTop: insets.top + s(20) }]}>
            {/* Fixed-size canvas */}
            <View style={{ width: STAGE_W, height: STAGE_H }}>
              {/* Objective cards — scattered across canvas */}
              {OBJECTIVES.map((obj, gi) => (
                <Animated.View
                  key={obj.title}
                  style={[
                    styles.objCard,
                    {
                      left: obj.left, top: obj.top, width: obj.objW, height: OBJ_H,
                      backgroundColor: obj.bgColor,
                      borderColor: obj.borderColor,
                      opacity: objAnims[gi].opacity,
                      transform: [{ scale: objAnims[gi].scale }],
                    },
                  ]}
                >
                  <Text style={styles.objEyebrow}>OBJECTIVE</Text>
                  <Text style={styles.objTitle}>{obj.title}</Text>
                </Animated.View>
              ))}

              {/* Task chips — same colour, different widths; scatter → snap vertically */}
              {TASK_DATA.map((task, i) => (
                <Animated.View
                  key={`task-${i}`}
                  style={[
                    styles.taskChip,
                    {
                      left:  TASK_FINALS[i].left,
                      top:   TASK_FINALS[i].top,
                      width: TASK_FINALS[i].width,
                      opacity: taskAnims[i].opacity,
                      transform: [
                        { translateX: taskAnims[i].tx },
                        { translateY: taskAnims[i].ty },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.taskText} numberOfLines={1}>{task.label}</Text>
                </Animated.View>
              ))}
            </View>

            {/* Caption below canvas */}
            {textIndex >= 0 && (
              <Animated.Text style={[styles.stepText, { opacity: textOpacity, transform: [{ translateY: textRise }] }]}>
                {STEPS[textIndex]}
              </Animated.Text>
            )}
          </View>

          <Animated.View style={[styles.ctaWrap, { bottom: insets.bottom + s(16), opacity: ctaOpacity }]}>
            <TouchableOpacity
              style={styles.cta}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("Q7ModelScreen", { setup: route.params?.setup ?? {} })}
            >
              <Text style={styles.ctaText}>Continue</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

export default Q6DirectedFocusScreen;

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
    justifyContent: "flex-start",
  },
  objCard: {
    position: "absolute",
    borderRadius: s(10),
    borderWidth: 1,
    paddingHorizontal: s(10),
    justifyContent: "center",
  },
  objEyebrow: {
    color: "rgba(255,255,255,0.52)",
    fontSize: s(8),
    fontWeight: "800",
    letterSpacing: s(1.2),
    textTransform: "uppercase",
    marginBottom: s(1),
  },
  objTitle: {
    color: "#F4F6F2",
    fontSize: s(13),
    fontWeight: "700",
    lineHeight: s(17),
  },
  taskChip: {
    position: "absolute",
    height: TASK_H,
    borderRadius: s(8),
    borderWidth: 1,
    paddingHorizontal: s(9),
    justifyContent: "center",
    backgroundColor: CHIP_BG,
    borderColor: CHIP_BORDER,
  },
  taskText: {
    color: "rgba(244,246,242,0.92)",
    fontSize: s(11),
    fontWeight: "600",
  },
  stepText: {
    marginTop: s(18),
    color: "rgba(244,246,242,0.90)",
    fontSize: s(16),
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: s(16),
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
    color: "#0D0320",
    fontSize: s(18),
    fontWeight: "700",
  },
});
