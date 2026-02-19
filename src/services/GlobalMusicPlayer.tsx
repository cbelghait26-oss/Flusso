import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

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
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let mounted = true;

    const initMusic = async () => {
      try {
        console.log("GlobalMusicPlayer: Initializing...");
        
        // Set audio mode to allow mixing with other apps
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
          interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          playThroughEarpieceAndroid: false,
        });
        console.log("GlobalMusicPlayer: Audio mode set");

        // Load and start the music
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/focus/ModernPiano.mp3"),
          {
            isLooping: true,
            volume: 0, // Start muted
          }
        );
        console.log("GlobalMusicPlayer: Sound loaded");

        if (mounted) {
          soundRef.current = sound;
          await sound.playAsync();
          console.log("GlobalMusicPlayer: Music playing (muted)");
          setLoading(false);
        }
      } catch (error) {
        console.error("GlobalMusicPlayer: Failed to initialize:", error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initMusic();

    return () => {
      mounted = false;
      console.log("GlobalMusicPlayer: Component unmounting");
    };
  }, []);

  const toggleMute = async () => {
    console.log("GlobalMusicPlayer: toggleMute called, current isMuted:", isMuted);
    
    if (!soundRef.current) {
      console.error("GlobalMusicPlayer: No sound reference available");
      return;
    }

    try {
      const newMutedState = !isMuted;
      const targetVolume = newMutedState ? 0 : 0.6;
      console.log("GlobalMusicPlayer: Transitioning to", newMutedState ? "muted" : "unmuted", "target volume:", targetVolume);

      // Smooth fade
      const currentStatus = await soundRef.current.getStatusAsync();
      if (currentStatus.isLoaded) {
        const currentVolume = currentStatus.volume ?? 0;
        const steps = 10;
        const volumeStep = (targetVolume - currentVolume) / steps;

        for (let i = 0; i < steps; i++) {
          const newVolume = currentVolume + volumeStep * (i + 1);
          await soundRef.current.setVolumeAsync(newVolume);
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        console.log("GlobalMusicPlayer: Volume transition complete");
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
