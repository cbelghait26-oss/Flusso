import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { s } from "react-native-size-matters";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../src/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "Q1NameScreen">;

const Q1NameScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(route.params?.setup?.name ?? "");
  const canContinue = useMemo(() => name.trim().length >= 2, [name]);

  const onContinue = () => {
    const setupData = {
      ...(route.params?.setup ?? {}),
      name: name.trim(),
    };
    
    navigation.navigate("Q2OrganizeScreen", { setup: setupData });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Fixed progress */}
      <View style={[styles.progressFixed, { top: insets.top + s(12) }]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "20%" }]} />
        </View>
        <Text style={styles.progressText}>1 of 5</Text>
      </View>

      {/* Content (kept away from fixed header + fixed button) */}
      <View style={[styles.content, { paddingTop: insets.top + s(70) }]}>
        <Text style={styles.title}>What’s your name?</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Type your name"
          placeholderTextColor="rgba(244,246,242,0.6)"
          style={styles.input}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
        />
      </View>

      {/* Fixed Next button (identical placement across screens) */}
      <TouchableOpacity
        style={[
          styles.ctaFixed,
          { bottom: insets.bottom + s(16) },
          !canContinue && styles.ctaDisabled,
        ]}
        onPress={onContinue}
        disabled={!canContinue}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaText}>Next</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

export default Q1NameScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    backgroundColor: "#1055BF",
    paddingHorizontal: s(20),
    // ensures your content never hides behind the fixed Next button
    paddingBottom: s(90),
  },

  // fixed header (progress)
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

  // main content area
  content: {
    flex: 1,
  },
  title: {
    color: "#F4F6F2",
    fontSize: s(28),
    fontWeight: "700",
    marginBottom: s(15),
  },
  input: {
    height: s(52),
    borderRadius: s(14),
    paddingHorizontal: s(14),
    color: "#F4F6F2",
    backgroundColor: "rgba(255,255,255,0.10)",
    fontSize: s(16),
  },

  // fixed next button
  ctaFixed: {
    position: "absolute",
    left: s(20),
    right: s(20),
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
});
