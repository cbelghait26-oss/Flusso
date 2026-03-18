import React, { useMemo, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { s } from "../../src/ui/ts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../src/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDeviceClass, CONTENT_MAX_WIDTH } from "../../src/ui/responsive";

type Props = NativeStackScreenProps<RootStackParamList, "Q1NameScreen">;

const Q1NameScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { isTablet } = useDeviceClass();

  const [name, setName] = useState(route.params?.setup?.name ?? "");
  const [transitioning, setTransitioning] = useState(false);

  const canContinue = useMemo(() => name.trim().length >= 2, [name]);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const transitionTextOpacity = useRef(new Animated.Value(0)).current;
  const transitionTextRise = useRef(new Animated.Value(12)).current;
  const formOpacity = useRef(new Animated.Value(1)).current;

  const onContinue = () => {
    if (!canContinue || transitioning) return;
    const trimmed = name.trim();
    setTransitioning(true);

    Animated.timing(formOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(transitionTextOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(transitionTextRise, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          navigation.navigate("Q2MovementScreen", {
            setup: { ...(route.params?.setup ?? {}), name: trimmed },
          });
        }, 900);
      });
    });
  };

  const displayName = name.trim() || "you";

  return (
    <View style={styles.outerBg}>
      <LinearGradient colors={["#000612", "#010E48", "#052480"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["transparent", "rgba(0,90,200,0.48)", "rgba(30,150,230,0.30)", "transparent"]} start={{ x: 1, y: 0.15 }} end={{ x: 0, y: 0.85 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(60,160,255,0.20)", "transparent", "rgba(0,50,200,0.26)"]} start={{ x: 0.6, y: 0 }} end={{ x: 0.1, y: 1 }} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView
        style={[
          styles.container,
          isTablet && { maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" as const, width: "100%" },
        ]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.progressFixed, { top: insets.top + s(12) }]}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "11%" }]} />
          </View>
          <Text style={styles.progressText}>1 of 9</Text>
        </View>

        <Animated.View style={[styles.content, { paddingTop: insets.top + s(70) }, { opacity: formOpacity }]}>
          <Text style={styles.title}>What's your name?</Text>
          <Text style={styles.sub}>This will personalize your experience and can be changed later.</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor="rgba(244,246,242,0.5)"
            style={styles.input}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={onContinue}
            editable={!transitioning}
          />
        </Animated.View>

        <Animated.View style={[styles.ctaWrap, { bottom: insets.bottom + s(16), opacity: formOpacity }]}>
          <TouchableOpacity
            style={[styles.ctaFixed, !canContinue && styles.ctaDisabled]}
            onPress={onContinue}
            disabled={!canContinue || transitioning}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Next</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>

      <Animated.View style={[styles.transitionOverlay, { opacity: overlayOpacity }]} pointerEvents="none">
        <Animated.Text
          style={[
            styles.transitionText,
            {
              opacity: transitionTextOpacity,
              transform: [{ translateY: transitionTextRise }],
            },
          ]}
        >
          Alright {displayName}. Let us look at your focus.
        </Animated.Text>
      </Animated.View>
    </View>
  );
};

export default Q1NameScreen;

const styles = StyleSheet.create({
  outerBg: {
    flex: 1,
    backgroundColor: "#000612",
  },
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
    color: "rgba(244,246,242,0.8)",
    fontSize: s(12),
    textAlign: "right",
  },
  content: {
    flex: 1,
  },
  title: {
    color: "#F4F6F2",
    fontSize: s(28),
    fontWeight: "700",
    marginBottom: s(8),
  },
  sub: {
    color: "rgba(244,246,242,0.6)",
    fontSize: s(13),
    marginBottom: s(20),
  },
  input: {
    height: s(52),
    borderRadius: s(14),
    paddingHorizontal: s(14),
    color: "#F4F6F2",
    backgroundColor: "rgba(255,255,255,0.10)",
    fontSize: s(16),
  },
  ctaWrap: {
    position: "absolute",
    left: s(20),
    right: s(20),
  },
  ctaFixed: {
    height: s(48),
    borderRadius: s(14),
    backgroundColor: "#F4F6F2",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    color: "#002640",
    fontSize: s(18),
    fontWeight: "700",
  },
  transitionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000612",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s(32),
  },
  transitionText: {
    color: "#F4F6F2",
    fontSize: s(24),
    fontWeight: "700",
    textAlign: "center",
    lineHeight: s(32),
  },
});
