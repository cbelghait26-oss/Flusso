import React, { useMemo, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { s } from "../../src/ui/ts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../src/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { saveSetupName, saveSetupComplete, saveSetupData, getCurrentUser } from "../../src/data/storage";
import { CommonActions } from "@react-navigation/native";
import { useDeviceClass, CONTENT_MAX_WIDTH } from "../../src/ui/responsive";


type Props = NativeStackScreenProps<RootStackParamList, "Q5TargetScreen">;

type TargetLevel = "casual" | "regular" | "serious" | "determined";

const ACCENT = "#FFFFFF";
const BG = "#03045E";
const ROW_BG = "#0f3f87";

const Q5TargetScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { isTablet } = useDeviceClass();

  const [selected, setSelected] = useState<TargetLevel | null>(
    route.params?.setup?.targetLevel ?? null
  );

  const options = useMemo(
    () => [
      { level: "casual" as const, label: "Casual", minutes: 30, right: "30 min/day" },
      { level: "regular" as const, label: "Regular", minutes: 60, right: "60 min/day" },
      { level: "serious" as const, label: "Serious", minutes: 120, right: "120 min/day" },
      { level: "determined" as const, label: "Determined", minutes: 180, right: "180 min/day" },
    ],
    []
  );

  const onFinish = async () => {
    if (!selected) return;

    const picked = options.find((o) => o.level === selected)!;

    const nextSetup = {
      ...(route.params?.setup ?? {}),
      targetLevel: picked.level,
      targetMinutesPerDay: picked.minutes as 30 | 60 | 120 | 180,
    };

    try {
      
      // Ensure currentUserId is loaded in storage module
      const userId = await getCurrentUser();
      
      if (!userId) {
        console.error("Q5: No user ID found! Cannot save setup.");
        Alert.alert(
          "Error",
          "User session not found. Please sign in again.",
          [{ text: "OK" }]
        );
        return;
      }
      
      // Save the user's name from setup
      if (nextSetup.name) {
        await saveSetupName(nextSetup.name);
      }
      
      // Save complete setup data to cloud for multi-device sync
      const setupWithCompletion = { ...nextSetup, setupComplete: true };
      await saveSetupData(setupWithCompletion);
      
      
      // Use getParent to navigate on the root stack
      const rootNavigation = navigation.getParent();
      if (rootNavigation) {
        rootNavigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "MainTabs", params: { setup: nextSetup } }],
          })
        );
      } else {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "MainTabs", params: { setup: nextSetup } }],
          })
        );
      }
      
    } catch (error) {
      console.error("Q5: Error completing setup:", error);
      Alert.alert(
        "Setup Complete",
        "There was an issue navigating. Please restart the app.",
        [
          {
            text: "Try Again",
            onPress: () => {
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: "MainTabs", params: { setup: nextSetup } }],
                })
              );
            },
          },
        ]
      );
    }
  };

  return (
    <View style={styles.outerBg}>
      <LinearGradient colors={["#03045E", "#023E8A", "#0077B6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["transparent", "rgba(0,150,199,0.45)", "rgba(72,202,228,0.28)", "transparent"]} start={{ x: 1, y: 0.15 }} end={{ x: 0, y: 0.85 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(144,224,239,0.18)", "transparent", "rgba(0,96,199,0.22)"]} start={{ x: 0.6, y: 0 }} end={{ x: 0.1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View
        style={[
          styles.container,
          isTablet && { maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" as const, width: "100%" },
        ]}
      >
      {/* Fixed progress */}
      <View style={[styles.progressFixed, { top: insets.top + s(12) }]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "100%" }]} />
        </View>
        <Text style={styles.progressText}>5 of 5</Text>
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + s(70) }]}>
        <Text style={styles.question}>Set your daily focus target</Text>
        <Text style={styles.sub}>Choose what you can commit to consistently.</Text>

        <View style={styles.list}>
          {options.map((opt, idx) => {
            const isSelected = selected === opt.level;

            return (
              <TouchableOpacity
                key={opt.level}
                style={[styles.row, idx === 0 && styles.rowFirst]}
                activeOpacity={0.85}
                onPress={() => setSelected(opt.level)}
              >
                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected ? <View style={styles.radioInner} /> : null}
                </View>

                <Text style={styles.rowLabel}>{opt.label}</Text>
                <Text style={styles.rowRight}>{opt.right}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Fixed Finish */}
      <TouchableOpacity
        style={[
          styles.nextFixed,
          { bottom: insets.bottom + s(16) },
          !selected && styles.nextDisabled,
        ]}
        disabled={!selected}
        activeOpacity={0.9}
        onPress={onFinish}
      >
        <Text style={styles.nextText}>Finish</Text>
      </TouchableOpacity>
      </View>{/* container */}
    </View>
  );
};

export default Q5TargetScreen;

const styles = StyleSheet.create({
  outerBg: {
    flex: 1,
    backgroundColor: BG,
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
    backgroundColor: "rgba(255,255,255,0.12)",
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
    marginTop: s(8),
    marginBottom: s(14),
    color: "rgba(255,255,255,0.65)",
    fontSize: s(12),
  },

  list: {
    borderRadius: s(14),
    backgroundColor: ROW_BG,
    overflow: "hidden",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.10)",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(14),
    paddingVertical: s(14),
    borderTopWidth: s(1),
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  rowFirst: { borderTopWidth: s(0) },

  radioOuter: {
    height: s(18),
    width: s(18),
    borderRadius: s(9),
    borderWidth: s(2),
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: s(12),
  },
  radioOuterSelected: { borderColor: ACCENT },
  radioInner: {
    height: s(10),
    width: s(10),
    borderRadius: s(5),
    backgroundColor: ACCENT,
  },

  rowLabel: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: s(14),
    fontWeight: "800",
  },
  rowRight: {
    color: "rgba(255,255,255,0.55)",
    fontSize: s(12),
  },

  nextFixed: {
    position: "absolute",
    left: s(20),
    right: s(20),
    height: s(48),
    borderRadius: s(14),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
  },
  nextDisabled: { opacity: 0.4 },
  nextText: { color: "#002640", fontSize: s(18), fontWeight: "700" },
});
