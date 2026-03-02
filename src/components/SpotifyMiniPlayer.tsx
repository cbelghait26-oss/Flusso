// src/components/SpotifyMiniPlayer.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { s } from "../ui/ts";
import {
  getPlayerState,
  spotifyPause,
  spotifyResume,
  spotifySkipNext,
  spotifySkipPrevious,
  spotifySeek,
  spotifySetShuffle,
  spotifySetRepeat,
  spotifyPlay,
  spotifyAddToQueue,
  spotifyGetQueue,
  spotifyGetPlaylists,
  spotifyGetPlaylistTracks,
  spotifyGetSavedTracks,
  nextRepeatMode,
  type RepeatMode,
  type QueueTrack,
  type SpotifyPlaylist,
  type SpotifyTrack,
} from "../services/SpotifyRemote";

// ─── Public type ──────────────────────────────────────────────────────────────

export type TrackInfo = {
  name:         string;
  artist:       string;
  albumArtUrl:  string | null;
  trackUri:     string | null;
  isPaused:     boolean;
  durationMs:   number;
  positionMs:   number;
  shuffleState: boolean;
  repeatState:  RepeatMode;
};

// ─── Seekable progress bar ────────────────────────────────────────────────────
// Uses pageX + absolute screen measurement to avoid coordinate-space bugs
// that happen inside Animated.View / overflow:hidden containers.

function ProgressBar({
  positionMs,
  durationMs,
  isPaused,
  onSeek,
}: {
  positionMs: number;
  durationMs: number;
  isPaused:   boolean;
  onSeek:     (ms: number) => void;
}) {
  const [localPos, setLocalPos] = useState(positionMs);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const barRef      = useRef<View>(null);
  // Absolute screen position + width of the bar, populated on layout/mount
  const barLayout   = useRef({ x: 0, width: 1 });

  // Keep localPos in sync when not dragging
  useEffect(() => {
    if (!draggingRef.current) setLocalPos(positionMs);
  }, [positionMs]);

  // Local tick while playing
  useEffect(() => {
    if (isPaused || durationMs <= 0 || dragging) return;
    const id = setInterval(
      () => setLocalPos((p) => Math.min(p + 1000, durationMs)),
      1000,
    );
    return () => clearInterval(id);
  }, [isPaused, durationMs, positionMs, dragging]);

  // Re-measure on every layout change (orientation, scroll, etc.)
  const measureBar = () => {
    barRef.current?.measureInWindow((x, _y, width) => {
      if (width > 0) barLayout.current = { x, width };
    });
  };

  const pageXToMs = (pageX: number): number => {
    const { x, width } = barLayout.current;
    const ratio = Math.max(0, Math.min(1, (pageX - x) / width));
    return Math.round(ratio * durationMs);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => durationMs > 0,
      onStartShouldSetPanResponderCapture: () => durationMs > 0,
      onMoveShouldSetPanResponder:         () => durationMs > 0,
      onPanResponderGrant: (evt) => {
        // Re-measure just before the user interacts, in case layout shifted
        barRef.current?.measureInWindow((x, _y, width) => {
          if (width > 0) barLayout.current = { x, width };
          draggingRef.current = true;
          setDragging(true);
          setLocalPos(pageXToMs(evt.nativeEvent.pageX));
        });
      },
      onPanResponderMove: (evt) => {
        setLocalPos(pageXToMs(evt.nativeEvent.pageX));
      },
      onPanResponderRelease: (evt) => {
        const ms = pageXToMs(evt.nativeEvent.pageX);
        setLocalPos(ms);
        onSeek(ms);
        // Hold the drag lock so the 3-sec poll doesn't snap back
        setTimeout(() => {
          draggingRef.current = false;
          setDragging(false);
        }, 1000);
      },
      onPanResponderTerminate: () => {
        draggingRef.current = false;
        setDragging(false);
      },
    }),
  ).current;

  const pct = durationMs > 0 ? Math.min(localPos / durationMs, 1) * 100 : 0;

  const fmt = (ms: number) => {
    const t = Math.floor(ms / 1000);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  };

  return (
    <View style={pb.wrap}>
      {/* Tall transparent hit area — easier to grab on small screens */}
      <View style={pb.hitArea} {...panResponder.panHandlers}>
        <View
          ref={barRef}
          onLayout={measureBar}
          style={pb.track}
        >
          <View style={[pb.fill, { width: `${pct}%` as any }]} />
          <View
            style={[
              pb.thumb,
              { left: `${pct}%` as any },
              dragging && pb.thumbActive,
            ]}
          />
        </View>
      </View>
      <View style={pb.times}>
        <Text style={pb.time}>{fmt(localPos)}</Text>
        <Text style={pb.time}>{fmt(durationMs)}</Text>
      </View>
    </View>
  );
}

const pb = StyleSheet.create({
  wrap:    { paddingTop: s(4), paddingBottom: s(2) },
  hitArea: { height: s(28), justifyContent: "center" },
  track: {
    height: s(4), borderRadius: s(999),
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "visible", position: "relative",
  },
  fill: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    backgroundColor: "#1DB954", borderRadius: s(999),
  },
  thumb: {
    position: "absolute",
    top: -s(4),
    marginLeft: -s(6),
    width: s(12), height: s(12), borderRadius: s(999),
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.35,
    shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  thumbActive: {
    width: s(18), height: s(18),
    top: -s(7), marginLeft: -s(9),
    backgroundColor: "#1DB954",
  },
  times: { flexDirection: "row", justifyContent: "space-between", marginTop: s(4) },
  time:  { color: "rgba(255,255,255,0.38)", fontSize: s(10), fontWeight: "600" },
});

// ─── Shared track row ─────────────────────────────────────────────────────────

function TrackRow({
  track,
  index,
  onPlay,
  onQueue,
  isQueued,
  showIndex,
  currentlyPlayingUri,
}: {
  track:               SpotifyTrack | QueueTrack;
  index?:              number;
  onPlay?:             (uri: string) => void;
  onQueue?:            (uri: string) => void;
  isQueued?:           boolean;
  showIndex?:          boolean;
  currentlyPlayingUri?: string | null;
}) {
  const isPlaying = currentlyPlayingUri === track.uri;

  const fmtDur = (ms: number) => {
    const t = Math.floor(ms / 1000);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  };

  return (
    <Pressable
      onPress={() => onPlay?.(track.uri)}
      style={({ pressed }) => [
        tr.row,
        isPlaying && tr.rowActive,
        { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {showIndex && index !== undefined && (
        <Text style={[tr.index, isPlaying && { color: "#1DB954" }]}>
          {isPlaying ? "▶" : index + 1}
        </Text>
      )}
      {track.artUrl
        ? <Image source={{ uri: track.artUrl }} style={tr.art} />
        : <View style={[tr.art, tr.artFallback]}>
            <Ionicons name="musical-note" size={s(12)} color="rgba(255,255,255,0.3)" />
          </View>
      }
      <View style={tr.info}>
        <Text style={[tr.name, isPlaying && { color: "#1DB954" }]} numberOfLines={1}>
          {track.name}
        </Text>
        <Text style={tr.sub} numberOfLines={1}>
          {"artistName" in track ? track.artistName : ""} · {fmtDur(track.durationMs)}
        </Text>
      </View>
      {onQueue && (
        <Pressable
          onPress={(e) => { e.stopPropagation(); onQueue(track.uri); }}
          style={({ pressed }) => [tr.queueBtn, {
            opacity: pressed ? 0.6 : 1,
            backgroundColor: isQueued ? "rgba(29,185,84,0.18)" : "rgba(255,255,255,0.07)",
            borderColor:     isQueued ? "rgba(29,185,84,0.45)" : "rgba(255,255,255,0.12)",
          }]}
        >
          <Ionicons
            name={isQueued ? "checkmark" : "add"}
            size={s(13)}
            color={isQueued ? "#1DB954" : "rgba(255,255,255,0.6)"}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

const tr = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: s(10),
    paddingVertical: s(8), paddingHorizontal: s(10),
    borderRadius: s(10),
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: s(1), borderColor: "rgba(255,255,255,0.07)",
  },
  rowActive: {
    backgroundColor: "rgba(29,185,84,0.08)",
    borderColor: "rgba(29,185,84,0.25)",
  },
  index:      { color: "rgba(255,255,255,0.3)", fontWeight: "800", fontSize: s(11), width: s(18), textAlign: "center" },
  art:        { width: s(36), height: s(36), borderRadius: s(6) },
  artFallback:{ backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  info:       { flex: 1 },
  name:       { color: "#fff", fontWeight: "800", fontSize: s(13) },
  sub:        { color: "rgba(255,255,255,0.45)", fontWeight: "600", fontSize: s(11), marginTop: s(1) },
  queueBtn: {
    width: s(28), height: s(28), borderRadius: s(999),
    alignItems: "center", justifyContent: "center", borderWidth: s(1),
  },
});

// ─── Library modal ────────────────────────────────────────────────────────────

type LibraryTab  = "playlists" | "tracks" | "queue";
type ModalView   = { kind: "tabs" } | { kind: "playlist"; playlist: SpotifyPlaylist };

function LibraryModal({
  visible,
  currentTrackUri,
  onClose,
  onPlayContext,
  onPlayTrack,
  onQueueTrack,
}: {
  visible:         boolean;
  currentTrackUri: string | null;
  onClose:         () => void;
  onPlayContext:   (uri: string) => void;
  onPlayTrack:     (uri: string) => void;
  onQueueTrack:    (uri: string) => void;
}) {
  const [tab,             setTab]             = useState<LibraryTab>("playlists");
  const [view,            setView]            = useState<ModalView>({ kind: "tabs" });
  const [playlists,       setPlaylists]       = useState<SpotifyPlaylist[]>([]);
  const [savedTracks,     setSavedTracks]     = useState<SpotifyTrack[]>([]);
  const [playlistTracks,  setPlaylistTracks]  = useState<SpotifyTrack[]>([]);
  const [queue,           setQueue]           = useState<QueueTrack[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [queued,          setQueued]          = useState<Set<string>>(new Set());

  const loadTab = useCallback(async (t: LibraryTab) => {
    setLoading(true);
    try {
      if (t === "playlists") setPlaylists(await spotifyGetPlaylists());
      if (t === "tracks")    setSavedTracks((await spotifyGetSavedTracks()).tracks);
      if (t === "queue")     setQueue(await spotifyGetQueue());
    } finally {
      setLoading(false);
    }
  }, []);

  const openPlaylist = useCallback(async (playlist: SpotifyPlaylist) => {
    setView({ kind: "playlist", playlist });
    setLoading(true);
    try {
      const result = await spotifyGetPlaylistTracks(playlist.id);
      setPlaylistTracks(result.tracks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setView({ kind: "tabs" });
      setQueued(new Set());
      loadTab("playlists");
    }
  }, [visible]);

  const switchTab = (t: LibraryTab) => {
    setTab(t);
    setView({ kind: "tabs" });
    loadTab(t);
  };

  const handleQueue = async (uri: string) => {
    await onQueueTrack(uri);
    setQueued((prev) => new Set(prev).add(uri));
  };

  const handlePlayTrack = (uri: string) => { onPlayTrack(uri); onClose(); };
  const handlePlayContext = (uri: string) => { onPlayContext(uri); onClose(); };

  const TABS: { key: LibraryTab; label: string; icon: any }[] = [
    { key: "playlists", label: "Playlists", icon: "list"         },
    { key: "tracks",    label: "Liked",     icon: "heart"        },
    { key: "queue",     label: "Up Next",   icon: "play-forward" },
  ];

  const isPlaylistView = view.kind === "playlist";
  const activePlaylist = isPlaylistView ? (view as any).playlist as SpotifyPlaylist : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={lm.backdrop} onPress={onClose} />
      <View style={lm.sheet}>
        <View style={lm.handle} />

        {/* Header */}
        <View style={lm.header}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: s(8) }}>
            {isPlaylistView && (
              <Pressable
                onPress={() => setView({ kind: "tabs" })}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="chevron-back" size={s(22)} color="#fff" />
              </Pressable>
            )}
            <Text style={lm.title} numberOfLines={1}>
              {isPlaylistView ? activePlaylist!.name : "Spotify Library"}
            </Text>
          </View>
          <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="close" size={s(22)} color="#fff" />
          </Pressable>
        </View>

        {/* Tabs (hidden during playlist drill-down) */}
        {!isPlaylistView && (
          <View style={lm.tabs}>
            {TABS.map(({ key, label, icon }) => (
              <Pressable
                key={key}
                onPress={() => switchTab(key)}
                style={({ pressed }) => [lm.tab, {
                  backgroundColor: tab === key ? "rgba(29,185,84,0.18)" : "rgba(255,255,255,0.07)",
                  borderColor:     tab === key ? "rgba(29,185,84,0.45)" : "rgba(255,255,255,0.12)",
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Ionicons name={icon} size={s(13)} color={tab === key ? "#1DB954" : "rgba(255,255,255,0.5)"} />
                <Text style={[lm.tabText, { color: tab === key ? "#1DB954" : "rgba(255,255,255,0.5)" }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Play playlist button */}
        {isPlaylistView && !loading && (
          <Pressable
            onPress={() => handlePlayContext(activePlaylist!.uri)}
            style={({ pressed }) => [lm.playAllBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="play" size={s(15)} color="#fff" />
            <Text style={lm.playAllText}>Play Playlist</Text>
          </Pressable>
        )}

        {/* Content */}
        {loading ? (
          <View style={lm.center}>
            <ActivityIndicator color="#1DB954" size="large" />
          </View>
        ) : (
          <>
            {/* Playlist list */}
            {!isPlaylistView && tab === "playlists" && (
              <FlatList
                data={playlists}
                keyExtractor={(p) => p.id}
                style={lm.list}
                contentContainerStyle={{ gap: s(8), paddingBottom: s(16) }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={lm.empty}>No playlists found</Text>}
                renderItem={({ item: p }) => (
                  <Pressable
                    onPress={() => openPlaylist(p)}
                    style={({ pressed }) => [lm.playlistRow, { opacity: pressed ? 0.8 : 1 }]}
                  >
                    {p.artUrl
                      ? <Image source={{ uri: p.artUrl }} style={lm.playlistArt} />
                      : <View style={[lm.playlistArt, lm.artFallback]}>
                          <Ionicons name="musical-notes" size={s(18)} color="rgba(255,255,255,0.3)" />
                        </View>
                    }
                    <View style={lm.playlistInfo}>
                      <Text style={lm.playlistName} numberOfLines={1}>{p.name}</Text>
                      <Text style={lm.playlistSub}>{p.trackCount} tracks · {p.owner}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={s(16)} color="rgba(255,255,255,0.3)" />
                  </Pressable>
                )}
              />
            )}

            {/* Playlist tracks */}
            {isPlaylistView && (
              <FlatList
                data={playlistTracks}
                keyExtractor={(t, i) => `${t.uri}-${i}`}
                style={lm.list}
                contentContainerStyle={{ gap: s(6), paddingBottom: s(16) }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={lm.empty}>No tracks found</Text>}
                renderItem={({ item: t, index }) => (
                  <TrackRow
                    track={t}
                    index={index}
                    showIndex
                    onPlay={handlePlayTrack}
                    onQueue={handleQueue}
                    isQueued={queued.has(t.uri)}
                    currentlyPlayingUri={currentTrackUri}
                  />
                )}
              />
            )}

            {/* Liked songs */}
            {!isPlaylistView && tab === "tracks" && (
              <FlatList
                data={savedTracks}
                keyExtractor={(t) => t.uri}
                style={lm.list}
                contentContainerStyle={{ gap: s(6), paddingBottom: s(16) }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={lm.empty}>No saved tracks found</Text>}
                renderItem={({ item: t, index }) => (
                  <TrackRow
                    track={t}
                    index={index}
                    showIndex
                    onPlay={handlePlayTrack}
                    onQueue={handleQueue}
                    isQueued={queued.has(t.uri)}
                    currentlyPlayingUri={currentTrackUri}
                  />
                )}
              />
            )}

            {/* Queue */}
            {!isPlaylistView && tab === "queue" && (
              <FlatList
                data={queue}
                keyExtractor={(t, i) => `${t.uri}-${i}`}
                style={lm.list}
                contentContainerStyle={{ gap: s(6), paddingBottom: s(16) }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={lm.empty}>Queue is empty</Text>}
                renderItem={({ item: t, index }) => (
                  <TrackRow
                    track={t}
                    index={index}
                    showIndex
                    onPlay={handlePlayTrack}
                    currentlyPlayingUri={currentTrackUri}
                  />
                )}
              />
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const lm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: "rgba(12,16,24,0.98)",
    borderTopLeftRadius: s(22), borderTopRightRadius: s(22),
    borderWidth: s(1), borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: s(16), paddingTop: s(10), paddingBottom: s(32),
    maxHeight: "82%",
  },
  handle: {
    width: s(40), height: s(4), borderRadius: s(999),
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center", marginBottom: s(10),
  },
  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: s(14),
  },
  title:    { color: "#fff", fontWeight: "900", fontSize: s(15) },
  tabs:     { flexDirection: "row", gap: s(8), marginBottom: s(12) },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: s(5), paddingVertical: s(9), borderRadius: s(12), borderWidth: s(1),
  },
  tabText: { fontWeight: "800", fontSize: s(12) },
  playAllBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: s(8), paddingVertical: s(10), marginBottom: s(10),
    borderRadius: s(12), backgroundColor: "rgba(29,185,84,0.2)",
    borderWidth: s(1), borderColor: "rgba(29,185,84,0.4)",
  },
  playAllText:  { color: "#fff", fontWeight: "800", fontSize: s(14) },
  list:         { maxHeight: s(460) },
  center:       { height: s(200), alignItems: "center", justifyContent: "center" },
  empty:        { color: "rgba(255,255,255,0.4)", fontSize: s(13), fontWeight: "700", textAlign: "center", paddingVertical: s(40) },
  playlistRow: {
    flexDirection: "row", alignItems: "center", gap: s(12),
    paddingVertical: s(8), paddingHorizontal: s(10),
    borderRadius: s(12), backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: s(1), borderColor: "rgba(255,255,255,0.07)",
  },
  playlistArt:  { width: s(50), height: s(50), borderRadius: s(8) },
  artFallback:  { backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  playlistInfo: { flex: 1 },
  playlistName: { color: "#fff", fontWeight: "800", fontSize: s(14) },
  playlistSub:  { color: "rgba(255,255,255,0.45)", fontWeight: "600", fontSize: s(11), marginTop: s(2) },
});

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onTrackChange?: (track: TrackInfo | null) => void;
  isLandscape?:   boolean;
}

const POLL_INTERVAL_MS = 3000;

export function SpotifyMiniPlayer({ onTrackChange, isLandscape = false }: Props) {
  const [track,    setTrack]    = useState<TrackInfo | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [library,  setLibrary]  = useState(false);

  const expandAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyState = (ps: Awaited<ReturnType<typeof getPlayerState>>) => {
    if (!ps || !mountedRef.current) return;
    const t: TrackInfo = {
      name:         ps.trackName,
      artist:       ps.artistName,
      albumArtUrl:  ps.albumArtUrl,
      trackUri:     ps.trackUri,
      isPaused:     !ps.isPlaying,
      durationMs:   ps.durationMs,
      positionMs:   ps.positionMs,
      shuffleState: ps.shuffleState,
      repeatState:  ps.repeatState,
    };
    setTrack(t);
    onTrackChange?.(t);
  };

  const poll = useCallback(async () => {
    const ps = await getPlayerState();
    if (!mountedRef.current) return;
    if (ps) applyState(ps);
    else { setTrack(null); onTrackChange?.(null); }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: expanded ? 1 : 0, useNativeDriver: false, tension: 90, friction: 14,
    }).start();
  }, [expanded]);

  const expandedHeight = isLandscape ? s(80) : s(210);
  const controlsH   = expandAnim.interpolate({ inputRange: [0,1], outputRange: [0, expandedHeight] });
  const ctrlOpacity = expandAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const chevron     = expandAnim.interpolate({ inputRange: [0,1], outputRange: ["0deg","180deg"] });

  const cmd = (fn: () => Promise<void>) => async () => { await fn(); setTimeout(poll, 400); };

  const prev          = cmd(spotifySkipPrevious);
  const next          = cmd(spotifySkipNext);
  const toggle        = cmd(() => track?.isPaused ? spotifyResume() : spotifyPause());
  const toggleShuffle = cmd(() => spotifySetShuffle(!track?.shuffleState));
  const toggleRepeat  = cmd(() => spotifySetRepeat(nextRepeatMode(track?.repeatState ?? "off")));

  const seek = async (ms: number) => { await spotifySeek(ms); setTimeout(poll, 1000); };

  const repeatActive = track?.repeatState !== "off";
  const openSpotify  = () =>
    Linking.openURL("spotify://").catch(() => Linking.openURL("https://open.spotify.com"));

  return (
    <>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.96 : 1 }]}
      >
        {/* Collapsed row */}
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
            <Text style={styles.trackName} numberOfLines={1}>{track?.name  || "Spotify"}</Text>
            <Text style={styles.artist}    numberOfLines={1}>{track?.artist || "Now playing"}</Text>
          </View>

          <Pressable
            onPress={(e) => { e.stopPropagation(); toggle(); }}
            style={({ pressed }) => [styles.quickBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name={track?.isPaused ? "play" : "pause"} size={s(16)} color="#fff" />
          </Pressable>

          <Animated.View style={{ transform: [{ rotate: chevron }] }}>
            <Ionicons name="chevron-down" size={s(14)} color="rgba(255,255,255,0.45)" />
          </Animated.View>
        </View>

        {/* Expanded area */}
        <Animated.View
          style={[{ overflow: "hidden" }, { height: controlsH, opacity: ctrlOpacity }]}
          pointerEvents={expanded ? "auto" : "none"}
        >
          {!isLandscape && (
            <ProgressBar
              positionMs={track?.positionMs ?? 0}
              durationMs={track?.durationMs ?? 0}
              isPaused={track?.isPaused ?? true}
              onSeek={seek}
            />
          )}

          <View style={[styles.ctrlRow, isLandscape && { paddingTop: s(10) }]}>
            <Pressable
              onPress={(e) => { e.stopPropagation(); toggleShuffle(); }}
              style={({ pressed }) => [styles.ctrlBtnSm, {
                opacity: pressed ? 0.6 : 1,
                borderColor: track?.shuffleState ? "rgba(29,185,84,0.5)" : "rgba(255,255,255,0.12)",
              }]}
            >
              <Ionicons
                name="shuffle"
                size={s(15)}
                color={track?.shuffleState ? "#1DB954" : "rgba(255,255,255,0.4)"}
              />
            </Pressable>

            <Pressable
              onPress={(e) => { e.stopPropagation(); prev(); }}
              style={({ pressed }) => [styles.ctrlBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="play-skip-back" size={s(18)} color="#fff" />
            </Pressable>

            <Pressable
              onPress={(e) => { e.stopPropagation(); toggle(); }}
              style={({ pressed }) => [styles.ctrlBtnMain, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name={track?.isPaused ? "play" : "pause"} size={s(22)} color="#fff" />
            </Pressable>

            <Pressable
              onPress={(e) => { e.stopPropagation(); next(); }}
              style={({ pressed }) => [styles.ctrlBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="play-skip-forward" size={s(18)} color="#fff" />
            </Pressable>

            <Pressable
              onPress={(e) => { e.stopPropagation(); toggleRepeat(); }}
              style={({ pressed }) => [styles.ctrlBtnSm, {
                opacity: pressed ? 0.6 : 1,
                borderColor: repeatActive ? "rgba(29,185,84,0.5)" : "rgba(255,255,255,0.12)",
              }]}
            >
              <Ionicons name="repeat" size={s(15)} color={repeatActive ? "#1DB954" : "rgba(255,255,255,0.4)"} />
              {track?.repeatState === "track" && (
                <View style={styles.repeatBadge}>
                  <Text style={styles.repeatBadgeText}>1</Text>
                </View>
              )}
            </Pressable>
          </View>

          {!isLandscape && (
            <View style={styles.secondRow}>
              <Pressable
                onPress={(e) => { e.stopPropagation(); setLibrary(true); }}
                style={({ pressed }) => [styles.secondBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="list" size={s(14)} color="rgba(255,255,255,0.7)" />
                <Text style={styles.secondBtnText}>Library</Text>
              </Pressable>

              <Pressable
                onPress={(e) => { e.stopPropagation(); openSpotify(); }}
                style={({ pressed }) => [styles.secondBtn, {
                  opacity: pressed ? 0.7 : 1,
                  borderColor: "rgba(29,185,84,0.35)",
                }]}
              >
                <Ionicons name="open-outline" size={s(14)} color="#1DB954" />
                <Text style={[styles.secondBtnText, { color: "#76eea0" }]}>Open Spotify</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </Pressable>

      <LibraryModal
        visible={library}
        currentTrackUri={track?.trackUri ?? null}
        onClose={() => setLibrary(false)}
        onPlayContext={(uri) => { spotifyPlay(uri).then(() => setTimeout(poll, 800)); }}
        onPlayTrack={(uri)   => { spotifyPlay(undefined, uri).then(() => setTimeout(poll, 800)); }}
        onQueueTrack={(uri)  => spotifyAddToQueue(uri)}
      />
    </>
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
  quickBtn: {
    width: s(30), height: s(30), borderRadius: s(999),
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: s(1), borderColor: "rgba(255,255,255,0.14)",
  },
  ctrlRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: s(10),
    paddingTop: s(6), paddingBottom: s(4),
  },
  ctrlBtn: {
    width: s(40), height: s(40), borderRadius: s(999),
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: s(1), borderColor: "rgba(255,255,255,0.12)",
  },
  ctrlBtnSm: {
    width: s(32), height: s(32), borderRadius: s(999),
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: s(1), position: "relative",
  },
  ctrlBtnMain: {
    width: s(52), height: s(52), borderRadius: s(999),
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(29,185,84,0.22)",
    borderWidth: s(1), borderColor: "rgba(29,185,84,0.45)",
  },
  repeatBadge: {
    position: "absolute", bottom: -s(2), right: -s(2),
    width: s(12), height: s(12), borderRadius: s(999),
    backgroundColor: "#1DB954", alignItems: "center", justifyContent: "center",
  },
  repeatBadgeText: { color: "#000", fontSize: s(7), fontWeight: "900" },
  secondRow: {
    flexDirection: "row", gap: s(8),
    paddingTop: s(6), paddingBottom: s(2), justifyContent: "center",
  },
  secondBtn: {
    flexDirection: "row", alignItems: "center", gap: s(6),
    paddingVertical: s(7), paddingHorizontal: s(12),
    borderRadius: s(999), borderWidth: s(1),
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  secondBtnText: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: s(12) },
});