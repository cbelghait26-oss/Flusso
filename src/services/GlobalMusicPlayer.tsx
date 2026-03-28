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

  useEffect(() => {
    const initMusic = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
          interruptionModeIOS: "mixWithOthers",
          interruptionModeAndroid: "doNotMix",
          playThroughEarpieceAndroid: false,
        });

        player.loop = true;
        player.volume = 0;
        player.play();
        setLoading(false);
      } catch (error) {
        console.error("GlobalMusicPlayer: Failed to initialize:", error);
        setLoading(false);
      }
    };

    initMusic();
  }, []);

  const toggleMute = async () => {
    try {
      const newMutedState = !isMuted;
      const targetVolume = newMutedState ? 0 : 0.6;
      const currentVolume = player.volume ?? 0;
      const steps = 10;
      const volumeStep = (targetVolume - currentVolume) / steps;

      for (let i = 0; i < steps; i++) {
        player.volume = currentVolume + volumeStep * (i + 1);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      setIsMuted(newMutedState);
    } catch (error) {
      console.error("GlobalMusicPlayer: Failed to toggle mute:", error);
    }
  };

  return (
    <GlobalMusicContext.Provider value={{ isMuted, toggleMute, loading }}>
      {children}
    </GlobalMusicContext.Provider>
  );
}