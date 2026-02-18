import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";
import { s } from "react-native-size-matters";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../src/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "Q4QuoteScreen">;

const BG = "#1055BF";
const INK = "#F4F6F2";

const Q4QuoteScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(10)).current;
  const ripple = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(ripple, {
            toValue: 0.55,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ripple, {
            toValue: 0.25,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();
  }, [fade, rise, ripple]);

  return (
    <View style={styles.container}>
      {/* Fixed progress (same anchor across screens) */}
      <View style={[styles.progressFixed, { top: insets.top + s(12) }]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "80%" }]} />
        </View>
        <Text style={styles.progressText}>4 of 5</Text>
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + s(70) }]}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <View style={styles.quoteWrap}>
            <Text style={styles.kicker}>Daily routines</Text>

            <Text style={styles.quote}>
              “You’ll never change your life until you change something you do daily.”
            </Text>

            <View style={styles.accentLine} />

            <Text style={styles.author}>— John C. Maxwell</Text>
          </View>

          <Text style={styles.lead}>Let’s define what “daily” means for you 🫵.</Text>
        </Animated.View>
      </View>

      {/* Fixed Next (same anchor across screens) */}
      <TouchableOpacity
        style={[styles.ctaFixed, { bottom: insets.bottom + s(16) }]}
        activeOpacity={0.9}
        onPress={() =>
          navigation.navigate("Q5TargetScreen", { setup: route.params?.setup ?? {} })
        }
      >
        <Text style={styles.ctaText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
};

export default Q4QuoteScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    backgroundColor: BG,
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
    backgroundColor: "rgba(244,246,242,0.25)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: INK, borderRadius: s(999) },
  progressText: {
    marginTop: s(8),
    textAlign: "right",
    color: "rgba(244,246,242,0.75)",
    fontSize: s(12),
  },

  content: {
    flex: 1,
  },

  quoteWrap: {
    borderRadius: s(20),
    paddingVertical: s(18),
    paddingHorizontal: s(18),
    backgroundColor: "rgba(0,0,0,0.14)",
    borderWidth: s(1),
    borderColor: "rgba(244,246,242,0.20)",
  },

  kicker: {
    color: "rgba(244,246,242,0.8)",
    fontSize: s(12),
    fontWeight: "900",
    letterSpacing: s(1),
    textTransform: "uppercase",
    marginBottom: s(10),
  },

  quote: {
    color: INK,
    fontSize: s(20),
    fontWeight: "900",
    lineHeight: s(26),
  },

  accentLine: {
    marginTop: s(14),
    width: s(56),
    height: s(4),
    borderRadius: s(999),
    backgroundColor: "rgba(244,246,242,0.95)",
  },

  author: {
    marginTop: s(10),
    color: "rgba(244,246,242,0.75)",
    fontSize: s(13),
    fontWeight: "800",
  },

  lead: {
    marginTop: s(16),
    color: "rgba(244,246,242,0.9)",
    fontSize: s(20),
    fontWeight: "600",
  },

  // kept for your current setup (even if not used directly)
  rippleBar: {
    position: "absolute",
    left: s(12),
    right: s(12),
    top: s(22),
    height: s(14),
    borderRadius: s(999),
    backgroundColor: "rgba(244,246,242,0.35)",
  },

  ctaFixed: {
    position: "absolute",
    left: s(20),
    right: s(20),
    height: s(48),
    borderRadius: s(14),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: INK,
  },
  ctaText: {
    color: "#002640",
    fontSize: s(18),
    fontWeight: "700",
  },
});
