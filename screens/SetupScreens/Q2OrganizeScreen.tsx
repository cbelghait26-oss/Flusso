import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";
import { s } from "react-native-size-matters";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../src/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "Q2OrganizeScreen">;

type OptionKey = "list" | "calendar" | "app" | "memory" | "other";

const Q2OrganizeScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();

  const [selected, setSelected] = useState<OptionKey | null>(null);



  const onNavigateToQ3 = () => {
    const setupData = route.params?.setup ?? {};
   
    navigation.navigate("Q3FocusScreen", { setup: setupData });
  };

  const checkScale = useRef(new Animated.Value(1)).current;
  const animateCheck = () => {
    checkScale.setValue(0.9);
    Animated.timing(checkScale, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const options = useMemo(
    () => [
      { key: "list" as const, label: "I make a to-do list on paper or in a digital note" },
      { key: "calendar" as const, label: "I create events in my calendar" },
      { key: "app" as const, label: "I use another productivity/management app" },
      { key: "memory" as const, label: "I rely on my memory" },
      { key: "other" as const, label: "Other" },
    ],
    []
  );

  const onSelect = (key: OptionKey) => {
    setSelected(key);
    animateCheck();
  };

  return (
    <View style={styles.container}>
      {/* Fixed progress */}
      <View style={[styles.progressFixed, { top: insets.top + s(12) }]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "40%" }]} />
        </View>
        <Text style={styles.progressText}>2 of 5</Text>
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + s(70) }]}>
        <Text style={styles.question}>How do you currently organize your tasks and time?</Text>
        <Text style={styles.sub}>Pick the option you use most often.</Text>

        <View style={styles.list}>
          {options.map((opt) => {
            const isSelected = selected === opt.key;

            return (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.9}
                onPress={() => onSelect(opt.key)}
                style={[styles.card, isSelected && styles.cardSelected]}
              >
                <Text style={styles.cardText}>{opt.label}</Text>

                <View style={[styles.checkWrap, isSelected && styles.checkWrapSelected]}>
                  {isSelected ? (
                    <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                      <Feather name="check" size={18} color="#0E0E0E" />
                    </Animated.View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Fixed Next */}
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.nextFixed,
          { bottom: insets.bottom + s(16) },
          !selected && styles.nextDisabled,
        ]}
        disabled={!selected}
        onPress={onNavigateToQ3}
      >
        <Text style={styles.nextText}>Next</Text>
      </TouchableOpacity>

    </View>
  );
};

export default Q2OrganizeScreen;

const ACCENT = "#FFFFFF";
const BG = "#1055BF";
const CARD = "#0f3f87";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    backgroundColor: BG,
    paddingHorizontal: s(20),
    paddingBottom: s(90), // space so content won't hide behind fixed button
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
    color: "#F4F6F2",
    fontSize: s(24),
    fontWeight: "800",
  },
  sub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: s(12),
    marginTop: s(8),
    marginBottom: s(16),
  },

  list: {
    gap: s(12),
  },

  card: {
    minHeight: s(58),
    borderRadius: s(14),
    backgroundColor: CARD,
    paddingHorizontal: s(14),
    paddingVertical: s(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    backgroundColor: "#F4F6F2",
    alignItems: "center",
    justifyContent: "center",
  },
  nextDisabled: { opacity: 0.4 },
  nextText: {
    color: "#002640",
    fontSize: s(18),
    fontWeight: "700",
  },
    backText: {
    marginTop: s(14),
    textAlign: "center",
    color: "rgba(244,246,242,0.8)",
    fontSize: s(13),
    textDecorationLine: "underline",
  },
});
