import React, { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
} from "react-native";
import { s } from "../../src/ui/ts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../src/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDeviceClass, CONTENT_MAX_WIDTH } from "../../src/ui/responsive";
import { saveSetupName, saveSetupComplete, saveSetupData, getCurrentUser } from "../../src/data/storage";
import { ensureUserProfile } from "../../src/services/SocialService";
import { auth } from "../../src/services/firebase";
import { CommonActions } from "@react-navigation/native";

type Props = NativeStackScreenProps<RootStackParamList, "Q9ClosingScreen">;

const Q9ClosingScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { isTablet } = useDeviceClass();

  const setup = route.params?.setup ?? {};
  const name = setup.name ?? "you";
  const focusMinutes = setup.focusMinutes ?? 30;

  const [displayCount, setDisplayCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const countAnim = useRef(new Animated.Value(0)).current;
  const prepBarProgress = useRef(new Animated.Value(0)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleRise = useRef(new Animated.Value(12)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.88)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const line1Opacity = useRef(new Animated.Value(0)).current;
  const line1Rise = useRef(new Animated.Value(6)).current;
  const line2Opacity = useRef(new Animated.Value(0)).current;
  const line2Rise = useRef(new Animated.Value(6)).current;
  const line3Opacity = useRef(new Animated.Value(0)).current;
  const line3Rise = useRef(new Animated.Value(6)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const screenFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const listenerId = countAnim.addListener(({ value }) => {
      setDisplayCount(Math.round(value));
    });

    // Count-up starts when card appears (~520ms after sequence begins)
    const countTimer = setTimeout(() => {
      Animated.timing(countAnim, {
        toValue: focusMinutes,
        duration: 650,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    }, 520);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(titleRise, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.timing(subOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.delay(220),
      Animated.parallel([
        Animated.timing(line1Opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(line1Rise, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(line2Opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(line2Rise, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(line3Opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(line3Rise, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(240),
      Animated.timing(ctaOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();

    return () => {
      clearTimeout(countTimer);
      countAnim.removeListener(listenerId);
    };
  }, []);

  const onPress = () => {
    if (loading) return;
    setLoading(true);

    Animated.timing(prepBarProgress, {
      toValue: 1,
      duration: 1100,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start(() => {
      Animated.timing(screenFade, { toValue: 0, duration: 340, useNativeDriver: true }).start(async () => {
        try {
          const userId = await getCurrentUser();
          if (userId) {
            const persistPayload = {
              ...setup,
              targetMinutesPerDay: setup.focusMinutes ?? 30,
              setupComplete: true,
            };
            if (setup.name) {
              await saveSetupName(setup.name);
              if (auth.currentUser) {
                ensureUserProfile(setup.name, null).catch(() => {});
              }
            }
            await saveSetupData(persistPayload);
          }
          const rootNavigation = navigation.getParent();
          const target = rootNavigation ?? navigation;
          target.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "MainTabs", params: { setup } }],
            })
          );
        } catch (error) {
          console.error("Q9: Error completing setup:", error);
          setLoading(false);
          Alert.alert(
            "Setup Complete",
            "There was an issue navigating. Please restart the app.",
            [{
              text: "Try Again",
              onPress: () => {
                const rootNavigation = navigation.getParent();
                const target = rootNavigation ?? navigation;
                target.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: "MainTabs", params: { setup } }],
                  })
                );
              },
            }]
          );
        }
      });
    });
  };

  const countLabel = focusMinutes === 120 && displayCount >= 120 ? "120+" : String(displayCount);

  return (
    <View style={styles.outerBg}>
      <LinearGradient colors={["#050010", "#0C0028", "#180048"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["transparent", "rgba(100,0,200,0.20)", "rgba(140,40,220,0.12)", "transparent"]} start={{ x: 1, y: 0.1 }} end={{ x: 0, y: 0.9 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(160,60,255,0.08)", "transparent", "rgba(80,0,180,0.12)"]} start={{ x: 0.65, y: 0 }} end={{ x: 0.08, y: 1 }} style={StyleSheet.absoluteFill} />

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: screenFade }]}>
      <View style={[
        styles.container,
        isTablet && { maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" as const, width: "100%" },
      ]}>
        <View style={[styles.content, { paddingTop: insets.top + s(52) }]}>

          {/* Headline */}
          <Animated.Text style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleRise }] }]}>
            {name}, imagine protecting{"\n"}{focusMinutes === 120 ? "120+" : focusMinutes} minutes every day.
          </Animated.Text>

          {/* Focus card with count-up */}
          <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
            <Text style={styles.cardLabel}>DAILY FOCUS</Text>
            <Text style={styles.cardCount}>{countLabel}</Text>
            <Text style={styles.cardUnit}>minutes</Text>
            <Animated.Text style={[styles.cardSub, { opacity: subOpacity }]}>
              Dedicated time for meaningful progress.
            </Animated.Text>
          </Animated.View>

          {/* Emotional support lines */}
          <View style={styles.supportBlock}>
            <Animated.Text style={[styles.supportLine, { opacity: line1Opacity, transform: [{ translateY: line1Rise }] }]}>
              Your Goals.
            </Animated.Text>
            <Animated.Text style={[styles.supportLine, { opacity: line2Opacity, transform: [{ translateY: line2Rise }] }]}>
              Your Time.
            </Animated.Text>
            <Animated.Text style={[styles.supportLine, { opacity: line3Opacity, transform: [{ translateY: line3Rise }] }]}>
              Your progress.
            </Animated.Text>
          </View>
        </View>

        {/* CTA */}
        <Animated.View style={[styles.ctaWrap, { bottom: insets.bottom + s(16), opacity: ctaOpacity }]}>
          <TouchableOpacity
            style={styles.cta}
            activeOpacity={0.9}
            onPress={onPress}
            disabled={loading}
          >
            {loading && (
              <Animated.View
                style={[
                  styles.prepBar,
                  { width: prepBarProgress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
                ]}
              />
            )}
            <Text style={[styles.ctaText, loading && styles.ctaTextLoading]}>
              {loading ? "Preparing your focus system..." : "Start my focus system"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
      </Animated.View>
    </View>
  );
};

export default Q9ClosingScreen;

const styles = StyleSheet.create({
  outerBg: { flex: 1, backgroundColor: "#000612" },
  container: {
    flex: 1,
    position: "relative",
    paddingHorizontal: s(20),
    paddingBottom: s(90),
  },

  content: { flex: 1 },

  title: {
    color: "#F4F6F2",
    fontSize: s(26),
    fontWeight: "800",
    lineHeight: s(34),
    marginBottom: s(28),
  },

  card: {
    borderRadius: s(18),
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: s(24),
    paddingTop: s(20),
    paddingBottom: s(20),
    marginBottom: s(28),
    alignItems: "center",
  },
  cardLabel: {
    color: "rgba(244,246,242,0.45)",
    fontSize: s(10),
    fontWeight: "800",
    letterSpacing: s(1.5),
    textTransform: "uppercase",
    marginBottom: s(8),
  },
  cardCount: {
    color: "#F4F6F2",
    fontSize: s(64),
    fontWeight: "900",
    lineHeight: s(72),
  },
  cardUnit: {
    color: "rgba(244,246,242,0.55)",
    fontSize: s(14),
    fontWeight: "600",
    marginTop: -s(4),
    marginBottom: s(16),
    letterSpacing: s(0.5),
  },
  cardSub: {
    color: "rgba(244,246,242,0.60)",
    fontSize: s(13),
    textAlign: "center",
    lineHeight: s(18),
  },

  supportBlock: {
    gap: s(6),
  },
  supportLine: {
    color: "#F4F6F2",
    fontSize: s(20),
    fontWeight: "700",
    lineHeight: s(28),
  },

  ctaWrap: {
    position: "absolute",
    left: s(20),
    right: s(20),
  },
  cta: {
    height: s(52),
    borderRadius: s(14),
    backgroundColor: "#F4F6F2",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  prepBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,38,64,0.12)",
  },
  ctaText: {
    color: "#002640",
    fontSize: s(18),
    fontWeight: "700",
  },
  ctaTextLoading: {
    fontSize: s(14),
    fontWeight: "600",
  },
});
