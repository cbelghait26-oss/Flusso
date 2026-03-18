import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  Animated,
  TouchableOpacity,
  Image,
  Platform,
  useWindowDimensions,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useRef, useState } from "react";
import LoginBox from "../src/components/ui/LoginBox";
import { s } from "../src/ui/ts";
import { Fontisto, FontAwesome5, FontAwesome } from "@expo/vector-icons";
import { Alert, ActivityIndicator } from "react-native";
import { signInWithGoogleFirebase } from "../src/services/googleAuth";
import { signInWithApple } from "../src/services/appleAuth";
import { setCurrentUser, loadSetupComplete } from "../src/data/storage";
import {
  useDeviceClass,
  CONTENT_MAX_WIDTH,
  sheetHorizontalInsets,
} from "../src/ui/responsive";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../src/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

type SheetType = "login" | "signup" | null;

const SignInScreen = ({ navigation }: Props) => {
  const { isTablet, width, height } = useDeviceClass();
  const [sheetType, setSheetType] = useState<SheetType>(null);
  const [visible, setVisible] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  // Use dynamic height so iPad landscape doesn't break sheet animation
  const translateY = useRef(new Animated.Value(height)).current;

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
              const userCredential = (await signInWithGoogleFirebase()) as any;
              
              // Set current user in storage (waits for cloud sync)
              await setCurrentUser(userCredential.user.uid);
              
              // Check if setup is complete (instant - reads from local storage)
              const setupComplete = await loadSetupComplete();
              
              closeSheet();
              
              if (setupComplete) {
                // User has already completed setup - go to main app
                navigation.navigate("MainTabs");
              } else {
                // User needs to complete setup
                const displayName = userCredential.user.displayName ?? "";
                navigation.navigate("Q0WelcomeScreen", { setup: { name: displayName } });
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
        ...(Platform.OS === 'ios' ? [{
          label: "Log in with Apple",
          icon: <FontAwesome5 name="apple" size={s(22)} color="#F4F6F2" />,
          onPress: async () => {
            try {
              setAppleLoading(true);
              const userCredential = (await signInWithApple()) as any;
              if (!userCredential) {
                setAppleLoading(false);
                return; // user cancelled
              }

              await setCurrentUser(userCredential.user.uid);

              const setupComplete = await loadSetupComplete();

              closeSheet();

              if (setupComplete) {
                navigation.navigate("MainTabs");
              } else {
                const displayName = userCredential.user.displayName ?? "";
                navigation.navigate("Q0WelcomeScreen", { setup: { name: displayName } });
              }
            } catch (e: any) {
              console.error("SignIn: Error during Apple sign-in:", e);
              Alert.alert("Apple Sign-In failed", e?.message ?? "Unknown error");
            } finally {
              setAppleLoading(false);
            }
          },
        }] : []),
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
              const userCredential = (await signInWithGoogleFirebase()) as any;
              
              // Set current user in storage (waits for cloud sync)
              await setCurrentUser(userCredential.user.uid);
              
              // Check if setup is complete (instant - reads from local storage)
              const setupComplete = await loadSetupComplete();
              
              closeSheet();
              
              if (setupComplete) {
                // User has already completed setup on another device - go to main app
                navigation.navigate("MainTabs");
              } else {
                // User needs to complete setup
                const displayName = userCredential.user.displayName ?? "";
                navigation.navigate("Q0WelcomeScreen", { setup: { name: displayName } });
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
        ...(Platform.OS === 'ios' ? [{
          label: "Sign up with Apple",
          icon: <FontAwesome5 name="apple" size={s(22)} color="#F4F6F2" />,
          onPress: async () => {
            try {
              setAppleLoading(true);
              const userCredential = (await signInWithApple()) as any;
              if (!userCredential) {
                setAppleLoading(false);
                return; // user cancelled
              }

              await setCurrentUser(userCredential.user.uid);

              const setupComplete = await loadSetupComplete();

              closeSheet();

              if (setupComplete) {
                navigation.navigate("MainTabs");
              } else {
                const displayName = userCredential.user.displayName ?? "";
                navigation.navigate("Q0WelcomeScreen", { setup: { name: displayName } });
              }
            } catch (e: any) {
              console.error("SignUp: Error during Apple sign-up:", e);
              Alert.alert("Apple Sign-Up failed", e?.message ?? "Unknown error");
            } finally {
              setAppleLoading(false);
            }
          },
        }] : []),
      ];
    }

    return [];
  }, [sheetType]);

  const openSheet = (type: Exclude<SheetType, null>) => {
    setSheetType(type);
    setVisible(true);
    // Slide up far enough that the sheet sits in the lower portion of screen
    const targetY = height * 0.35;
    Animated.timing(translateY, {
      toValue: targetY,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(translateY, {
      toValue: height,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setSheetType(null);
    });
  };

  // On tablet: centre the card with a maxWidth
  const innerContentStyle = isTablet
    ? { maxWidth: CONTENT_MAX_WIDTH, width: "100%" as any, alignSelf: "center" as const }
    : {};
  // Image size: capped at 300 on phone, 340 on tablet – never uses s() which explodes on iPad
  const imageSize = isTablet ? 320 : Math.min(s(300), 320);
  // Sheet insets – narrow on phone, centred on tablet
  const sheetInsets = sheetHorizontalInsets(isTablet, width, CONTENT_MAX_WIDTH, 16);

  return (
    <View style={styles.container}>
      {/* Deep ocean base */}
      <LinearGradient
        colors={["#03045E", "#023E8A", "#0077B6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Cross-current flow overlay */}
      <LinearGradient
        colors={["transparent", "rgba(0,150,199,0.45)", "rgba(72,202,228,0.28)", "transparent"]}
        start={{ x: 1, y: 0.15 }}
        end={{ x: 0, y: 0.85 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft highlight sweep */}
      <LinearGradient
        colors={["rgba(144,224,239,0.18)", "transparent", "rgba(0,96,199,0.22)"]}
        start={{ x: 0.6, y: 0 }}
        end={{ x: 0.1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={innerContentStyle}>
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
            style={{ height: 64, width: 64 }}
          />
          <Text style={styles.title}>Flusso</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Image
            source={require("../assets/AuthScreen.png")}
            style={{ width: imageSize, height: imageSize }}
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
          <Text style={[styles.legalText, { marginTop: s(52) }]}>
            By signing up, you agree to our{" "}
            <Text style={styles.linkText} onPress={() => Linking.openURL("https://flussoapp.com/terms-and-conditions")}>
              Terms of Service
            </Text>{"\ "}
            and{"\ "}
            <Text style={styles.linkText} onPress={() => Linking.openURL("https://flussoapp.com/privacy-policy.html")}>
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
              left: sheetInsets.left,
              right: sheetInsets.right,
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
                disabled={googleLoading || appleLoading}
                onPress={async () => {
                  await opt.onPress();
                }}
              >
                <View style={styles.optionRow}>
                  {opt.icon}
                  <Text style={styles.optionText}>
                    {googleLoading && isGoogle
                      ? "Signing in..."
                      : appleLoading && opt.label.toLowerCase().includes('apple')
                      ? "Signing in..."
                      : opt.label}
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


export default SignInScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#03045E",
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
    // left/right overridden inline via sheetInsets
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
    // kept for reference; size overridden inline
    width: 300,
    height: 300,
  },
  legalText: {
    marginTop: 20,
    paddingHorizontal: s(24),
    textAlign: "center",
    fontSize: 12,
    color: "#F4F6F2",
    opacity: 0.85,
  },
  linkText: {
    textDecorationLine: "underline",
    fontWeight: "600",
    color: "#F4F6F2",
  },
  devButton: {
    marginTop: s(16),
    paddingVertical: s(8),
    paddingHorizontal: s(20),
    borderRadius: s(8),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  devButtonText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: s(13),
    fontWeight: "500",
  },
});
