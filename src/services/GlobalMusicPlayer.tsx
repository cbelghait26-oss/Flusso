import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";

type GlobalMusicContextType = {
  isMuted: boolean;
  toggleMute: () => void;
  loading: boolean;
};

const GlobalMusicContext = createContext<GlobalMusicContextType>({
  isMuted: true,
  toggleMute: () => {},
  loading: true,
});

export const useGlobalMusic = () => useContext(GlobalMusicContext);

export function GlobalMusicProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMuted] = useState(true);
  const [loading, setLoading] = useState(true);

  const player = useAudioPlayer(require("../../assets/focus/ModernPiano.mp3"));

  // Track the "true" current volume in a ref so the fade always starts from
  // the right value — avoids stale reads from the native layer.
  const currentVolumeRef = useRef(0);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMutedRef = useRef(true);

  useEffect(() => {
    // Set up audio session first (best-effort — player still starts even if this fails).
    setAudioModeAsync({
      playsInSilentMode: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      interruptionModeIOS: "mixWithOthers",
      interruptionModeAndroid: "doNotMix",
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    // Configure and start the player unconditionally.
    try {
      player.loop = true;
      player.volume = 0;
      currentVolumeRef.current = 0;
      player.play();
    } catch {}

    setLoading(false);
  }, []);

  const toggleMute = () => {
    const newMuted = !isMutedRef.current;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);

    const targetVolume = newMuted ? 0 : 0.6;
    const startVolume  = currentVolumeRef.current;
    const steps = 10;
    const stepSize = (targetVolume - startVolume) / steps;
    let step = 0;

    // Cancel any in-flight fade.
    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);

    fadeTimerRef.current = setInterval(() => {
      step++;
      const nextVol = Math.min(1, Math.max(0, startVolume + stepSize * step));
      currentVolumeRef.current = nextVol;
      try { player.volume = nextVol; } catch {}
      if (step >= steps) {
        clearInterval(fadeTimerRef.current!);
        fadeTimerRef.current = null;
      }
    }, 20);
  };

  return (
    <GlobalMusicContext.Provider value={{ isMuted, toggleMute, loading }}>
      {children}
    </GlobalMusicContext.Provider>
  );
}