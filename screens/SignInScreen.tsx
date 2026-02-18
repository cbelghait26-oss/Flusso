import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  TouchableOpacity,
  Image,
} from "react-native";
import React, { useMemo, useRef, useState } from "react";
import LoginBox from "../src/components/ui/LoginBox";
import { s } from "react-native-size-matters";
import { Fontisto, FontAwesome5, FontAwesome } from "@expo/vector-icons";
import { Alert, ActivityIndicator } from "react-native";
import { signInWithGoogleFirebase } from "../src/services/googleAuth";
import { setCurrentUser, loadSetupComplete } from "../src/data/storage";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../src/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

const SCREEN_HEIGHT = Dimensions.get("window").height;

type SheetType = "login" | "signup" | null;

const SignInScreen = ({ navigation }: Props) => {
  const [sheetType, setSheetType] = useState<SheetType>(null);
  const [visible, setVisible] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const options = useMemo(() => {
    if (sheetType === "login") {
      return [
        {
          label: "Log in with Email",
          icon: <Fontisto name="email" size={s(22)} color="#F4F6F2" />,
          onPress: () => {
            closeSheet();
            navigation.navigate("EmailLogin", { isSignUp: false });
          },
        },
        {
          label: "Log in with Google",
          icon: <FontAwesome name="google" size={s(22)} color="#F4F6F2" />,
          onPress: async () => {
            try {
              setGoogleLoading(true);
              console.log("SignIn: Starting Google sign-in...");
              const userCredential = await signInWithGoogleFirebase();
              console.log("SignIn: Google sign-in successful, user ID:", userCredential.user.uid);
              
              // Set current user in storage (waits for cloud sync)
              console.log("SignIn: Setting current user and syncing cloud data...");
              await setCurrentUser(userCredential.user.uid);
              console.log("SignIn: Cloud sync complete");
              
              // Check if setup is complete (instant - reads from local storage)
              console.log("SignIn: Checking setup completion...");
              const setupComplete = await loadSetupComplete();
              console.log("SignIn: Setup complete status:", setupComplete);
              
              closeSheet();
              
              console.log("SignIn: Navigating to", setupComplete ? "MainTabs" : "Q1NameScreen");
              if (setupComplete) {
                // User has already completed setup - go to main app
                navigation.navigate("MainTabs");
              } else {
                // User needs to complete setup
                navigation.navigate("Q1NameScreen", { setup: {} });
              }
            } catch (e: any) {
              console.error("SignIn: Error during Google sign-in:", e);
              Alert.alert(
                "Google Sign-In failed",
                e?.message ?? "Unknown error",
              );
            } finally {
              setGoogleLoading(false);
            }
          },
        },
        {
          label: "Log in with Apple",
          icon: <FontAwesome5 name="apple" size={s(22)} color="#F4F6F2" />,
          onPress: () => navigation.navigate("Q1NameScreen", { setup: {} }),
        },
      ];
    }

    if (sheetType === "signup") {
      return [
        {
          label: "Sign up with Email",
          icon: <Fontisto name="email" size={s(22)} color="#F4F6F2" />,
          onPress: () => {
            closeSheet();
            navigation.navigate("EmailLogin", { isSignUp: true });
          },
        },
        {
          label: "Sign up with Google",
          icon: <FontAwesome name="google" size={s(22)} color="#F4F6F2" />,
          onPress: async () => {
            try {
              setGoogleLoading(true);
              console.log("SignUp: Starting Google sign-up...");
              const userCredential = await signInWithGoogleFirebase();
              console.log("SignUp: Google sign-up successful, user ID:", userCredential.user.uid);
              
              // Set current user in storage (waits for cloud sync)
              console.log("SignUp: Setting current user and syncing cloud data...");
              await setCurrentUser(userCredential.user.uid);
              console.log("SignUp: Cloud sync complete");
              
              // Check if setup is complete (instant - reads from local storage)
              console.log("SignUp: Checking setup completion...");
              const setupComplete = await loadSetupComplete();
              console.log("SignUp: Setup complete status:", setupComplete);
              
              closeSheet();
              
              console.log("SignUp: Navigating to", setupComplete ? "MainTabs" : "Q1NameScreen");
              if (setupComplete) {
                // User has already completed setup on another device - go to main app
                navigation.navigate("MainTabs");
              } else {
                // User needs to complete setup
                navigation.navigate("Q1NameScreen", { setup: {} });
              }
            } catch (e: any) {
              console.error("SignUp: Error during Google sign-up:", e);
              Alert.alert(
                "Google Sign-In failed",
                e?.message ?? "Unknown error",
              );
            } finally {
              setGoogleLoading(false);
            }
          },
        },
        {
          label: "Sign up with Apple",
          icon: <FontAwesome5 name="apple" size={s(22)} color="#F4F6F2" />,
          onPress: () => navigation.navigate("Q1NameScreen", { setup: {} }),
        },
      ];
    }

    return [];
  }, [sheetType]);

  const openSheet = (type: Exclude<SheetType, null>) => {
    setSheetType(type);
    setVisible(true);

    // Slide up to mid-screen-ish
    const targetY = SCREEN_HEIGHT * 0.35;

    Animated.timing(translateY, {
      toValue: targetY,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setSheetType(null);
    });
  };

  return (
    <View style={styles.container}>
      <View>
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            top: s(-50),
            right: s(20),
          }}
        >
          <Image
            source={require("../assets/icon.png")}
            style={{ height: s(70), width: s(70) }}
          />
          <Text style={styles.title}>Flusso</Text>
        </View>
        <View>
          <Image
            source={require("../assets/AuthScreen.png")}
            style={styles.image}
          />
        </View>

        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <LoginBox
            title="Log In"
            color="#db1717"
            onPress={() => openSheet("login")}
          />
          <LoginBox
            title="Sign Up"
            color="#002640"
            onPress={() => openSheet("signup")}
          />
        </View>
        <View>
          <Text style={styles.legalText}>
            By signing up, you agree to our{" "}
            <Text style={styles.linkText} onPress={() => {}}>
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text style={styles.linkText} onPress={() => {}}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </View>

      <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.backdrop} onPress={closeSheet} />

        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          {options.map((opt) => {
            const isGoogle = opt.label.toLowerCase().includes("google");

            return (
              <TouchableOpacity
                key={opt.label}
                style={styles.optionBtn}
                activeOpacity={0.85}
                disabled={googleLoading}
                onPress={async () => {
                  await opt.onPress();
                }}
              >
                <View style={styles.optionRow}>
                  {opt.icon}
                  <Text style={styles.optionText}>
                    {googleLoading && isGoogle ? "Signing in..." : opt.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </Modal>
    </View>
  );
};
console.log("WEB CLIENT ID =", process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);


export default SignInScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1055BF",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
  },
  title: {
    color: "#F4F6F2",
    fontSize: s(36),
    fontWeight: "600",
    fontFamily: "Manrope",
    letterSpacing: s(-1),
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  sheet: {
    position: "absolute",
    left: s(16),
    right: s(16),
    backgroundColor: "#1055BF",
    borderRadius: s(16),
    paddingHorizontal: s(18),
    paddingTop: s(14),
    paddingBottom: s(18),
  },
  optionBtn: {
    height: s(44),
    borderRadius: s(34),
    justifyContent: "center",
    paddingHorizontal: s(14),
    backgroundColor: "#1055BF",
    marginBottom: s(10),
  },
  optionText: {
    fontSize: s(16),
    fontWeight: "500",
    color: "#F4F6F2",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
  },
  image: {
    width: s(300),
    height: s(300),
    marginLeft: s(0),
  },
  legalText: {
    position: "absolute",
    bottom: s(-75), // distance from bottom
    left: s(24),
    right: s(24),
    textAlign: "center",
    fontSize: s(12),
    color: "#F4F6F2",
    opacity: 0.85,
  },
  linkText: {
    textDecorationLine: "underline",
    fontWeight: "600",
    color: "#F4F6F2",
  },
});
