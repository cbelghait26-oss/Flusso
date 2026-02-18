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
import { s } from "react-native-size-matters";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../src/services/firebase";
import { setCurrentUser } from "../src/data/storage";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../src/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "EmailLogin">;

export default function EmailLoginScreen({ navigation, route }: Props) {
  const isSignUp = route.params?.isSignUp ?? false;
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const handleSubmit = async () => {
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");

    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    if (!password.trim()) {
      setPasswordError("Password is required");
      return;
    }
    if (isSignUp && !confirmPassword.trim()) {
      setConfirmPasswordError("Please confirm your password");
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setCurrentUser(userCredential.user.uid);
        navigation.navigate("Q1NameScreen", { setup: {} });
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await setCurrentUser(userCredential.user.uid);
        navigation.navigate("MainTabs", { setup: {} });
      }
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        setEmailError("This email is already registered");
      } else if (error.code === "auth/invalid-email") {
        setEmailError("Invalid email address");
      } else if (error.code === "auth/user-not-found") {
        setEmailError("No account found with this email");
      } else if (error.code === "auth/wrong-password") {
        setPasswordError("Incorrect password");
      } else if (error.code === "auth/weak-password") {
        setPasswordError("Password should be at least 6 characters");
      } else if (error.code === "auth/invalid-credential") {
        setEmailError("Incorrect email or password");
        setPasswordError("Incorrect email or password");
      } else {
        setPasswordError("An error occurred. Please try again");
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
          <Text style={styles.title}>
            {isSignUp ? "Create Account" : "Welcome Back"}
          </Text>
          <Text style={styles.subtitle}>
            {isSignUp
              ? "Sign up to get started"
              : "Log in to continue to FlowApp"}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, passwordError && styles.inputError]}
              placeholder="Enter your password"
              placeholderTextColor="#8B92A8"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError("");
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {passwordError ? (
              <Text style={styles.errorText}>{passwordError}</Text>
            ) : null}
          </View>

          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={[styles.input, confirmPasswordError && styles.inputError]}
                placeholder="Re-enter your password"
                placeholderTextColor="#8B92A8"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setConfirmPasswordError("");
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              {confirmPasswordError ? (
                <Text style={styles.errorText}>{confirmPasswordError}</Text>
              ) : null}
            </View>
          )}

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
              <Text style={styles.buttonText}>
                {isSignUp ? "Sign Up" : "Log In"}
              </Text>
            )}
          </Pressable>

          {!isSignUp && (
            <Pressable
              onPress={() => {}}
              style={styles.forgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Switch Mode - Outside KeyboardAvoidingView */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {isSignUp ? "Already have an account? " : "Don't have an account? "}
        </Text>
        <Pressable
          onPress={() =>
            navigation.navigate("EmailLogin", { isSignUp: !isSignUp })
          }
        >
          <Text style={styles.footerLink}>
            {isSignUp ? "Log In" : "Sign Up"}
          </Text>
        </Pressable>
      </View>
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
    paddingHorizontal: s(24),
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
  forgotPassword: {
    alignItems: "center",
    marginTop: s(16),
  },
  forgotPasswordText: {
    color: "#1C7ED6",
    fontSize: s(14),
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: s(24),
    paddingBottom: s(24),
    paddingTop: s(16),
  },
  footerText: {
    fontSize: s(14),
    color: "#5C6680",
    fontWeight: "600",
  },
  footerLink: {
    fontSize: s(14),
    color: "#1C7ED6",
    fontWeight: "800",
  },
});
