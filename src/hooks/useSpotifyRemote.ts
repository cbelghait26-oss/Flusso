import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import { remote } from "react-native-spotify-remote";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";

WebBrowser.maybeCompleteAuthSession();

type State = {
  connected: boolean;
  connecting: boolean;
  error: string | null;
};

const SPOTIFY_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token",
};

export function useSpotifyRemote() {
  const [state, setState] = useState<State>({
    connected: false,
    connecting: false,
    error: null,
  });

  const CLIENT_ID =
    process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ??
    "f95c8effcc63427e8b98c6a92a9d0c17";

  // Must match Spotify dashboard EXACTLY (keep the trailing slash if that's what you registered)
  const REDIRECT_URI =
    process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI ?? "flusso://spotify-auth/";

  // App Remote only
  const SCOPES = ["app-remote-control"];

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    SPOTIFY_DISCOVERY,
  );

  const connect = useCallback(async () => {
    console.log("🎵 Spotify connect button pressed!");

    const isExpoGo =
      Constants.appOwnership === "expo" ||
      Constants.executionEnvironment === "storeClient";

    console.log("🔍 Expo Go check:", {
      appOwnership: Constants.appOwnership,
      executionEnvironment: Constants.executionEnvironment,
      bundleId: Constants.expoConfig?.ios?.bundleIdentifier,
      isExpoGo,
    });

    if (isExpoGo) {
      Alert.alert(
        "Expo Go Not Supported",
        "Spotify Remote doesn't work in Expo Go. You need a custom development build.",
        [{ text: "OK" }],
      );
      return;
    }

    try {
      setState((s) => ({ ...s, connecting: true, error: null }));

      if (!CLIENT_ID) throw new Error("Missing EXPO_PUBLIC_SPOTIFY_CLIENT_ID");
      if (!REDIRECT_URI)
        throw new Error("Missing EXPO_PUBLIC_SPOTIFY_REDIRECT_URI");

      if (!request) throw new Error("Spotify auth request not ready yet");

      console.log("🎵 Starting Spotify PKCE auth with:", {
        CLIENT_ID,
        REDIRECT_URI,
        SCOPES,
      });

      // Open Spotify auth in browser
      const authResult = await promptAsync();

      if (authResult.type !== "success") {
        throw new Error(
          authResult.type === "dismiss"
            ? "Authorization dismissed"
            : "Authorization failed",
        );
      }

      const code = authResult.params?.code;
      if (!code) throw new Error("Missing authorization code in redirect");

      // Exchange code -> access token (PKCE; no backend required)
      const tokenRes = await AuthSession.exchangeCodeAsync(
        {
          clientId: CLIENT_ID,
          code,
          redirectUri: REDIRECT_URI,
          extraParams: {
            // Spotify expects code_verifier for PKCE
            code_verifier: request.codeVerifier ?? "",
          },
        },
        SPOTIFY_DISCOVERY,
      );

      const accessToken = tokenRes.accessToken;
      if (!accessToken) throw new Error("Missing access token");

      const can = await Linking.canOpenURL("spotify://");
      console.log("canOpenURL spotify:// =", can);

      if (!can) {
        Alert.alert(
          "Spotify URL scheme not available",
          "iOS cannot open spotify://. This usually means Spotify isn't installed, you're on a simulator, or the installed Flusso build doesn't include LSApplicationQueriesSchemes.",
        );
        return;
      }
      console.log("canOpenURL spotify:// =", await Linking.canOpenURL("spotify://"));
      console.log("canOpenURL spotify-action:// =", await Linking.canOpenURL("spotify-action://"));
      await remote.connect(accessToken);
      
      console.log("🎵 Connected successfully!");

      setState({ connected: true, connecting: false, error: null });
    } catch (e: any) {
      console.error("❌ Spotify connection error:", e);
      const errorMsg = e?.message ?? "Spotify connect failed";
      setState({ connected: false, connecting: false, error: errorMsg });
      Alert.alert("Spotify Connection Failed", errorMsg);
    }
  }, [CLIENT_ID, REDIRECT_URI, request, promptAsync]);

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

  // Optional diagnostics
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      console.log("🔗 Deep link received:", event.url);
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) console.log("🔗 Initial URL:", url);
    });

    return () => subscription.remove();
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
