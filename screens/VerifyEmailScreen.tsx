// screens/VerifyEmailScreen.tsx
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { s } from "react-native-size-matters";

import { auth } from "../src/services/firebase";
import { reloadAndCheckVerified, sendVerificationEmail } from "../src/services/emailVerification";
import { clearUserData } from "../src/data/storage";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../src/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "VerifyEmail">;

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const afterVerifyRoute = route.params?.afterVerifyRoute ?? "MainTabs";
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sent, setSent] = useState(false);

  const user = auth.currentUser;

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    try {
      await sendVerificationEmail(user);
      setSent(true);
      Alert.alert("Email sent", `A verification link has been sent to ${user.email ?? "your email"}.`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not send email. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerified = async () => {
    if (!user) return;
    setChecking(true);
    try {
      const verified = await reloadAndCheckVerified(user);
      if (verified) {
        navigation.reset({ index: 0, routes: [{ name: afterVerifyRoute as any }] });
      } else {
        Alert.alert(
          "Not verified yet",
          "We could not confirm your email. Please click the link in the email we sent you, then tap this button again."
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not check verification status.");
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Log out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          try {
            await clearUserData();
            await auth.signOut();
            navigation.reset({ index: 0, routes: [{ name: "SignIn" }] });
          } catch {
            Alert.alert("Error", "Failed to log out. Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Icon */}
        <View style={styles.iconWrap}>
          <Ionicons name="mail-unread-outline" size={s(48)} color="#1C7ED6" />
        </View>

        {/* Text */}
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          {"We sent a verification link to\n"}
          <Text style={styles.email}>{user?.email ?? "your email address"}</Text>
          {"\n\nClick the link in the email, then tap \u201cI\u2019ve verified\u201d below."}
        </Text>

        {/* Primary CTA */}
        <Pressable
          onPress={handleCheckVerified}
          disabled={checking}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            { opacity: pressed || checking ? 0.8 : 1 },
          ]}
        >
          {checking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={s(18)} color="#fff" />
              <Text style={[styles.btnText, { color: "#fff" }]}>I've verified</Text>
            </>
          )}
        </Pressable>

        {/* Resend */}
        <Pressable
          onPress={handleResend}
          disabled={resending}
          style={({ pressed }) => [
            styles.btn,
            styles.btnSecondary,
            { opacity: pressed || resending ? 0.8 : 1 },
          ]}
        >
          {resending ? (
            <ActivityIndicator size="small" color="#1C7ED6" />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={s(18)} color="#1C7ED6" />
              <Text style={[styles.btnText, { color: "#1C7ED6" }]}>
                {sent ? "Resend email" : "Resend verification email"}
              </Text>
            </>
          )}
        </Pressable>

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="log-out-outline" size={s(16)} color="#8B92A8" />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0A1630",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s(32),
    gap: s(16),
  },
  iconWrap: {
    width: s(88),
    height: s(88),
    borderRadius: s(28),
    backgroundColor: "#1C7ED622",
    borderWidth: s(1.5),
    borderColor: "#1C7ED644",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: s(8),
  },
  title: {
    fontSize: s(24),
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: s(14),
    fontWeight: "600",
    color: "#8B92A8",
    textAlign: "center",
    lineHeight: s(22),
    marginBottom: s(8),
  },
  email: {
    color: "#fff",
    fontWeight: "800",
  },
  btn: {
    width: "100%",
    height: s(52),
    borderRadius: s(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(8),
  },
  btnPrimary: {
    backgroundColor: "#1C7ED6",
  },
  btnSecondary: {
    backgroundColor: "#1C7ED614",
    borderWidth: s(1),
    borderColor: "#1C7ED644",
  },
  btnText: {
    fontSize: s(15),
    fontWeight: "800",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
    marginTop: s(8),
    paddingVertical: s(8),
    paddingHorizontal: s(12),
  },
  logoutText: {
    color: "#8B92A8",
    fontSize: s(13),
    fontWeight: "700",
  },
});
