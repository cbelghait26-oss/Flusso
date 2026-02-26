// src/components/SpotifyMiniPlayer.tsx
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { s } from "react-native-size-matters";
import { remote } from "react-native-spotify-remote";

type Track = {
  name?: string;
  artist?: string;
  isPaused?: boolean;
};

export function SpotifyMiniPlayer() {
  const [track, setTrack] = useState<Track>({});

  const refresh = async () => {
    try {
      const playerState = await remote.getPlayerState();
      const t = playerState?.track;

      setTrack({
        name: t?.name ?? "",
        artist: t?.artist?.name ?? "",
        isPaused: playerState?.isPaused ?? true,
      });
    } catch {
      setTrack({});
    }
  };

  useEffect(() => {
    let interval: any;
    (async () => {
      try {
        const isConnected = await remote.isConnectedAsync();
        if (isConnected) {
          await refresh();
          interval = setInterval(refresh, 1500);
        }
      } catch {}
    })();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const onPrev = async () => {
    try {
      await remote.skipToPrevious();
      await refresh();
    } catch {}
  };

  const onNext = async () => {
    try {
      await remote.skipToNext();
      await refresh();
    } catch {}
  };

  const onToggle = async () => {
    try {
      if (track.isPaused) {
        await remote.resume();
      } else {
        await remote.pause();
      }
      await refresh();
    } catch {}
  };

  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {track.name || "Spotify"}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {track.artist || "Connect to control music"}
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable onPress={onPrev} style={styles.btn}>
          <Ionicons name="play-skip-back" size={s(18)} color="#fff" />
        </Pressable>
        <Pressable onPress={onToggle} style={styles.btn}>
          <Ionicons
            name={track.isPaused ? "play" : "pause"}
            size={s(18)}
            color="#fff"
          />
        </Pressable>
        <Pressable onPress={onNext} style={styles.btn}>
          <Ionicons name="play-skip-forward" size={s(18)} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(12),
    paddingVertical: s(12),
    paddingHorizontal: s(14),
    borderRadius: s(16),
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  title: { color: "#fff", fontWeight: "900", fontSize: s(13) },
  sub: { color: "rgba(255,255,255,0.65)", fontWeight: "800", fontSize: s(11), marginTop: s(2) },
  controls: { flexDirection: "row", gap: s(8) },
  btn: {
    width: s(36),
    height: s(36),
    borderRadius: s(999),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.14)",
  },
});
