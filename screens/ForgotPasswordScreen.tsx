import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { s } from "../src/ui/ts";
import { requestPasswordReset } from "../src/services/passwordReset";
import { useDeviceClass, CONTENT_MAX_WIDTH, TABLET_GUTTER, PHONE_GUTTER } from "../src/ui/responsive";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../src/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const { isTablet } = useDeviceClass();
  const pad = isTablet ? TABLET_GUTTER : PHONE_GUTTER;

  const handleSubmit = async () => {
    setEmailError("");
    setSuccessMessage("");

    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSuccessMessage(
        "If an account exists with this email, you'll receive a password reset link shortly. Please check your inbox — and don't forget to check your spam or junk folder."
      );
      setEmail(""); // Clear the input
    } catch (error: any) {
      // Map Firebase error codes to user-friendly messages
      const errorCode = error.code || error.message;

      if (errorCode === "auth/invalid-email" || errorCode === "INVALID_EMAIL") {
        setEmailError("Please enter a valid email address");
      } else if (errorCode === "auth/too-many-requests") {
        setEmailError("Too many requests. Please try again later");
      } else {
        setEmailError("An error occurred. Please try again");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View
          style={[
            styles.contentColumn,
            isTablet && { maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
            { paddingHorizontal: pad },
          ]}
        >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="arrow-back" size={s(24)} color="#0A1630" />
          </Pressable>
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you a link to reset your
            password
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {successMessage ? (
            <View style={styles.successContainer}>
              <Ionicons
                name="checkmark-circle"
                size={s(64)}
                color="#22C55E"
                style={styles.successIcon}
              />
              <Text style={styles.successMessage}>{successMessage}</Text>
              <Pressable
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [
                  styles.backToLoginButton,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.backToLoginText}>Back to Login</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, emailError && styles.inputError]}
                  placeholder="your.email@example.com"
                  placeholderTextColor="#8B92A8"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setEmailError("");
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                {emailError ? (
                  <Text style={styles.errorText}>{emailError}</Text>
                ) : null}
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={({ pressed }) => [
                  styles.button,
                  { opacity: pressed || loading ? 0.8 : 1 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Email</Text>
                )}
              </Pressable>
            </>
          )}
        </View>{/* form */}
        </View>{/* contentColumn */}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6F2",
  },
  keyboardView: {
    flex: 1,
    // paddingHorizontal moved to contentColumn
  },
  contentColumn: {
    flex: 1,
    width: "100%",
  },
  header: {
    marginTop: s(20),
    marginBottom: s(40),
  },
  backButton: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: s(24),
  },
  title: {
    fontSize: s(32),
    fontWeight: "900",
    color: "#0A1630",
    marginBottom: s(8),
  },
  subtitle: {
    fontSize: s(16),
    color: "#5C6680",
    fontWeight: "600",
    lineHeight: s(24),
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: s(24),
  },
  label: {
    fontSize: s(14),
    fontWeight: "800",
    color: "#0A1630",
    marginBottom: s(8),
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: s(16),
    paddingHorizontal: s(16),
    paddingVertical: s(16),
    fontSize: s(16),
    color: "#0A1630",
    borderWidth: s(2),
    borderColor: "#E8EBF0",
    fontWeight: "600",
  },
  inputError: {
    borderColor: "#F43F5E",
  },
  errorText: {
    color: "#F43F5E",
    fontSize: s(12),
    fontWeight: "700",
    marginTop: s(6),
    marginLeft: s(4),
  },
  button: {
    backgroundColor: "#1C7ED6",
    borderRadius: s(16),
    paddingVertical: s(18),
    alignItems: "center",
    marginTop: s(12),
  },
  buttonText: {
    color: "#fff",
    fontSize: s(16),
    fontWeight: "900",
  },
  successContainer: {
    alignItems: "center",
    paddingTop: s(40),
  },
  successIcon: {
    marginBottom: s(24),
  },
  successMessage: {
    fontSize: s(16),
    color: "#0A1630",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: s(24),
    marginBottom: s(32),
    paddingHorizontal: s(16),
  },
  backToLoginButton: {
    backgroundColor: "#1C7ED6",
    borderRadius: s(16),
    paddingVertical: s(18),
    paddingHorizontal: s(32),
    alignItems: "center",
  },
  backToLoginText: {
    color: "#fff",
    fontSize: s(16),
    fontWeight: "900",
  },
});
