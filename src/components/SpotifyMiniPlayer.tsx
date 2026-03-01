// src/components/SpotifyMiniPlayer.tsx
// Web API version — no react-native-spotify-remote imports.
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { s } from "react-native-size-matters";
import {
  getPlayerState,
  spotifyPlay,
  spotifyPause,
  spotifyResume,
  spotifySkipNext,
  spotifySkipPrevious,
  spotifySeek,
} from "../services/SpotifyRemote";

// ─── Public type ──────────────────────────────────────────────────────────────

export type TrackInfo = {
  name:        string;
  artist:      string;
  albumArtUrl: string | null;
  trackUri:    string | null;
  isPaused:    boolean;
  durationMs:  number;
  positionMs:  number;
};

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({
  positionMs,
  durationMs,
  isPaused,
  onSeek,
}: {
  positionMs: number;
  durationMs: number;
  isPaused:   boolean;
  onSeek?:    (ms: number) => void;
}) {
  const [pos, setPos] = useState(positionMs);

  useEffect(() => { setPos(positionMs); }, [positionMs]);

  useEffect(() => {
    if (isPaused || durationMs <= 0) return;
    const id = setInterval(() => setPos((p) => Math.min(p + 1000, durationMs)), 1000);
    return () => clearInterval(id);
  }, [isPaused, durationMs, positionMs]);

  const pct = durationMs > 0 ? Math.min(pos / durationMs, 1) * 100 : 0;
  const fmt = (ms: number) => {
    const t = Math.floor(ms / 1000);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  };

  return (
    <View style={pb.wrap}>
      <View style={pb.track}>
        <View style={[pb.fill, { width: `${pct}%` as any }]} />
        <View style={[pb.thumb, { left: `${pct}%` as any, marginLeft: -s(5) }]} />
      </View>
      <View style={pb.times}>
        <Text style={pb.time}>{fmt(pos)}</Text>
        <Text style={pb.time}>{fmt(durationMs)}</Text>
      </View>
    </View>
  );
}

const pb = StyleSheet.create({
  wrap:  { paddingTop: s(10), paddingBottom: s(2) },
  track: {
    height: s(3), borderRadius: s(999),
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "visible", position: "relative",
  },
  fill: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    backgroundColor: "#1DB954", borderRadius: s(999),
  },
  thumb: {
    position: "absolute", top: -s(3.5),
    width: s(10), height: s(10), borderRadius: s(999),
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  times: { flexDirection: "row", justifyContent: "space-between", marginTop: s(5) },
  time:  { color: "rgba(255,255,255,0.38)", fontSize: s(10), fontWeight: "600" },
});

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onTrackChange?: (track: TrackInfo | null) => void;
  isLandscape?: boolean;
}

const POLL_INTERVAL_MS = 3000; // poll every 3 seconds

export function SpotifyMiniPlayer({ onTrackChange, isLandscape = false }: Props) {
  const [track,    setTrack]    = useState<TrackInfo | null>(null);
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Convert WebPlayerState → TrackInfo ────────────────────────────────────
  const applyState = (ps: Awaited<ReturnType<typeof getPlayerState>>) => {
    if (!ps || !mountedRef.current) return;
    const t: TrackInfo = {
      name:        ps.trackName,
      artist:      ps.artistName,
      albumArtUrl: ps.albumArtUrl,
      trackUri:    ps.trackUri,
      isPaused:    !ps.isPlaying,
      durationMs:  ps.durationMs,
      positionMs:  ps.positionMs,
    };
    setTrack(t);
    onTrackChange?.(t);
  };

  const poll = async () => {
    const ps = await getPlayerState();
    if (!mountedRef.current) return;
    if (ps) {
      applyState(ps);
    } else {
      // Nothing playing — clear track but don't unmount the player
      setTrack(null);
      onTrackChange?.(null);
    }
  };

  // ── Start polling on mount ────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    poll(); // immediate first fetch
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Expand animation ──────────────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue:     expanded ? 1 : 0,
      useNativeDriver: false,
      tension: 90,
      friction: 14,
    }).start();
  }, [expanded]);

  const controlsH   = expandAnim.interpolate({ 
    inputRange: [0, 1], 
    outputRange: [0, isLandscape ? s(60) : s(130)] 
  });
  const ctrlOpacity = expandAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });
  const chevron     = expandAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  // ── Controls ───────────────────────────────────────────────────────────────
  const prev = async () => {
    await spotifySkipPrevious();
    setTimeout(poll, 400); // re-poll after command so UI updates quickly
  };
  const next = async () => {
    await spotifySkipNext();
    setTimeout(poll, 400);
  };
  const toggle = async () => {
    if (track?.isPaused) {
      await spotifyResume();
    } else {
      await spotifyPause();
    }
    setTimeout(poll, 400);
  };
  const openSpotify = () => {
    Linking.openURL("spotify://").catch(() => Linking.openURL("https://open.spotify.com"));
  };

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.96 : 1 }]}
    >
      {/* ── Collapsed row ── */}
      <View style={styles.row}>
        <View style={styles.artWrap}>
          {track?.albumArtUrl
            ? <Image source={{ uri: track.albumArtUrl }} style={styles.art} />
            : <View style={[styles.art, styles.artFallback]}>
                <Ionicons name="musical-note" size={s(14)} color="rgba(255,255,255,0.35)" />
              </View>
          }
          {track && !track.isPaused && <View style={styles.dot} />}
        </View>

        <View style={styles.info}>
          <Text style={styles.trackName} numberOfLines={1}>
            {track?.name || "Spotify"}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {track?.artist || "Now playing"}
          </Text>
        </View>

        <Animated.View style={{ transform: [{ rotate: chevron }] }}>
          <Ionicons name="chevron-down" size={s(14)} color="rgba(255,255,255,0.45)" />
        </Animated.View>
      </View>

      {/* ── Expanded area ── */}
      <Animated.View
        style={[{ overflow: "hidden" }, { height: controlsH, opacity: ctrlOpacity }]}
        pointerEvents={expanded ? "auto" : "none"}
      >
        {!isLandscape && (
          <ProgressBar
            positionMs={track?.positionMs ?? 0}
            durationMs={track?.durationMs ?? 0}
            isPaused={track?.isPaused ?? true}
          />
        )}

        <View style={[styles.ctrlRow, isLandscape && { paddingTop: s(12) }]}>
          <Pressable onPress={prev}   style={({ pressed }) => [styles.ctrlBtn,     { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="play-skip-back"    size={s(18)} color="#fff" />
          </Pressable>
          <Pressable onPress={toggle} style={({ pressed }) => [styles.ctrlBtnMain, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name={track?.isPaused ? "play" : "pause"} size={s(20)} color="#fff" />
          </Pressable>
          <Pressable onPress={next}   style={({ pressed }) => [styles.ctrlBtn,     { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="play-skip-forward" size={s(18)} color="#fff" />
          </Pressable>
          {!isLandscape && (
            <Pressable
              onPress={openSpotify}
              style={({ pressed }) => [styles.ctrlBtn, { opacity: pressed ? 0.6 : 1, borderColor: "rgba(29,185,84,0.4)" }]}
            >
              <Ionicons name="open-outline" size={s(16)} color="#1DB954" />
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: s(16), borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: s(12), paddingVertical: s(10),
    overflow: "hidden",
  },
  row:         { flexDirection: "row", alignItems: "center", gap: s(10) },
  artWrap:     { position: "relative" },
  art:         { width: s(38), height: s(38), borderRadius: s(8) },
  artFallback: { backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  dot: {
    position: "absolute", bottom: -s(2), right: -s(2),
    width: s(9), height: s(9), borderRadius: s(999),
    backgroundColor: "#1DB954", borderWidth: s(1.5), borderColor: "rgba(10,14,20,0.95)",
  },
  info:      { flex: 1, gap: s(2) },
  trackName: { color: "#fff", fontWeight: "800", fontSize: s(13) },
  artist:    { color: "rgba(255,255,255,0.55)", fontWeight: "600", fontSize: s(11) },
  ctrlRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: s(12),
    paddingTop: s(8), paddingBottom: s(2),
  },
  ctrlBtn: {
    width: s(40), height: s(40), borderRadius: s(999),
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: s(1), borderColor: "rgba(255,255,255,0.12)",
  },
  ctrlBtnMain: {
    width: s(48), height: s(48), borderRadius: s(999),
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(29,185,84,0.22)",
    borderWidth: s(1), borderColor: "rgba(29,185,84,0.45)",
  },
});