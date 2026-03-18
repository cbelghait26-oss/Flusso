import React, { useEffect, useRef } from "react";
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

type Props = NativeStackScreenProps<RootStackParamList, "Q7ModelScreen">;

const ROWS = [
  { label: "Objectives", sub: "Define where you're going." },
  { label: "Tasks", sub: "Break the goal into concrete steps." },
  { label: "Focus Sessions", sub: "Protect time to actually do the work." },
  { label: "Progress", sub: null },
];

const Q7ModelScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { isTablet } = useDeviceClass();

  const rowAnims = useRef(
    ROWS.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(16),
    }))
  ).current;

  const connectorAnims = useRef(
    // 3 connectors between 4 rows
    Array.from({ length: 3 }, () => new Animated.Value(0))
  ).current;

  const finalOpacity = useRef(new Animated.Value(0)).current;
  const finalRise = useRef(new Animated.Value(8)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      const seq = ROWS.flatMap((_, i) => {
        const rowAnim = Animated.parallel([
          Animated.timing(rowAnims[i].opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(rowAnims[i].translateY, { toValue: 0, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]);

        if (i < 3) {
          const connAnim = Animated.timing(connectorAnims[i], {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          });
          return [rowAnim, connAnim];
        }
        return [rowAnim];
      });

      Animated.sequence(seq.map((a, i) => Animated.sequence([Animated.delay(i === 0 ? 0 : 120), a]))).start(() => {
        if (cancelled) return;
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(finalOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(finalRise, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]).start(() => {
            if (cancelled) return;
            setTimeout(() => {
              Animated.timing(ctaOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
            }, 400);
          });
        }, 400);
      });
    };

    const timer = setTimeout(run, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <View style={styles.outerBg}>
      <LinearGradient colors={["#0E0430", "#1C0860", "#2A0C88"]} start={{ x: 0, y: 0.78 }} end={{ x: 1, y: 0.22 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["transparent", "rgba(110,40,210,0.24)", "rgba(150,80,230,0.13)", "transparent"]} start={{ x: 1, y: 0.1 }} end={{ x: 0, y: 0.9 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(170,80,255,0.09)", "transparent", "rgba(80,15,195,0.13)"]} start={{ x: 0.65, y: 0 }} end={{ x: 0.08, y: 1 }} style={StyleSheet.absoluteFill} />

      <View style={StyleSheet.absoluteFill}>
      <View style={[
        styles.container,
        isTablet && { maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" as const, width: "100%" },
      ]}>
        {/* Content */}
        <View style={[styles.content, { paddingTop: insets.top + s(32) }]}>

          {/* Diagram */}
          <View style={styles.diagram}>
            {ROWS.map((row, i) => (
              <View key={row.label}>
                {/* Row */}
                <Animated.View style={[
                  styles.rowCard,
                  { opacity: rowAnims[i].opacity, transform: [{ translateY: rowAnims[i].translateY }] },
                ]}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  {row.sub && <Text style={styles.rowSub}>{row.sub}</Text>}
                </Animated.View>

                {/* Connector arrow */}
                {i < 3 && (
                  <Animated.View style={[styles.connector, { opacity: connectorAnims[i] }]}>
                    <Text style={styles.arrow}>↓</Text>
                  </Animated.View>
                )}
              </View>
            ))}
          </View>

          {/* Final line */}
          <Animated.Text style={[styles.finalText, { opacity: finalOpacity, transform: [{ translateY: finalRise }] }]}>
            Big goals take time. A clear path makes them possible.
          </Animated.Text>
        </View>

        {/* CTA */}
        <Animated.View style={[styles.ctaWrap, { bottom: insets.bottom + s(16), opacity: ctaOpacity }]}>
          <TouchableOpacity
            style={styles.cta}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("Q8FocusCommitScreen", { setup: route.params?.setup ?? {} })}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
      </View>
    </View>
  );
};

export default Q7ModelScreen;

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
    backgroundColor: "#0c4191",
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

  diagram: {
    alignItems: "center",
    marginBottom: s(24),
  },

  rowCard: {
    width: s(280),
    borderRadius: s(12),
    backgroundColor: "#0f3f87",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: s(16),
    paddingVertical: s(12),
  },
  rowLabel: {
    color: "#F4F6F2",
    fontSize: s(16),
    fontWeight: "800",
  },
  rowSub: {
    color: "rgba(244,246,242,0.6)",
    fontSize: s(12),
    marginTop: s(2),
  },

  connector: {
    alignItems: "center",
    paddingVertical: s(2),
  },
  arrow: {
    color: "rgba(244,246,242,0.5)",
    fontSize: s(18),
  },

  finalText: {
    color: "#F4F6F2",
    fontSize: s(18),
    fontWeight: "700",
    textAlign: "center",
    lineHeight: s(26),
    paddingHorizontal: s(8),
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
