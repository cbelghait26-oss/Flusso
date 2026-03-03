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
  refreshAccessToken,
  nextRepeatMode,
  type RepeatMode,
  type QueueTrack,
  type SpotifyPlaylist,
  type SpotifyTrack,
} from "../services/SpotifyRemote";

export type TrackInfo = {
  name: string; artist: string; albumArtUrl: string | null;
  trackUri: string | null; isPaused: boolean;
  durationMs: number; positionMs: number;
  shuffleState: boolean; repeatState: RepeatMode;
};

// ─── ProgressBar ──────────────────────────────────────────────────────────────
// KEY RULES for seek to work:
//   1. The <View> containing this component must NOT have overflow:"hidden"
//   2. measureInWindow is called at gesture start to get fresh coords
//   3. We use pageX (screen-absolute) not locationX (local-relative)

function ProgressBar({
  positionMs, durationMs, isPaused, onSeek,
}: {
  positionMs: number; durationMs: number; isPaused: boolean; onSeek: (ms: number) => void;
}) {
  const [localPos, setLocalPos] = useState(positionMs);
  const [dragging, setDragging] = useState(false);
  const draggingRef    = useRef(false);
  const barRef         = useRef<View>(null);
  const barX           = useRef(0);
  const barW           = useRef(1);
  // Keep latest durationMs and onSeek in refs so the PanResponder (created once)
  // always reads the current values — avoids the stale-closure / durationMs=0 bug.
  const durationMsRef  = useRef(durationMs);
  const onSeekRef      = useRef(onSeek);
  useEffect(() => { durationMsRef.current = durationMs; }, [durationMs]);
  useEffect(() => { onSeekRef.current = onSeek; }, [onSeek]);

  useEffect(() => { if (!draggingRef.current) setLocalPos(positionMs); }, [positionMs]);

  useEffect(() => {
    if (isPaused || durationMs <= 0 || dragging) return;
    const id = setInterval(() => setLocalPos((p) => Math.min(p + 1000, durationMsRef.current)), 1000);
    return () => clearInterval(id);
  }, [isPaused, durationMs, positionMs, dragging]);

  // Always reads from refs — safe inside the once-created PanResponder
  const toMs = (pageX: number) => {
    const dur = durationMsRef.current;
    if (dur <= 0) return 0;
    return Math.round(Math.max(0, Math.min(1, (pageX - barX.current) / barW.current)) * dur);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => durationMsRef.current > 0,
      onStartShouldSetPanResponderCapture: () => durationMsRef.current > 0,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,
      onPanResponderGrant: (evt) => {
        // MUST read pageX synchronously — React Native recycles the event object
        // and nativeEvent becomes null inside any async callback.
        const pageX = evt.nativeEvent.pageX;
        barRef.current?.measureInWindow((x, _y, w) => {
          if (w > 0) { barX.current = x; barW.current = w; }
          draggingRef.current = true;
          setDragging(true);
          setLocalPos(toMs(pageX));
        });
      },
      onPanResponderMove: (evt) => {
        setLocalPos(toMs(evt.nativeEvent.pageX));
      },
      onPanResponderRelease: (evt) => {
        const pageX = evt.nativeEvent.pageX; // capture sync
        const ms = toMs(pageX);
        setLocalPos(ms);
        onSeekRef.current(ms);
        setTimeout(() => { draggingRef.current = false; setDragging(false); }, 1200);
      },
      onPanResponderTerminate: () => { draggingRef.current = false; setDragging(false); },
    }),
  ).current;

  const pct = durationMs > 0 ? Math.min(localPos / durationMs, 1) * 100 : 0;
  const fmt = (ms: number) => {
    const t = Math.floor(ms / 1000);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  };

  return (
    <View style={pb.wrap}>
      {/* Tall hit area — makes it easy to grab on small screens */}
      <View style={pb.hitArea} {...panResponder.panHandlers}>
        <View ref={barRef} onLayout={() => {
          // Re-measure whenever the bar is laid out (first render, orientation change)
          barRef.current?.measureInWindow((x, _y, w) => {
            if (w > 0) { barX.current = x; barW.current = w; }
          });
        }} style={pb.track}>
          <View style={[pb.fill, { width: `${pct}%` as any }]} />
          <View style={[pb.thumb, { left: `${pct}%` as any }, dragging && pb.thumbActive]} />
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
  wrap:    { paddingTop: s(6), paddingBottom: s(2) },
  hitArea: { height: s(30), justifyContent: "center" },
  track: {
    height: s(4), borderRadius: s(999),
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "visible", position: "relative",
  },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#1DB954", borderRadius: s(999) },
  thumb: {
    position: "absolute", top: -s(4), marginLeft: -s(6),
    width: s(12), height: s(12), borderRadius: s(999), backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  thumbActive: { width: s(20), height: s(20), top: -s(8), marginLeft: -s(10), backgroundColor: "#1DB954" },
  times: { flexDirection: "row", justifyContent: "space-between", marginTop: s(4) },
  time:  { color: "rgba(255,255,255,0.38)", fontSize: s(10), fontWeight: "600" },
});

// ─── TrackRow ─────────────────────────────────────────────────────────────────

function TrackRow({
  track, index, onPlay, onQueue, isQueued, showIndex, currentlyPlayingUri,
}: {
  track: SpotifyTrack | QueueTrack; index?: number;
  onPlay?: (uri: string) => void; onQueue?: (uri: string) => void;
  isQueued?: boolean; showIndex?: boolean; currentlyPlayingUri?: string | null;
}) {
  const isPlaying = currentlyPlayingUri === track.uri;
  const fmt = (ms: number) => { const t = Math.floor(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

  return (
    <Pressable
      onPress={() => onPlay?.(track.uri)}
      style={({ pressed }) => [tr.row, isPlaying && tr.rowActive, { opacity: pressed ? 0.75 : 1 }]}
    >
      {showIndex && index !== undefined && (
        <Text style={[tr.index, isPlaying && { color: "#1DB954" }]}>{isPlaying ? "▶" : index + 1}</Text>
      )}
      {track.artUrl
        ? <Image source={{ uri: track.artUrl }} style={tr.art} />
        : <View style={[tr.art, tr.artFallback]}><Ionicons name="musical-note" size={s(12)} color="rgba(255,255,255,0.3)" /></View>
      }
      <View style={tr.info}>
        <Text style={[tr.name, isPlaying && { color: "#1DB954" }]} numberOfLines={1}>{track.name}</Text>
        <Text style={tr.sub} numberOfLines={1}>{"artistName" in track ? track.artistName : ""} · {fmt(track.durationMs)}</Text>
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
          <Ionicons name={isQueued ? "checkmark" : "add"} size={s(13)} color={isQueued ? "#1DB954" : "rgba(255,255,255,0.6)"} />
        </Pressable>
      )}
    </Pressable>
  );
}

const tr = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", gap: s(10), paddingVertical: s(8), paddingHorizontal: s(10), borderRadius: s(10), backgroundColor: "rgba(255,255,255,0.04)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.07)" },
  rowActive:  { backgroundColor: "rgba(29,185,84,0.08)", borderColor: "rgba(29,185,84,0.25)" },
  index:      { color: "rgba(255,255,255,0.3)", fontWeight: "800", fontSize: s(11), width: s(18), textAlign: "center" },
  art:        { width: s(36), height: s(36), borderRadius: s(6) },
  artFallback:{ backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  info:       { flex: 1 },
  name:       { color: "#fff", fontWeight: "800", fontSize: s(13) },
  sub:        { color: "rgba(255,255,255,0.45)", fontWeight: "600", fontSize: s(11), marginTop: s(1) },
  queueBtn:   { width: s(28), height: s(28), borderRadius: s(999), alignItems: "center", justifyContent: "center", borderWidth: s(1) },
});

// ─── LibraryModal ─────────────────────────────────────────────────────────────

type LibraryTab = "playlists" | "tracks" | "queue";
type ModalView  = { kind: "tabs" } | { kind: "playlist"; playlist: SpotifyPlaylist };

function LibraryModal({
  visible, currentTrackUri, onClose, onPlayContext, onPlayTrack, onQueueTrack,
}: {
  visible: boolean; currentTrackUri: string | null; onClose: () => void;
  onPlayContext: (uri: string) => void; onPlayTrack: (uri: string) => void; onQueueTrack: (uri: string) => void;
}) {
  const [tab,            setTab]            = useState<LibraryTab>("playlists");
  const [view,           setView]           = useState<ModalView>({ kind: "tabs" });
  const [playlists,      setPlaylists]      = useState<SpotifyPlaylist[]>([]);
  const [savedTracks,    setSavedTracks]    = useState<SpotifyTrack[]>([]);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
  const [queue,          setQueue]          = useState<QueueTrack[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [queued,         setQueued]         = useState<Set<string>>(new Set());

  const loadTab = useCallback(async (t: LibraryTab) => {
    setLoading(true);
    try {
      if (t === "playlists") setPlaylists(await spotifyGetPlaylists());
      if (t === "tracks")    setSavedTracks((await spotifyGetSavedTracks()).tracks);
      if (t === "queue")     setQueue(await spotifyGetQueue());
    } finally { setLoading(false); }
  }, []);

  const openPlaylist = useCallback(async (playlist: SpotifyPlaylist) => {
    setView({ kind: "playlist", playlist });
    setLoading(true);
    try {
      const result = await spotifyGetPlaylistTracks(playlist.id);
      setPlaylistTracks(result.tracks);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (visible) { setView({ kind: "tabs" }); setQueued(new Set()); loadTab("playlists"); }
  }, [visible]);

  const switchTab = (t: LibraryTab) => { setTab(t); setView({ kind: "tabs" }); loadTab(t); };
  const handleQueue       = async (uri: string) => { await onQueueTrack(uri); setQueued((p) => new Set(p).add(uri)); };
  const handlePlayTrack   = (uri: string) => { onPlayTrack(uri); onClose(); };
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
        <View style={lm.header}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: s(8) }}>
            {isPlaylistView && (
              <Pressable onPress={() => setView({ kind: "tabs" })} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name="chevron-back" size={s(22)} color="#fff" />
              </Pressable>
            )}
            <Text style={lm.title} numberOfLines={1}>{isPlaylistView ? activePlaylist!.name : "Spotify Library"}</Text>
          </View>
          <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="close" size={s(22)} color="#fff" />
          </Pressable>
        </View>

        {!isPlaylistView && (
          <View style={lm.tabs}>
            {TABS.map(({ key, label, icon }) => (
              <Pressable key={key} onPress={() => switchTab(key)} style={({ pressed }) => [lm.tab, {
                backgroundColor: tab === key ? "rgba(29,185,84,0.18)" : "rgba(255,255,255,0.07)",
                borderColor:     tab === key ? "rgba(29,185,84,0.45)" : "rgba(255,255,255,0.12)",
                opacity: pressed ? 0.8 : 1,
              }]}>
                <Ionicons name={icon} size={s(13)} color={tab === key ? "#1DB954" : "rgba(255,255,255,0.5)"} />
                <Text style={[lm.tabText, { color: tab === key ? "#1DB954" : "rgba(255,255,255,0.5)" }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {isPlaylistView && !loading && (
          <Pressable onPress={() => handlePlayContext(activePlaylist!.uri)} style={({ pressed }) => [lm.playAllBtn, { opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="play" size={s(15)} color="#fff" />
            <Text style={lm.playAllText}>Play Playlist</Text>
          </Pressable>
        )}

        {loading ? (
          <View style={lm.center}><ActivityIndicator color="#1DB954" size="large" /></View>
        ) : (
          <>
            {!isPlaylistView && tab === "playlists" && (
              <FlatList data={playlists} keyExtractor={(p) => p.id} style={lm.list}
                contentContainerStyle={{ gap: s(8), paddingBottom: s(16) }} showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={lm.empty}>No playlists found</Text>}
                renderItem={({ item: p }) => (
                  <Pressable onPress={() => openPlaylist(p)} style={({ pressed }) => [lm.playlistRow, { opacity: pressed ? 0.8 : 1 }]}>
                    {p.artUrl ? <Image source={{ uri: p.artUrl }} style={lm.playlistArt} />
                      : <View style={[lm.playlistArt, lm.artFallback]}><Ionicons name="musical-notes" size={s(18)} color="rgba(255,255,255,0.3)" /></View>}
                    <View style={lm.playlistInfo}>
                      <Text style={lm.playlistName} numberOfLines={1}>{p.name}</Text>
                      <Text style={lm.playlistSub}>{p.trackCount} tracks · {p.owner}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={s(16)} color="rgba(255,255,255,0.3)" />
                  </Pressable>
                )}
              />
            )}
            {isPlaylistView && (
              <FlatList data={playlistTracks} keyExtractor={(t, i) => `${t.uri}-${i}`} style={lm.list}
                contentContainerStyle={{ gap: s(6), paddingBottom: s(16) }} showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={lm.empty}>No tracks found</Text>}
                renderItem={({ item: t, index }) => (
                  <TrackRow track={t} index={index} showIndex onPlay={handlePlayTrack} onQueue={handleQueue} isQueued={queued.has(t.uri)} currentlyPlayingUri={currentTrackUri} />
                )}
              />
            )}
            {!isPlaylistView && tab === "tracks" && (
              <FlatList data={savedTracks} keyExtractor={(t) => t.uri} style={lm.list}
                contentContainerStyle={{ gap: s(6), paddingBottom: s(16) }} showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={lm.empty}>No saved tracks found</Text>}
                renderItem={({ item: t, index }) => (
                  <TrackRow track={t} index={index} showIndex onPlay={handlePlayTrack} onQueue={handleQueue} isQueued={queued.has(t.uri)} currentlyPlayingUri={currentTrackUri} />
                )}
              />
            )}
            {!isPlaylistView && tab === "queue" && (
              <FlatList data={queue} keyExtractor={(t, i) => `${t.uri}-${i}`} style={lm.list}
                contentContainerStyle={{ gap: s(6), paddingBottom: s(16) }} showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={lm.empty}>Queue is empty</Text>}
                renderItem={({ item: t, index }) => (
                  <TrackRow track={t} index={index} showIndex onPlay={handlePlayTrack} currentlyPlayingUri={currentTrackUri} />
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
  backdrop:    { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet:       { backgroundColor: "rgba(12,16,24,0.98)", borderTopLeftRadius: s(22), borderTopRightRadius: s(22), borderWidth: s(1), borderColor: "rgba(255,255,255,0.10)", paddingHorizontal: s(16), paddingTop: s(10), paddingBottom: s(32), maxHeight: "82%" },
  handle:      { width: s(40), height: s(4), borderRadius: s(999), backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: s(10) },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: s(14) },
  title:       { color: "#fff", fontWeight: "900", fontSize: s(15) },
  tabs:        { flexDirection: "row", gap: s(8), marginBottom: s(12) },
  tab:         { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: s(5), paddingVertical: s(9), borderRadius: s(12), borderWidth: s(1) },
  tabText:     { fontWeight: "800", fontSize: s(12) },
  playAllBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: s(8), paddingVertical: s(10), marginBottom: s(10), borderRadius: s(12), backgroundColor: "rgba(29,185,84,0.2)", borderWidth: s(1), borderColor: "rgba(29,185,84,0.4)" },
  playAllText: { color: "#fff", fontWeight: "800", fontSize: s(14) },
  list:        { maxHeight: s(460) },
  center:      { height: s(200), alignItems: "center", justifyContent: "center" },
  empty:       { color: "rgba(255,255,255,0.4)", fontSize: s(13), fontWeight: "700", textAlign: "center", paddingVertical: s(40) },
  playlistRow: { flexDirection: "row", alignItems: "center", gap: s(12), paddingVertical: s(8), paddingHorizontal: s(10), borderRadius: s(12), backgroundColor: "rgba(255,255,255,0.04)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.07)" },
  playlistArt: { width: s(50), height: s(50), borderRadius: s(8) },
  artFallback: { backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  playlistInfo:{ flex: 1 },
  playlistName:{ color: "#fff", fontWeight: "800", fontSize: s(14) },
  playlistSub: { color: "rgba(255,255,255,0.45)", fontWeight: "600", fontSize: s(11), marginTop: s(2) },
});

// ─── SpotifyMiniPlayer ────────────────────────────────────────────────────────

interface Props { onTrackChange?: (track: TrackInfo | null) => void; isLandscape?: boolean; }

/** Poll every 3 s while playing; slow to 15 s while paused (save battery + fewer API calls). */
const POLL_PLAYING_MS = 3_000;
const POLL_PAUSED_MS  = 15_000;
/** How many consecutive null responses before we actually clear the player. */
const NULL_TOLERANCE  = 3;

export function SpotifyMiniPlayer({ onTrackChange, isLandscape = false }: Props) {
  const [track,    setTrack]    = useState<TrackInfo | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [library,  setLibrary]  = useState(false);

  const expandAnim   = useRef(new Animated.Value(0)).current;
  const mountedRef   = useRef(true);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Consecutive polls that got null back from Spotify */
  const nullCountRef = useRef(0);
  /** Whether the last known state was paused */
  const isPausedRef  = useRef(false);
  /** Last valid track we received — kept so we can restore it when paused */
  const lastKnownTrackRef = useRef<TrackInfo | null>(null);
  /** Last time we attempted a token refresh to recover */
  const lastRefreshAttemptRef = useRef(0);

  const applyState = (ps: Awaited<ReturnType<typeof getPlayerState>>) => {
    if (!ps || !mountedRef.current) return;
    nullCountRef.current = 0; // got a real response — reset error counter
    isPausedRef.current  = !ps.isPlaying;
    const t: TrackInfo = {
      name: ps.trackName, artist: ps.artistName, albumArtUrl: ps.albumArtUrl,
      trackUri: ps.trackUri, isPaused: !ps.isPlaying,
      durationMs: ps.durationMs, positionMs: ps.positionMs,
      shuffleState: ps.shuffleState, repeatState: ps.repeatState,
    };
    lastKnownTrackRef.current = t;
    setTrack(t); onTrackChange?.(t);
  };

  /**
   * Reschedule the poll interval — called whenever the playing/paused state
   * changes so we use a faster interval while playing and a slow one while
   * paused (reduces unnecessary API calls and prevents the "disconnects when
   * paused too long" appearance).
   */
  const reschedulePoll = useCallback((paused: boolean) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(poll, paused ? POLL_PAUSED_MS : POLL_PLAYING_MS);
  }, []);

  const poll = useCallback(async () => {
    const ps = await getPlayerState();
    if (!mountedRef.current) return;

    if (ps) {
      // Reschedule at the appropriate rate if playing state changed
      const waspaused = isPausedRef.current;
      applyState(ps);
      if (waspaused !== !ps.isPlaying) reschedulePoll(!ps.isPlaying);
      return;
    }

    // ps === null: Spotify returned no active device

    // If the user intentionally paused we should NOT treat this as a
    // disconnection. Spotify's /me/player endpoint returns 204 (→ null here)
    // when the device goes idle after a pause.  Keep showing the last known
    // paused state so the user can resume without re-connecting.
    if (isPausedRef.current && lastKnownTrackRef.current) {
      // Restore the last good paused state — keeps the mini-player visible
      if (mountedRef.current) setTrack(lastKnownTrackRef.current);
      return;
    }

    nullCountRef.current += 1;

    // Before giving up, try a silent token refresh — the access token may have
    // expired (they last 1 h). Only attempt once every 2 minutes.
    const now = Date.now();
    if (nullCountRef.current === 1 && now - lastRefreshAttemptRef.current > 120_000) {
      lastRefreshAttemptRef.current = now;
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Retry immediately after refresh
        const retryPs = await getPlayerState();
        if (!mountedRef.current) return;
        if (retryPs) { applyState(retryPs); return; }
      }
    }

    // Only clear the player UI after NULL_TOLERANCE consecutive failures so a
    // brief network blip or Spotify API hiccup doesn't flash the player away.
    if (nullCountRef.current >= NULL_TOLERANCE) {
      setTrack(null);
      onTrackChange?.(null);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    poll();
    pollRef.current = setInterval(poll, POLL_PLAYING_MS);
    return () => { mountedRef.current = false; if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Reschedule when track.isPaused changes so the interval rate adapts
  useEffect(() => {
    if (track) reschedulePoll(track.isPaused);
  }, [track?.isPaused]);

  useEffect(() => {
    Animated.spring(expandAnim, { toValue: expanded ? 1 : 0, useNativeDriver: false, tension: 90, friction: 14 }).start();
  }, [expanded]);

  // Controls panel height (does NOT include progress bar — that sits outside the clipped area)
  const controlsH  = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, isLandscape ? s(70) : s(110)] });
  const ctrlOpacity= expandAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const chevron    = expandAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  const cmd = (fn: () => Promise<void>) => async () => { await fn(); setTimeout(poll, 400); };
  const prev          = cmd(spotifySkipPrevious);
  const next          = cmd(spotifySkipNext);
  const toggle        = cmd(() => track?.isPaused ? spotifyResume() : spotifyPause());
  const toggleShuffle = cmd(() => spotifySetShuffle(!track?.shuffleState));
  const toggleRepeat  = cmd(() => spotifySetRepeat(nextRepeatMode(track?.repeatState ?? "off")));
  const seek          = async (ms: number) => { await spotifySeek(ms); setTimeout(poll, 1200); };

  const repeatActive = track?.repeatState !== "off";
  const openSpotify  = () => Linking.openURL("spotify://").catch(() => Linking.openURL("https://open.spotify.com"));

  return (
    <>
      {/*
        ── CRITICAL: NO overflow:"hidden" on this card ──
        overflow:hidden breaks PanResponder coordinate measurement.
        The card uses borderRadius for visual rounding only.
      */}
      <View style={styles.card}>

        {/* Tappable header row */}
        <Pressable onPress={() => setExpanded((v) => !v)} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
          <View style={styles.row}>
            <View style={styles.artWrap}>
              {track?.albumArtUrl
                ? <Image source={{ uri: track.albumArtUrl }} style={styles.art} />
                : <View style={[styles.art, styles.artFallback]}><Ionicons name="musical-note" size={s(14)} color="rgba(255,255,255,0.35)" /></View>
              }
              {track && !track.isPaused && <View style={styles.dot} />}
            </View>
            <View style={styles.info}>
              <Text style={styles.trackName} numberOfLines={1}>{track?.name  || "Spotify"}</Text>
              <Text style={styles.artist}    numberOfLines={1}>{track?.artist || "Now playing"}</Text>
            </View>
            <Pressable onPress={(e) => { e.stopPropagation(); toggle(); }} style={({ pressed }) => [styles.quickBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name={track?.isPaused ? "play" : "pause"} size={s(16)} color="#fff" />
            </Pressable>
            <Animated.View style={{ transform: [{ rotate: chevron }] }}>
              <Ionicons name="chevron-down" size={s(14)} color="rgba(255,255,255,0.45)" />
            </Animated.View>
          </View>
        </Pressable>

        {/*
          ── ProgressBar is a SIBLING of the Animated.View, not inside it ──
          This is the key fix: the bar is never inside overflow:hidden,
          so measureInWindow returns correct screen coordinates.
        */}
        {expanded && !isLandscape && (
          <ProgressBar
            positionMs={track?.positionMs ?? 0}
            durationMs={track?.durationMs ?? 0}
            isPaused={track?.isPaused ?? true}
            onSeek={seek}
          />
        )}

        {/* Animated height clip for controls only — progress bar is above this */}
        <Animated.View style={{ height: controlsH, opacity: ctrlOpacity, overflow: "hidden" }} pointerEvents={expanded ? "auto" : "none"}>
          <View style={[styles.ctrlRow, isLandscape && { paddingTop: s(10) }]}>
            <Pressable onPress={(e) => { e.stopPropagation(); toggleShuffle(); }} style={({ pressed }) => [styles.ctrlBtnSm, { opacity: pressed ? 0.6 : 1, borderColor: track?.shuffleState ? "rgba(29,185,84,0.5)" : "rgba(255,255,255,0.12)" }]}>
              <Ionicons name="shuffle" size={s(15)} color={track?.shuffleState ? "#1DB954" : "rgba(255,255,255,0.4)"} />
            </Pressable>
            <Pressable onPress={(e) => { e.stopPropagation(); prev(); }} style={({ pressed }) => [styles.ctrlBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="play-skip-back" size={s(18)} color="#fff" />
            </Pressable>
            <Pressable onPress={(e) => { e.stopPropagation(); toggle(); }} style={({ pressed }) => [styles.ctrlBtnMain, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name={track?.isPaused ? "play" : "pause"} size={s(22)} color="#fff" />
            </Pressable>
            <Pressable onPress={(e) => { e.stopPropagation(); next(); }} style={({ pressed }) => [styles.ctrlBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="play-skip-forward" size={s(18)} color="#fff" />
            </Pressable>
            <Pressable onPress={(e) => { e.stopPropagation(); toggleRepeat(); }} style={({ pressed }) => [styles.ctrlBtnSm, { opacity: pressed ? 0.6 : 1, borderColor: repeatActive ? "rgba(29,185,84,0.5)" : "rgba(255,255,255,0.12)" }]}>
              <Ionicons name="repeat" size={s(15)} color={repeatActive ? "#1DB954" : "rgba(255,255,255,0.4)"} />
              {track?.repeatState === "track" && (
                <View style={styles.repeatBadge}><Text style={styles.repeatBadgeText}>1</Text></View>
              )}
            </Pressable>
          </View>

          {!isLandscape && (
            <View style={styles.secondRow}>
              <Pressable onPress={(e) => { e.stopPropagation(); setLibrary(true); }} style={({ pressed }) => [styles.secondBtn, { opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name="list" size={s(14)} color="rgba(255,255,255,0.7)" />
                <Text style={styles.secondBtnText}>Library</Text>
              </Pressable>
              <Pressable onPress={(e) => { e.stopPropagation(); openSpotify(); }} style={({ pressed }) => [styles.secondBtn, { opacity: pressed ? 0.7 : 1, borderColor: "rgba(29,185,84,0.35)" }]}>
                <Ionicons name="open-outline" size={s(14)} color="#1DB954" />
                <Text style={[styles.secondBtnText, { color: "#76eea0" }]}>Open Spotify</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>

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
    paddingVertical: s(10),
    // !! NO overflow:"hidden" here — it breaks PanResponder !!
  },
  row:         { flexDirection: "row", alignItems: "center", gap: s(10), paddingHorizontal: s(12) },
  artWrap:     { position: "relative" },
  art:         { width: s(38), height: s(38), borderRadius: s(8) },
  artFallback: { backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  dot:         { position: "absolute", bottom: -s(2), right: -s(2), width: s(9), height: s(9), borderRadius: s(999), backgroundColor: "#1DB954", borderWidth: s(1.5), borderColor: "rgba(10,14,20,0.95)" },
  info:        { flex: 1, gap: s(2) },
  trackName:   { color: "#fff", fontWeight: "800", fontSize: s(13) },
  artist:      { color: "rgba(255,255,255,0.55)", fontWeight: "600", fontSize: s(11) },
  quickBtn:    { width: s(30), height: s(30), borderRadius: s(999), alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.14)" },
  ctrlRow:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: s(10), paddingTop: s(6), paddingBottom: s(4), paddingHorizontal: s(12) },
  ctrlBtn:     { width: s(40), height: s(40), borderRadius: s(999), alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.12)" },
  ctrlBtnSm:   { width: s(32), height: s(32), borderRadius: s(999), alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: s(1), position: "relative" },
  ctrlBtnMain: { width: s(52), height: s(52), borderRadius: s(999), alignItems: "center", justifyContent: "center", backgroundColor: "rgba(29,185,84,0.22)", borderWidth: s(1), borderColor: "rgba(29,185,84,0.45)" },
  repeatBadge:     { position: "absolute", bottom: -s(2), right: -s(2), width: s(12), height: s(12), borderRadius: s(999), backgroundColor: "#1DB954", alignItems: "center", justifyContent: "center" },
  repeatBadgeText: { color: "#000", fontSize: s(7), fontWeight: "900" },
  secondRow:   { flexDirection: "row", gap: s(8), paddingTop: s(6), paddingBottom: s(2), justifyContent: "center", paddingHorizontal: s(12) },
  secondBtn:   { flexDirection: "row", alignItems: "center", gap: s(6), paddingVertical: s(7), paddingHorizontal: s(12), borderRadius: s(999), borderWidth: s(1), backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)" },
  secondBtnText: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: s(12) },
});