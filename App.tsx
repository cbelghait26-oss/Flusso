// App.tsx (wrap with ThemeProvider)
import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import Constants from "expo-constants";

import { ThemeProvider } from "./src/components/theme/theme";
import { getCurrentUser, setCurrentUser, loadSetupComplete } from "./src/data/storage";
import { auth } from "./src/services/firebase";

// Build verification - this proves you're on the NEW build with Spotify deep link handler
console.log("🏗️ BUILD INFO:");
console.log("  Build timestamp: 2026-02-17 21:30 (with Spotify AppDelegate handler)");
console.log("  Bundle ID:", Constants.expoConfig?.ios?.bundleIdentifier);
console.log("  Spotify Plugin: ENABLED");
console.log("  Deep Link Handler: app.plugin.js applied");
console.log("------------------------------------------------");

import SignInScreen from "./screens/SignInScreen";
import EmailLoginScreen from "./screens/EmailLoginScreen";
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

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>("SignIn");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("App: Checking authentication...");
        // Check if we have a saved user session
        const savedUserId = await getCurrentUser();
        const firebaseUser = auth.currentUser;
        console.log("App: Saved user ID:", savedUserId, "Firebase user:", firebaseUser?.uid);

        if (savedUserId && firebaseUser && firebaseUser.uid === savedUserId) {
          // User is logged in and session is valid - check setup completion (instant)
          console.log("App: Valid session found, checking setup completion...");
          const setupComplete = await loadSetupComplete();
          console.log("App: Setup complete:", setupComplete);
          
          if (setupComplete) {
            setInitialRoute("MainTabs");
          } else {
            // User logged in but hasn't completed setup
            setInitialRoute("Q1NameScreen");
          }
        } else if (firebaseUser) {
          // Firebase has a user but our storage doesn't - sync them
          console.log("App: Syncing Firebase user to storage and loading cloud data...");
          await setCurrentUser(firebaseUser.uid);
          console.log("App: Cloud sync complete");
          
          // Check setup completion (instant - reads from local after sync)
          console.log("App: Checking setup completion...");
          const setupComplete = await loadSetupComplete();
          console.log("App: Setup complete:", setupComplete);
          
          if (setupComplete) {
            setInitialRoute("MainTabs");
          } else {
            setInitialRoute("Q1NameScreen");
          }
        } else {
          // No authenticated user
          console.log("App: No authenticated user found");
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

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0A1630" }}>
        <ActivityIndicator size="large" color="#00B8A1" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator 
          id="RootStack" 
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false, gestureEnabled: false }}
        >
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="EmailLogin" component={EmailLoginScreen} />
          <Stack.Screen name="Q1NameScreen" component={Q1NameScreen} />
          <Stack.Screen name="Q2OrganizeScreen" component={Q2OrganizeScreen} />
          <Stack.Screen name="Q4QuoteScreen" component={Q4QuoteScreen} />
          <Stack.Screen name="Q3FocusScreen" component={Q3FocusScreen} />
          <Stack.Screen name="Q5TargetScreen" component={Q5TargetScreen} />
          <Stack.Screen name="FocusZoneScreen" component={FocusZoneScreen} />

          <Stack.Screen name="MainTabs" component={AppTabs} />

          {/* Search overlays tabs */}
          <Stack.Screen name="Search" component={SearchScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}
