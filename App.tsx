// App.tsx
import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import Constants from "expo-constants";
import { onAuthStateChanged } from "firebase/auth";

import { ThemeProvider, useTheme } from "./src/components/theme/theme";
import { GlobalMusicProvider } from "./src/services/GlobalMusicPlayer";
import { AchievementProvider } from "./src/context/AchievementContext";
import { getCurrentUser, setCurrentUser, clearUserData, flushPendingCloudWrites, loadSetupComplete } from "./src/data/storage";
import { auth } from "./src/services/firebase";
import { bootstrapCloudForUser } from "./src/services/CloudBootstrap";
import { initNotifications, rescheduleAllNotifications, devTestAllNotifications } from "./src/services/notifications";
import { spotifyLoadSavedTokens } from "./src/services/SpotifyRemote";


import SignInScreen from "./screens/SignInScreen";
import EmailLoginScreen from "./screens/EmailLoginScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import VerifyEmailScreen from "./screens/VerifyEmailScreen";
import Q1NameScreen from "./screens/SetupScreens/Q1NameScreen";
import Q2OrganizeScreen from "./screens/SetupScreens/Q2OrganizeScreen";
import Q4QuoteScreen from "./screens/SetupScreens/Q4QuoteScreen";
import Q3FocusScreen from "./screens/SetupScreens/Q3FocusScreen";
import Q5TargetScreen from "./screens/SetupScreens/Q5TargetScreen";
import SearchScreen from "./screens/Dashboard/SearchScreen";
import AppTabs from "./src/navigation/AppTabs";
import FocusZoneScreen from "./screens/FocusZoneScreen";

import type { RootStackParamList } from "./src/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();

// ── Reads accent from theme so AchievementProvider gets the live color ────
function AppInner({ initialRoute }: { initialRoute: keyof RootStackParamList }) {
  const { colors } = useTheme();

  return (
    <AchievementProvider accentColor={colors.accent}>
      <GlobalMusicProvider>
        <NavigationContainer>
          <Stack.Navigator
            id="RootStack"
            initialRouteName={initialRoute}
            screenOptions={{ headerShown: false, gestureEnabled: false }}
          >
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="EmailLogin" component={EmailLoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Q1NameScreen" component={Q1NameScreen} />
            <Stack.Screen name="Q2OrganizeScreen" component={Q2OrganizeScreen} />
            <Stack.Screen name="Q4QuoteScreen" component={Q4QuoteScreen} />
            <Stack.Screen name="Q3FocusScreen" component={Q3FocusScreen} />
            <Stack.Screen name="Q5TargetScreen" component={Q5TargetScreen} />
            <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
            <Stack.Screen name="FocusZoneScreen" component={FocusZoneScreen} />
            <Stack.Screen name="MainTabs" component={AppTabs} />
            <Stack.Screen name="Search" component={SearchScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </GlobalMusicProvider>
    </AchievementProvider>
  );
}

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>("SignIn");

  useEffect(() => {
    // Initialise notifications early — sets foreground handler + requests permission.
    // Non-blocking: failures are gracefully suppressed inside initNotifications.
    initNotifications().catch(() => {});
    // Expose test helper to Hermes debugger console in dev builds.
    if (__DEV__) {
      (global as any).devTestNotifs = devTestAllNotifications;
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const savedUserId = await getCurrentUser();
        const firebaseUser = auth.currentUser;

        if (savedUserId && firebaseUser && firebaseUser.uid === savedUserId) {
          await firebaseUser.reload();
          if (!firebaseUser.emailVerified) {
            setInitialRoute("VerifyEmail");
            return;
          }
          const setupComplete = await loadSetupComplete();
          setInitialRoute(setupComplete ? "MainTabs" : "Q1NameScreen");
          // Silently restore Spotify session from cloud (existing login)
          spotifyLoadSavedTokens().catch(() => {});
        } else if (firebaseUser) {
          await setCurrentUser(firebaseUser.uid);
          await firebaseUser.reload();
          if (!firebaseUser.emailVerified) {
            setInitialRoute("VerifyEmail");
            return;
          }
          const setupComplete = await loadSetupComplete();
          setInitialRoute(setupComplete ? "MainTabs" : "Q1NameScreen");
          // Reschedule after user is loaded
          rescheduleAllNotifications().catch(() => {});
          // Silently restore Spotify session from cloud (new/re-authenticated login)
          spotifyLoadSavedTokens().catch(() => {});
        } else {
          setInitialRoute("SignIn");
        }
      } catch (error) {
        console.error("App: Error checking auth:", error);
        setInitialRoute("SignIn");
      } finally {
        setInitializing(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await setCurrentUser(user.uid);
        // Silently restore Spotify session on every auth state change (login / return from bg)
        spotifyLoadSavedTokens().catch(() => {});
        if (typeof flushPendingCloudWrites === "function") {
          await flushPendingCloudWrites();
        }
        const name = user.displayName ?? "";
        const email = user.email ?? "";
        await bootstrapCloudForUser({ name, email });
      } else {
        if (typeof clearUserData === "function") {
          await clearUserData();
        }
      }
    });
    return () => unsub();
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0A1630" }}>
        <ActivityIndicator size="large" color="#00B8A1" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppInner initialRoute={initialRoute} />
    </ThemeProvider>
  );
}