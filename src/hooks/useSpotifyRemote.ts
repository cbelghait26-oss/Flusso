// src/hooks/useSpotifyRemote.ts
// Web API version — no native SDK, no App Remote connection required.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, AppStateStatus, Linking } from "react-native";
import Constants from "expo-constants";
import {
  spotifyConnectFull,
  spotifyDisconnect,
  spotifyIsConnected,
  spotifyReconnect,
  hasStoredCredentials,
} from "../services/SpotifyRemote";

type State = {
  connected:  boolean;
  connecting: boolean;
  error:      string | null;
};

export function useSpotifyRemote() {
  const [state, setState]     = useState<State>({ connected: false, connecting: false, error: null });
  const connectingRef         = useRef(false);
  const appStateRef           = useRef<AppStateStatus>(AppState.currentState);

  // ── On app foreground: silently verify token is still valid ─────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === "active") {
        if (hasStoredCredentials()) {
          const ok = await spotifyReconnect(); // just checks /me with current token
          setState((s) => ({ ...s, connected: ok }));
        }
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  // ── Initial check on mount ────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!hasStoredCredentials()) return;
      const ok = await spotifyIsConnected();
      if (mounted) setState((s) => ({ ...s, connected: ok }));
    })();
    return () => { mounted = false; };
  }, []);

  // ── Manual connect — user tapped the Spotify pill ────────────────────────
  const connect = useCallback(async () => {
    if (connectingRef.current) return;

    const isExpoGo =
      Constants.appOwnership === "expo" ||
      Constants.executionEnvironment === "storeClient";
    if (isExpoGo) {
      Alert.alert(
        "Expo Go Not Supported",
        "Spotify requires a custom development build.",
        [{ text: "OK" }],
      );
      return;
    }

    try {
      connectingRef.current = true;
      setState((s) => ({ ...s, connecting: true, error: null }));
      await spotifyConnectFull();
      setState({ connected: true, connecting: false, error: null });
    } catch (e: any) {
      const raw: string = e?.message ?? "";
      setState({ connected: false, connecting: false, error: raw });

      // User closed the browser — no noise
      if (raw.toLowerCase().includes("cancel") || raw.toLowerCase().includes("dismiss")) return;

      // Spotify Web API unreachable — probably no active device
      if (raw.includes("Web API unreachable")) {
        Alert.alert(
          "Open Spotify First",
          "Open the Spotify app and play a song, then come back and tap Spotify again.",
          [{ text: "Got it" }],
        );
        return;
      }

      const friendly = raw.split("\n")[0].trim() || "Connection failed. Please try again.";
      Alert.alert("Spotify Connection Failed", friendly);
    } finally {
      connectingRef.current = false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await spotifyDisconnect();
    setState({ connected: false, connecting: false, error: null });
  }, []);

  // Deep link debug logging (dev only)
  useEffect(() => {
    if (!__DEV__) return;
    const sub = Linking.addEventListener("url", ({ url }) => console.log("🔗 Deep link:", url));
    Linking.getInitialURL().then((url) => { if (url) console.log("🔗 Initial URL:", url); });
    return () => sub.remove();
  }, []);

  return useMemo(
    () => ({
      connected:  state.connected,
      connecting: state.connecting,
      error:      state.error,
      connect,
      disconnect,
    }),
    [state, connect, disconnect],
  );
}