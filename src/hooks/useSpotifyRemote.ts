// src/hooks/useSpotifyRemote.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import Constants from "expo-constants";
import {
  spotifyConnectFull,
  spotifyDisconnect,
  spotifyIsConnected,
} from "../services/SpotifyRemote";

// ─── Types ─────────────────────────────────────────────────────────────────

type State = {
  connected: boolean;
  connecting: boolean;
  error: string | null;
};

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useSpotifyRemote() {
  const [state, setState] = useState<State>({
    connected: false,
    connecting: false,
    error: null,
  });

  // Prevent double-connect if the user taps rapidly
  const connectingRef = useRef(false);

  const CLIENT_ID =
    (Constants.expoConfig?.extra as any)?.spotifyClientId ??
    process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ??
    "f95c8effcc63427e8b98c6a92a9d0c17";

  const REDIRECT_URI =
    process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI ?? "flusso://spotify-auth/";

  // ── connect ──────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (connectingRef.current) return;

    // Guard: Expo Go cannot load native modules
    const isExpoGo =
      Constants.appOwnership === "expo" ||
      Constants.executionEnvironment === "storeClient";

    if (isExpoGo) {
      Alert.alert(
        "Expo Go Not Supported",
        "Spotify Remote requires a custom development build. Run `expo run:ios` or `expo run:android`.",
        [{ text: "OK" }],
      );
      return;
    }

    // Guard: Spotify must be installed for App Remote to work
    const spotifyInstalled = await Linking.canOpenURL("spotify://").catch(() => false);
    if (!spotifyInstalled) {
      Alert.alert(
        "Spotify Not Installed",
        "The Spotify app must be installed on this device to use Spotify Remote.",
        [{ text: "OK" }],
      );
      return;
    }

    try {
      connectingRef.current = true;
      setState((s) => ({ ...s, connecting: true, error: null }));

      console.log("🎵 Starting Spotify connect…", { CLIENT_ID, REDIRECT_URI });

      // Opens Spotify OAuth in an in-app browser, captures the ?code= redirect,
      // exchanges for a token, then connects the App Remote native SDK.
      await spotifyConnectFull();

      console.log("✅ Spotify connected!");
      setState({ connected: true, connecting: false, error: null });
    } catch (e: any) {
      const msg: string =
        e?.message?.includes("cancel") || e?.message?.includes("dismiss")
          ? "Authorization was cancelled."
          : (e?.message ?? "Spotify connect failed");

      console.error("❌ Spotify connection error:", e);
      setState({ connected: false, connecting: false, error: msg });

      if (!msg.includes("cancelled")) {
        Alert.alert("Spotify Connection Failed", msg);
      }
    } finally {
      connectingRef.current = false;
    }
  }, [CLIENT_ID, REDIRECT_URI]);

  // ── disconnect ───────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    await spotifyDisconnect();
    setState({ connected: false, connecting: false, error: null });
  }, []);

  // ── Restore connection state on mount (after background/foreground) ───────
  useEffect(() => {
    let mounted = true;
    spotifyIsConnected().then((ok) => {
      if (mounted) setState((s) => ({ ...s, connected: ok }));
    });
    return () => {
      mounted = false;
    };
  }, []);

  // ── Deep-link diagnostics (dev only) ─────────────────────────────────────
  useEffect(() => {
    if (__DEV__) {
      const sub = Linking.addEventListener("url", ({ url }) => {
        console.log("🔗 Deep link received:", url);
      });
      Linking.getInitialURL().then((url) => {
        if (url) console.log("🔗 Initial URL:", url);
      });
      return () => sub.remove();
    }
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