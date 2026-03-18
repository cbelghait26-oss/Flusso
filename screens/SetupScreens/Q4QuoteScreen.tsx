import React, { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { s } from "../../src/ui/ts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../src/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDeviceClass, CONTENT_MAX_WIDTH } from "../../src/ui/responsive";

type Props = NativeStackScreenProps<RootStackParamList, "Q4QuoteScreen">;
const INK = "#F4F6F2";

const Q4QuoteScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { isTablet } = useDeviceClass();

  const screenSlide = useRef(new Animated.Value(28)).current;
  const cardSlide   = useRef(new Animated.Value(32)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const supportOpacity = useRef(new Animated.Value(0)).current;
  const supportRise    = useRef(new Animated.Value(10)).current;
  const promptOpacity  = useRef(new Animated.Value(0)).current;
  const promptRise     = useRef(new Animated.Value(10)).current;
  const ctaOpacity     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenSlide, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(cardSlide,   { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(supportOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
            Animated.timing(supportRise,    { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]).start(() => {
            setTimeout(() => {
              Animated.parallel([
                Animated.timing(promptOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
                Animated.timing(promptRise,    { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              ]).start(() => {
                setTimeout(() => {
                  Animated.timing(ctaOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
                }, 400);
              });
            }, 650);
          });
        }, 650);
      });
    }, 200);
  }, []);

  const onContinue = () => {
    navigation.navigate("Q5ReflectionScreen", { setup: route.params?.setup ?? {} });
  };

  return (
    <View style={styles.outerBg}>
      <LinearGradient colors={["#0C0020", "#200048", "#360070"]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["transparent", "rgba(130,0,200,0.28)", "rgba(160,60,230,0.16)", "transparent"]} start={{ x: 1, y: 0.1 }} end={{ x: 0, y: 0.9 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(180,80,255,0.10)", "transparent", "rgba(100,0,180,0.14)"]} start={{ x: 0.7, y: 0 }} end={{ x: 0.08, y: 1 }} style={StyleSheet.absoluteFill} />

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: screenSlide }] }]}>
      <View style={[styles.container, isTablet && { maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" as const, width: "100%" }]}>
        <View style={[styles.progressFixed, { top: insets.top + s(12) }]}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "44%" }]} />
          </View>
        </View>

        <View style={[styles.content, { paddingTop: insets.top + s(46) }]}>
          <Animated.View style={[styles.quoteCard, { opacity: cardOpacity, transform: [{ translateY: cardSlide }] }]}>
            <Text style={styles.quote}>"You'll never change your life until you change something you do daily."</Text>
            <View style={styles.accentLine} />
            <Text style={styles.author}>— John C. Maxwell</Text>
          </Animated.View>

          <Animated.Text style={[styles.support, { opacity: supportOpacity, transform: [{ translateY: supportRise }] }]}>
            Daily actions shape long-term outcomes.
          </Animated.Text>

          <Animated.Text style={[styles.prompt, { opacity: promptOpacity, transform: [{ translateY: promptRise }] }]}>
            Let us define what consistent focus looks like for you.
          </Animated.Text>
        </View>

        <Animated.View style={[styles.ctaWrap, { bottom: insets.bottom + s(16), opacity: ctaOpacity }]}>
          <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={onContinue}>
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
      </Animated.View>
    </View>
  );
};

export default Q4QuoteScreen;

const styles = StyleSheet.create({
  outerBg: { flex: 1, backgroundColor: "#000612" },
  container: { flex: 1, position: "relative", paddingHorizontal: s(20), paddingBottom: s(90) },
  progressFixed: { position: "absolute", left: s(20), right: s(20) },
  progressTrack: { height: s(4), borderRadius: s(999), backgroundColor: "rgba(160,120,255,0.20)", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "rgba(200,160,255,0.70)", borderRadius: s(999) },
  content: { flex: 1, justifyContent: "flex-start", gap: s(20) },
  quoteCard: {
    borderRadius: s(20), paddingVertical: s(24), paddingHorizontal: s(22),
    backgroundColor: "rgba(100,40,255,0.10)", borderWidth: 1, borderColor: "rgba(180,140,255,0.22)",
  },
  quote: { color: INK, fontSize: s(20), fontWeight: "900", lineHeight: s(28) },
  accentLine: { marginTop: s(16), width: s(48), height: s(3), borderRadius: s(999), backgroundColor: "rgba(200,160,255,0.80)" },
  author: { marginTop: s(10), color: "rgba(244,246,242,0.55)", fontSize: s(13), fontWeight: "700" },
  support: { color: "rgba(244,246,242,0.88)", fontSize: s(16), fontWeight: "600" },
  prompt: { color: "rgba(244,246,242,0.55)", fontSize: s(14), fontWeight: "500", lineHeight: s(20) },
  ctaWrap: { position: "absolute", left: s(20), right: s(20) },
  cta: { height: s(48), borderRadius: s(14), backgroundColor: INK, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#0E0340", fontSize: s(18), fontWeight: "700" },
});
