// src/hooks/useSpotifyRemote.ts
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

// All the ways the SDK says "Spotify isn't actively playing"
const NOT_PLAYING_PATTERNS = [
  "connection refused",
  "connection attempt failed",
  "stream error",
  "reconnect the transport",
  "spotifynotinstalled",
  "spotify not installed",
  "not playing",
];

function isNotPlayingError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return NOT_PLAYING_PATTERNS.some((p) => lower.includes(p));
}

export function useSpotifyRemote() {
  const [state, setState] = useState<State>({ connected: false, connecting: false, error: null });
  const connectingRef     = useRef(false);
  const appStateRef       = useRef<AppStateStatus>(AppState.currentState);

  // ── On app foreground: silent reconnect attempt — NEVER shows alerts ─────
  // App Remote requires Spotify to be actively playing to connect.
  // If Spotify isn't playing the reconnect will fail silently — that's fine.
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === "active") {
        const stillConnected = await spotifyIsConnected();
        if (!stillConnected && hasStoredCredentials()) {
          const ok = await spotifyReconnect(); // swallows all errors internally
          setState((s) => ({ ...s, connected: ok }));
        } else {
          setState((s) => ({ ...s, connected: stillConnected }));
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
      const ok = await spotifyIsConnected();
      if (!mounted) return;
      if (!ok && hasStoredCredentials()) {
        const reconnected = await spotifyReconnect(); // silent
        if (mounted) setState((s) => ({ ...s, connected: reconnected }));
      } else {
        if (mounted) setState((s) => ({ ...s, connected: ok }));
      }
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
      Alert.alert("Expo Go Not Supported", "Spotify Remote requires a custom development build.", [{ text: "OK" }]);
      return;
    }

    const spotifyInstalled = await Linking.canOpenURL("spotify://").catch(() => false);
    if (!spotifyInstalled) {
      Alert.alert("Spotify Not Installed", "Install the Spotify app to use this feature.", [{ text: "OK" }]);
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
      if (raw.includes("cancel") || raw.includes("dismiss")) return;

      // Spotify isn't open/playing — give clear instructions
      if (isNotPlayingError(raw)) {
        Alert.alert(
          "Open Spotify First",
          "Spotify must be open and playing before you can connect.\n\n1. Open the Spotify app\n2. Play any song\n3. Come back and tap Spotify",
          [{ text: "Got it" }],
        );
        return;
      }

      // Generic: show only the first line of the error (the SDK stacks multiple messages)
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
    () => ({ connected: state.connected, connecting: state.connecting, error: state.error, connect, disconnect }),
    [state, connect, disconnect],
  );
}