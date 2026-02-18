import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { s } from "react-native-size-matters";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../src/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "Q3FocusScreen">;

type OptionKey =
  | "pomodoro"
  | "deep"
  | "white"
  | "music"
  | "tracking"
  | "nodistraction"
  | "split";

const ACCENT = "#FFFFFF";
const BG = "#1055BF";
const CARD = "#0f3f87";

const Q3FocusScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();

  const [selected, setSelected] = useState<Set<OptionKey>>(new Set());


  const onNavigateToQ4 = () => {
    const setupData = route.params?.setup ?? {};

    navigation.navigate("Q4QuoteScreen", { setup: setupData });
  };

  const pop = useRef(new Animated.Value(1)).current;
  const animatePop = () => {
    pop.setValue(0.96);
    Animated.timing(pop, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const options = useMemo(
    () => [
      { key: "pomodoro" as const, label: "Pomodoro (25 min focus / 5 min break)" },
      { key: "deep" as const, label: "Deep work blocks (90 min or more)" },
      { key: "white" as const, label: "White noise or brown noise" },
      { key: "music" as const, label: "Music (lo-fi, instrumental, etc.)" },
      { key: "tracking" as const, label: "Progress tracking (streaks, checklists, metrics)" },
      { key: "nodistraction" as const, label: "A distraction-free physical + digital setup" },
      { key: "split" as const, label: "Breaking work into smaller tasks" },
    ],
    []
  );

  const toggle = (key: OptionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    animatePop();
  };

  const canContinue = selected.size > 0;

  return (
    <View style={styles.container}>
      {/* Fixed progress */}
      <View style={[styles.progressFixed, { top: insets.top + s(12) }]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "60%" }]} />
        </View>
        <Text style={styles.progressText}>3 of 5</Text>
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + s(70) }]}>
        <Text style={styles.question}>What helps you get into a focused “flow” state?</Text>
        <Text style={styles.sub}>Select all that apply.</Text>

        {/* Scrollable options box ONLY */}
        <View style={styles.optionsBox}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.optionsContent}
          >
            {options.map((opt) => {
              const isSelected = selected.has(opt.key);

              return (
                <TouchableOpacity
                  key={opt.key}
                  activeOpacity={0.9}
                  onPress={() => toggle(opt.key)}
                  style={[styles.card, isSelected && styles.cardSelected]}
                >
                  <Text style={styles.cardText}>{opt.label}</Text>

                  <View style={[styles.checkWrap, isSelected && styles.checkWrapSelected]}>
                    {isSelected ? (
                      <Animated.View style={{ transform: [{ scale: pop }] }}>
                        <Feather name="check" size={18} color={BG} />
                      </Animated.View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Fixed Next */}
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.nextFixed,
          { bottom: insets.bottom + s(16) },
          !canContinue && styles.nextDisabled,
        ]}
        disabled={!canContinue}
        onPress={onNavigateToQ4}
      >
        <Text style={styles.nextText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
};

export default Q3FocusScreen;

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
    backgroundColor: "#0c4191",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: s(999),
  },
  progressText: {
    marginTop: s(8),
    textAlign: "right",
    color: "rgba(244,246,242,0.8)",
    fontSize: s(12),
  },

  content: {
    flex: 1,
  },

  question: {
    color: "#FFFFFF",
    fontSize: s(24),
    fontWeight: "800",
  },
  sub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: s(12),
    marginTop: s(8),
    marginBottom: s(12),
  },

  optionsBox: {
    height: s(300),
    borderRadius: s(16),
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.10)",
    padding: s(10),
  },
  optionsContent: {
    gap: s(10),
    paddingBottom: s(6),
  },

  card: {
    minHeight: s(56),
    borderRadius: s(14),
    backgroundColor: CARD,
    paddingHorizontal: s(14),
    paddingVertical: s(14),
    flexDirection: "row",
    alignItems: "center",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.10)",
  },
  cardSelected: {
    borderColor: ACCENT,
    borderWidth: s(2),
  },
  cardText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: s(14),
    fontWeight: "600",
    paddingRight: s(10),
  },

  checkWrap: {
    height: s(26),
    width: s(26),
    borderRadius: s(13),
    borderWidth: s(2),
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkWrapSelected: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },

  nextFixed: {
    position: "absolute",
    left: s(20),
    right: s(20),
    height: s(48),
    borderRadius: s(14),
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  nextDisabled: { opacity: 0.4 },
  nextText: {
    color: "#002640",
    fontSize: s(18),
    fontWeight: "700",
  },
});
