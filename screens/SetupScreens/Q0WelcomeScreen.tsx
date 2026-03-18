import React, { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Easing,
  Text,
} from "react-native";
import { s } from "../../src/ui/ts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../src/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Q0WelcomeScreen">;

const Q0WelcomeScreen = ({ navigation, route }: Props) => {
  const screenFade   = useRef(new Animated.Value(0)).current;
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeY     = useRef(new Animated.Value(-s(12))).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const logoScale    = useRef(new Animated.Value(0.55)).current;
  const nameOpacity  = useRef(new Animated.Value(0)).current;
  const leftX        = useRef(new Animated.Value(-s(56))).current;
  const rightX       = useRef(new Animated.Value(s(56))).current;

  useEffect(() => {
    Animated.timing(screenFade, { toValue: 1, duration: 380, useNativeDriver: true }).start();

    Animated.sequence([
      Animated.delay(260),
      // "Welcome to" drops in
      Animated.parallel([
        Animated.timing(welcomeOpacity, { toValue: 1, duration: 310, useNativeDriver: true }),
        Animated.timing(welcomeY, { toValue: 0, duration: 310, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(180),
      // Logo springs in
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      ]),
      Animated.delay(240),
      // "Flusso" split reveal — halves fly in from opposite sides
      Animated.parallel([
        Animated.timing(nameOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(leftX,       { toValue: 0, duration: 430, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rightX,      { toValue: 0, duration: 430, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(1500),
    ]).start(() => {
      Animated.timing(screenFade, { toValue: 0, duration: 360, useNativeDriver: true }).start(() => {
        navigation.navigate("Q1NameScreen", { setup: route.params?.setup ?? {} });
      });
    });
  }, []);

  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={["#000612", "#010E48", "#052480"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["transparent", "rgba(0,90,200,0.48)", "rgba(30,150,230,0.30)", "transparent"]}
        start={{ x: 1, y: 0.15 }} end={{ x: 0, y: 0.85 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(60,160,255,0.20)", "transparent", "rgba(0,50,200,0.26)"]}
        start={{ x: 0.6, y: 0 }} end={{ x: 0.1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.center, { opacity: screenFade }]}>
        {/* "Welcome to" */}
        <Animated.Text
          style={[
            styles.welcome,
            { opacity: welcomeOpacity, transform: [{ translateY: welcomeY }] },
          ]}
        >
          Welcome to
        </Animated.Text>

        {/* Logo */}
        <Animated.Image
          source={require("../../assets/icon.png")}
          style={[
            styles.logo,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        />

        {/* "Flusso" — split reveal */}
        <Animated.View style={[styles.nameRow, { opacity: nameOpacity }]}>
          <Animated.Text style={[styles.namePart, { transform: [{ translateX: leftX }] }]}>
            Flu
          </Animated.Text>
          <Animated.Text style={[styles.namePart, { transform: [{ translateX: rightX }] }]}>
            sso
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

export default Q0WelcomeScreen;

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#000612",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  welcome: {
    color: "rgba(244,246,242,0.65)",
    fontSize: s(13),
    fontWeight: "600",
    letterSpacing: s(2.5),
    textTransform: "uppercase",
    marginBottom: s(22),
  },
  logo: {
    width: s(90),
    height: s(90),
    borderRadius: s(22),
    marginBottom: s(18),
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  namePart: {
    color: "#F4F6F2",
    fontSize: s(54),
    fontWeight: "700",
    letterSpacing: s(-1.5),
    fontFamily: "Manrope",
  },
});
