// src/hooks/useSpotifyRemote.ts
// Web API version — no native SDK, no App Remote connection required.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, AppStateStatus, Linking } from "react-native";
import Constants from "expo-constants";
import {
  spotifyConnectFull,
  spotifyDisconnect,
  spotifyIsConnected,
  spotifyLoadSavedTokens,
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
  // App.tsx calls spotifyLoadSavedTokens() without await, so tokens may not
  // yet be hydrated when this hook mounts. Load them here if needed.
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!hasStoredCredentials()) {
        await spotifyLoadSavedTokens();
      }
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

    // Lock against double-taps before the async pre-flight dialog
    connectingRef.current = true;

    // Pre-flight prompt: remind user to have Spotify open and playing
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Before You Connect",
        "For the best experience:\n\n1. Open the Spotify app\n2. Start playing any song\n3. Come back and tap \"I'm Ready\"\n\nYou only need to do this once — your account will stay linked.",
        [
          {
            text: "Open Spotify",
            onPress: () => {
              Linking.openURL("spotify://").catch(() =>
                Linking.openURL("https://open.spotify.com")
              );
              resolve(false); // let user return to app manually
            },
          },
          { text: "I'm Ready", onPress: () => resolve(true) },
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        ],
      );
    });
    if (!proceed) {
      connectingRef.current = false;
      return;
    }

    try {
      setState((s) => ({ ...s, connecting: true, error: null }));
      await spotifyConnectFull();
      setState({ connected: true, connecting: false, error: null });
    } catch (e: any) {
      const raw: string = e?.message ?? "";

      // No active device — auth is fine, tokens are saved, just no music playing.
      // Mark as connected so the mini-player shows up, and prompt the user to play something.
      if (raw === "no_active_device") {
        setState({ connected: true, connecting: false, error: null });
        Alert.alert(
          "Open Spotify First",
          "Your account is connected! To finish setup:\n\n1. Open the Spotify app\n2. Play any song\n3. Come back — the mini-player will appear automatically.",
          [
            {
              text: "Open Spotify",
              onPress: () => {
                const { Linking } = require("react-native");
                Linking.openURL("spotify://").catch(() => Linking.openURL("https://open.spotify.com"));
              },
            },
            { text: "OK", style: "cancel" },
          ],
        );
        connectingRef.current = false;
        return;
      }

      setState({ connected: false, connecting: false, error: raw });

      // User closed the browser — no noise
      if (raw.toLowerCase().includes("cancel") || raw.toLowerCase().includes("dismiss")) {
        connectingRef.current = false;
        return;
      }

      // Spotify Web API unreachable — probably no active device
      if (raw.includes("Web API unreachable")) {
        Alert.alert(
          "Open Spotify First",
          "Open the Spotify app and play a song, then come back and tap Spotify again.",
          [{ text: "Got it" }],
        );
        connectingRef.current = false;
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