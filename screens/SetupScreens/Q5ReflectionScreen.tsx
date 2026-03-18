import React, { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { s } from "../../src/ui/ts";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../src/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDeviceClass, CONTENT_MAX_WIDTH } from "../../src/ui/responsive";

type Props = NativeStackScreenProps<RootStackParamList, "Q5ReflectionScreen">;

const OPTIONS = [
  "Clear priorities",
  "Time blocks for deep work",
  "Visible progress",
  "A quiet environment",
  "A strong goal or purpose",
] as const;

type Option = typeof OPTIONS[number];

const Q5ReflectionScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { isTablet } = useDeviceClass();

  const [selected, setSelected] = useState<Option[]>([]);
  const screenSlide = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.timing(screenSlide, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, []);

  const onSelect = (option: Option) => {
    setSelected(prev => prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]);
  };

  const onContinue = () => {
    if (selected.length === 0) return;
    navigation.navigate("Q6DirectedFocusScreen", {
      setup: { ...(route.params?.setup ?? {}), focusSelection: [...selected] },
    });
  };

  return (
    <View style={styles.outerBg}>
      <LinearGradient colors={["#0A0018", "#1A0038", "#2C0058"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["transparent", "rgba(150,0,220,0.24)", "rgba(180,40,240,0.14)", "transparent"]} start={{ x: 1, y: 0.1 }} end={{ x: 0, y: 0.9 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(200,60,255,0.08)", "transparent", "rgba(120,0,210,0.12)"]} start={{ x: 0.7, y: 0 }} end={{ x: 0.08, y: 1 }} style={StyleSheet.absoluteFill} />

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: screenSlide }] }]}>
      <View style={[styles.container, isTablet && { maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" as const, width: "100%" }]}>
        <View style={[styles.progressFixed, { top: insets.top + s(12) }]}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "55%" }]} />
          </View>
        </View>

        <View style={[styles.content, { paddingTop: insets.top + s(46) }]}>
          <Text style={styles.question}>When focus works best for you, what usually helps?</Text>
          <View style={styles.list}>
            {OPTIONS.map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <TouchableOpacity
                  key={opt}
                  activeOpacity={0.88}
                  onPress={() => onSelect(opt)}
                  style={[styles.card, isSelected && styles.cardSelected]}
                >
                  <Text style={styles.cardText}>{opt}</Text>
                  <View style={[styles.checkWrap, isSelected && styles.checkWrapSelected]}>
                    {isSelected && <Feather name="check" size={s(14)} color="#120840" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.ctaFixed, { bottom: insets.bottom + s(16) }, selected.length === 0 && styles.ctaDisabled]}
          disabled={selected.length === 0}
          activeOpacity={0.9}
          onPress={onContinue}
        >
          <Text style={styles.ctaText}>Continue</Text>
        </TouchableOpacity>
      </View>
      </Animated.View>
    </View>
  );
};

export default Q5ReflectionScreen;

const styles = StyleSheet.create({
  outerBg: { flex: 1, backgroundColor: "#000612" },
  container: { flex: 1, position: "relative", paddingHorizontal: s(20), paddingBottom: s(90) },
  progressFixed: { position: "absolute", left: s(20), right: s(20) },
  progressTrack: { height: s(4), borderRadius: s(999), backgroundColor: "rgba(160,120,255,0.20)", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "rgba(200,160,255,0.65)", borderRadius: s(999) },
  content: { flex: 1 },
  question: { color: "#F4F6F2", fontSize: s(24), fontWeight: "800", marginBottom: s(20), lineHeight: s(32) },
  list: { gap: s(12) },
  card: {
    minHeight: s(54), borderRadius: s(14), backgroundColor: "rgba(110,60,200,0.22)",
    paddingHorizontal: s(16), paddingVertical: s(14), flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: "rgba(180,140,255,0.20)",
  },
  cardSelected: { borderColor: "rgba(210,180,255,0.85)", borderWidth: 2, backgroundColor: "rgba(150,100,255,0.28)" },
  cardText: { flex: 1, color: "#F4F6F2", fontSize: s(15), fontWeight: "600", paddingRight: s(8) },
  checkWrap: { height: s(26), width: s(26), borderRadius: s(13), borderWidth: 2, borderColor: "rgba(200,160,255,0.35)", alignItems: "center", justifyContent: "center" },
  checkWrapSelected: { borderColor: "#F4F6F2", backgroundColor: "#F4F6F2" },
  ctaFixed: { position: "absolute", left: s(20), right: s(20), height: s(48), borderRadius: s(14), backgroundColor: "#F4F6F2", alignItems: "center", justifyContent: "center" },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: "#120840", fontSize: s(18), fontWeight: "700" },
});
