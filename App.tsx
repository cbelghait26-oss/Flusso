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
import { setCurrentUser, clearUserData, flushPendingCloudWrites, loadSetupComplete, loadSetupName } from "./src/data/storage";
import { auth } from "./src/services/firebase";
import { initNotifications, rescheduleAllNotifications } from "./src/services/notifications";
import { spotifyLoadSavedTokens } from "./src/services/SpotifyRemote";
import { ensureUserProfile } from "./src/services/SocialService";
import { initRevenueCat, loginRevenueCat, logoutRevenueCat, resolveAppDestination } from "./src/services/SubscriptionService";


import SignInScreen from "./screens/SignInScreen";
import EmailLoginScreen from "./screens/EmailLoginScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import VerifyEmailScreen from "./screens/VerifyEmailScreen";
import Q0WelcomeScreen from "./screens/SetupScreens/Q0WelcomeScreen";
import Q1NameScreen from "./screens/SetupScreens/Q1NameScreen";
import Q2MovementScreen from "./screens/SetupScreens/Q2MovementScreen";
import Q3WhyScreen from "./screens/SetupScreens/Q3WhyScreen";
import Q4QuoteScreen from "./screens/SetupScreens/Q4QuoteScreen";
import Q5ReflectionScreen from "./screens/SetupScreens/Q5ReflectionScreen";
import Q6DirectedFocusScreen from "./screens/SetupScreens/Q6DirectedFocusScreen";
import Q7ModelScreen from "./screens/SetupScreens/Q7ModelScreen";
import Q8FocusCommitScreen from "./screens/SetupScreens/Q8FocusCommitScreen";
import Q9ClosingScreen from "./screens/SetupScreens/Q9ClosingScreen";
import SearchScreen from "./screens/Dashboard/SearchScreen";
import AppTabs from "./src/navigation/AppTabs";
import FocusZoneScreen from "./screens/FocusZoneScreen";
import TrainingRoomScreen from "./screens/TrainingRoomScreen";
import SocialScreen from "./screens/Social/SocialScreen";
import AddFriendScreen from "./screens/Social/AddFriendScreen";
import PaywallScreen from "./screens/PaywallScreen";

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
            screenOptions={{ headerShown: false, gestureEnabled: false, contentStyle: { backgroundColor: "#000612" } }}
          >
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="EmailLogin" component={EmailLoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Q0WelcomeScreen" component={Q0WelcomeScreen}
              options={{ animation: "fade", contentStyle: { backgroundColor: "#000612" } }} />
            <Stack.Screen name="Q1NameScreen" component={Q1NameScreen}
              options={{ animation: "fade", contentStyle: { backgroundColor: "#000612" } }} />
            <Stack.Screen name="Q2MovementScreen" component={Q2MovementScreen}
              options={{ animation: "fade", contentStyle: { backgroundColor: "#000612" } }} />
            <Stack.Screen name="Q3WhyScreen" component={Q3WhyScreen}
              options={{ animation: "fade", contentStyle: { backgroundColor: "#000612" } }} />
            <Stack.Screen name="Q4QuoteScreen" component={Q4QuoteScreen}
              options={{ animation: "fade", contentStyle: { backgroundColor: "#000612" } }} />
            <Stack.Screen name="Q5ReflectionScreen" component={Q5ReflectionScreen}
              options={{ animation: "fade", contentStyle: { backgroundColor: "#000612" } }} />
            <Stack.Screen name="Q6DirectedFocusScreen" component={Q6DirectedFocusScreen}
              options={{ animation: "fade", contentStyle: { backgroundColor: "#000612" } }} />
            <Stack.Screen name="Q7ModelScreen" component={Q7ModelScreen}
              options={{ animation: "fade", contentStyle: { backgroundColor: "#000612" } }} />
            <Stack.Screen name="Q8FocusCommitScreen" component={Q8FocusCommitScreen}
              options={{ animation: "fade", contentStyle: { backgroundColor: "#000612" } }} />
            <Stack.Screen name="Q9ClosingScreen" component={Q9ClosingScreen}
              options={{ animation: "fade", contentStyle: { backgroundColor: "#000612" } }} />
            <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
            <Stack.Screen name="Paywall" component={PaywallScreen}
              options={{ animation: "fade", gestureEnabled: false }} />
            <Stack.Screen name="FocusZoneScreen" component={FocusZoneScreen} />
            <Stack.Screen name="TrainingRoom" component={TrainingRoomScreen} />
            <Stack.Screen name="MainTabs" component={AppTabs} />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="Social" component={SocialScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="AddFriend" component={AddFriendScreen} options={{ animation: "slide_from_right" }} />
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
    // Initialise RevenueCat once — must run before any auth/purchase logic.
    initRevenueCat();
    initNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    // Use onAuthStateChanged for the initial route decision.
    // Firebase restores the persisted token asynchronously, so reading
    // auth.currentUser directly at mount is a race condition — the listener
    // fires only after Firebase has definitively resolved the auth state.
    let resolved = false;

    // Safety fallback: if Firebase or the network is completely unresponsive,
    // show sign-in after 8 s instead of leaving the user on the loading spinner.
    const masterTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setInitialRoute("SignIn");
        setInitializing(false);
      }
    }, 8000);

    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // setCurrentUser sets currentUserId synchronously before its first await,
          // so requireUserId() will work immediately. Run the async parts in the background
          // so they never block the routing decision.
          setCurrentUser(user.uid).catch(() => {});
          // Map this Flusso user to their RevenueCat identity so entitlements
          // are shared across devices and web.
          loginRevenueCat(user.uid).catch(() => {});
          spotifyLoadSavedTokens().catch(() => {});
          // Ensure the user has a public profile + friend tag in Firestore.
          // Load the name the user chose during setup (email/password accounts
          // have no displayName in Firebase Auth).
          ;(async () => {
            try {
              const storedName = await loadSetupName();
              await ensureUserProfile(
                storedName ?? user.displayName ?? null,
                user.photoURL ?? null
              );
            } catch {}
          })();
          if (typeof flushPendingCloudWrites === "function") {
            flushPendingCloudWrites().catch(() => {});
          }

          // Only set the initial route once (first listener call)
          if (!resolved) {
            resolved = true;
            clearTimeout(masterTimeout);

            // Give user.reload() at most 3 s — skip if the network is slow/offline.
            await Promise.race([
              user.reload().catch(() => {}),
              new Promise<void>(res => setTimeout(res, 3000)),
            ]);

            if (!user.emailVerified) {
              setInitialRoute("VerifyEmail");
            } else {
              const setupComplete = await loadSetupComplete();
              if (setupComplete) {
                setInitialRoute(await resolveAppDestination());
              } else {
                setInitialRoute("Q1NameScreen");
              }
              rescheduleAllNotifications().catch(() => {});
            }
            setInitializing(false);
          }
        } else {
          // Signed out — clear app-level data and reset RevenueCat to anonymous.
          if (typeof clearUserData === "function") {
            clearUserData().catch(() => {});
          }
          logoutRevenueCat().catch(() => {});
          if (!resolved) {
            resolved = true;
            clearTimeout(masterTimeout);
            setInitialRoute("SignIn");
            setInitializing(false);
          }
        }
      } catch (error) {
        console.error("App: auth state error:", error);
        if (!resolved) {
          resolved = true;
          clearTimeout(masterTimeout);
          setInitialRoute("SignIn");
          setInitializing(false);
        }
      }
    });

    return () => {
      clearTimeout(masterTimeout);
      unsub();
    };
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