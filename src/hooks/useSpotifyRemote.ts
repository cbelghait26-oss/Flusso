import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Alert, Linking } from "react-native";
import { remote, auth, ApiConfig, ApiScope } from "react-native-spotify-remote";
import Constants from "expo-constants";

type State = {
  connected: boolean;
  connecting: boolean;
  error: string | null;
};

export function useSpotifyRemote() {
  const [state, setState] = useState<State>({
    connected: false,
    connecting: false,
    error: null,
  });

  // IMPORTANT:
  // - Client ID comes from Spotify Dashboard
  // - Redirect URI must match EXACTLY what you added there
  //   e.g. "flusso://spotify-auth"
  const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? "f95c8effcc63427e8b98c6a92a9d0c17";
  const REDIRECT_URI = process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI ?? "flusso://spotify-auth";

  const connect = useCallback(async () => {
    console.log("🎵 Spotify connect button pressed!");
    
    // Check if running in Expo Go (won't work there)
    const isExpoGo = Constants.appOwnership === 'expo' || 
                     Constants.executionEnvironment === 'storeClient';
    
    console.log("🔍 Expo Go check:", { 
      appOwnership: Constants.appOwnership,
      executionEnvironment: Constants.executionEnvironment,
      bundleId: Constants.expoConfig?.ios?.bundleIdentifier,
      isExpoGo 
    });
    
    if (isExpoGo) {
      Alert.alert(
        "Expo Go Not Supported",
        "Spotify Remote doesn't work in Expo Go. You need a custom development build.",
        [{ text: "OK" }]
      );
      return;
    }
    
    try {
      setState((s) => ({ ...s, connecting: true, error: null }));

      if (!CLIENT_ID) throw new Error("Missing EXPO_PUBLIC_SPOTIFY_CLIENT_ID");
      if (!REDIRECT_URI) throw new Error("Missing EXPO_PUBLIC_SPOTIFY_REDIRECT_URI");

      console.log("🎵 Starting Spotify authorization with:", { CLIENT_ID, REDIRECT_URI });

      const config: ApiConfig = {
        clientID: CLIENT_ID,
        redirectURL: REDIRECT_URI,
        tokenRefreshURL: "",
        tokenSwapURL: "",
        scopes: [ApiScope.AppRemoteControlScope, ApiScope.UserFollowReadScope],
      };

      // First authorize to get access token with 60 second timeout
      console.log("🎵 Calling auth.authorize...");
      console.log("🎵 If Spotify app opens, the redirect should come back to this app!");
      
      const authPromise = auth.authorize(config);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => {
          console.log("❌ TIMEOUT: Deep link was never caught by the app");
          console.log("❌ This means AppDelegate.openURL handler is missing or not working");
          reject(new Error("Authorization timeout after 60 seconds"));
        }, 60000)
      );
      
      const session = await Promise.race([authPromise, timeoutPromise]) as any;
      console.log("✅ Authorization successful! Deep link was caught, got token");
      
      // Then connect with the token
      console.log("🎵 Calling remote.connect...");
      await remote.connect(session.accessToken);
      console.log("🎵 Connected successfully!");

      setState({ connected: true, connecting: false, error: null });
    } catch (e: any) {
      console.error("❌ Spotify connection error:", e);
      const errorMsg = e?.message ?? "Spotify connect failed";
      setState({ connected: false, connecting: false, error: errorMsg });
      
      // Show helpful error based on what failed
      if (errorMsg.includes("timeout")) {
        Alert.alert(
          "Deep Link Handler Missing", 
          "The Spotify redirect worked, but your app couldn't catch it.\n\nYou need to install the LATEST build from EAS that includes the deep link handler.\n\n1. Download the new build from EAS\n2. Install it (replace current build)\n3. Verify flusso://spotify-auth is in Spotify Dashboard\n4. Try connecting again",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Spotify Connection Failed", errorMsg);
      }
    }
  }, [CLIENT_ID, REDIRECT_URI]);

  const disconnect = useCallback(async () => {
    try {
      await remote.disconnect();
    } catch {}
    setState({ connected: false, connecting: false, error: null });
  }, []);

  // keep state accurate
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ok = await remote.isConnectedAsync();
        if (mounted && typeof ok === "boolean") {
          setState((s) => ({ ...s, connected: ok }));
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Listen for deep links as diagnostic
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      console.log("🔗 Deep link received:", event.url);
      if (event.url.includes("spotify-auth")) {
        console.log("✅ Spotify auth redirect caught by Linking listener!");
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    // Check for initial URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log("🔗 Initial URL:", url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return useMemo(
    () => ({
      connected: state.connected,
      connecting: state.connecting,
      error: state.error,
      connect,
      disconnect,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      platform: Platform.OS,
    }),
    [state, connect, disconnect, CLIENT_ID, REDIRECT_URI],
  );
}
