// screens/FocusZoneScreen.tsx updated
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Image,
  Platform,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ImageBackground,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAudioPlayer } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import { s } from "../src/ui/ts";

import { useGlobalMusic } from "../src/services/GlobalMusicPlayer";
import { SpotifyMiniPlayer, type TrackInfo } from "../src/components/SpotifyMiniPlayer";
import { useSpotifyRemote } from "../src/hooks/useSpotifyRemote";
import { useFocusEffect } from "@react-navigation/native";
import { CONTENT_MAX_WIDTH } from "../src/ui/responsive";

import {
  loadTasks,
  loadObjectives,
  saveFocusSession,
  todayKey,
  loadFocusBackground,
  loadFocusMinutes,
  saveFocusMinutes,
  loadBreakMinutes,
  saveBreakMinutes,
  getCurrentUser,
  loadSetupData,
  loadTimeFormat24h,
  loadFocusRoomTutorialSeen,
  saveFocusRoomTutorialSeen,
} from "../src/data/storage";
import { FocusRoomTutorial } from "../src/components/ui/FocusRoomTutorial";
import {
  generateFocusSessionId,
  onFocusWorkPhaseStarted,
  onFocusSessionCompleted,
  onBreakCompleted,
  cancelFocusSessionNotifs,
  checkAndFireDailyFocusGoal,
} from "../src/services/notifications";
import type { Task, Objective } from "../src/data/models";
import {
  startFocusActivity,
  updateFocusActivity,
  endFocusActivity,
} from "../modules/focus-live-activity";


// ─── Backgrounds ─────────────────────────────────────────────────────────────
const BACKGROUNDS = [
  { id: "mountain", label: "Mountain", source: require("../assets/focus/mountainMOB.png") },
  { id: "forest",   label: "Forest",   source: require("../assets/focus/forest1.png") },
  { id: "ocean",    label: "Ocean",    source: require("../assets/focus/Ocean1.png") },
  { id: "space",    label: "Space",    source: require("../assets/focus/space.png") },
  { id: "skyline",  label: "Skyline",  source: require("../assets/focus/skylineMOB.png") },
];

function clampInt(n: number, min: number, max: number) {
  const x = Math.floor(Number.isFinite(n) ? n : min);
  return Math.max(min, Math.min(max, x));
}

type Phase      = "work" | "break";
type TimerMode  = "pomodoro" | "timer";
type TimerView  = "timer" | "hidden" | "clock";

// ─── Component ───────────────────────────────────────────────────────────────
export default function FocusZoneScreen({ navigation }: any) {
  const { isMuted, toggleMute, loading: musicLoading } = useGlobalMusic();
  const spotify = useSpotifyRemote();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= 768;

  // Room
  const [isInRoom,         setIsInRoom]         = useState(false);
  const [currentRoom,      setCurrentRoom]      = useState(BACKGROUNDS[0]);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showFocusTutorial, setShowFocusTutorial] = useState(false);
  const [tutorialTargetMins, setTutorialTargetMins] = useState(60);

  // Timer config
  const [focusMinutes,   setFocusMinutes]   = useState(25);
  const [breakMinutes,   setBreakMinutes]   = useState(5);
  const [timerMode,      setTimerMode]      = useState<TimerMode>("pomodoro");
  const [timerView,      setTimerView]      = useState<TimerView>("timer");
  const [phase,          setPhase]          = useState<Phase>("work");
  const [secondsLeft,    setSecondsLeft]    = useState(25 * 60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning,      setIsRunning]      = useState(false);

  // Immersive mode (landscape only)
  const [immersive, setImmersive] = useState(false);
  const immAnim = useRef(new Animated.Value(0)).current;
  const artAnim = useRef(new Animated.Value(0)).current;

  // Spotify track state
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);

  // Display preferences
  const [timeFormat24h, setTimeFormat24h] = useState(false);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"tasks" | "timer">("timer");
  const [taskSortMode, setTaskSortMode] = useState<"my-day" | "planned" | "important" | "objectives">("my-day");
  const [expandedObjectives, setExpandedObjectives] = useState<Record<string, boolean>>({});
  const [pomoDurExpanded, setPomoDurExpanded] = useState(false);

  // Tasks
  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTask   = useMemo(() => tasks.find((t) => t.id === selectedTaskId) ?? null, [selectedTaskId, tasks]);
  const activeTasks    = useMemo(() => tasks.filter((t) => t.status !== "completed"),       [tasks]);
  const objectivesById = useMemo(() => {
    const m = new Map<string, Objective>();
    objectives.forEach((o) => m.set(o.id, o));
    return m;
  }, [objectives]);

  // Refs
  const roomScrollRef         = useRef<ScrollView>(null);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitioningRef      = useRef(false);
  const sessionStartRef       = useRef<string | null>(null);
  const focusNotifSessionRef  = useRef<string>("");
  const prevTimerViewRef      = useRef<"timer" | "clock">("timer");
  const savedElapsedRef       = useRef(0);
  const backgroundedAtRef     = useRef<number | null>(null);
  const secondsLeftRef        = useRef(secondsLeft);
  const phaseRef              = useRef(phase);
  const liveActivityActiveRef = useRef(false);
  const [, forceClockTick]    = useState(0);

  // ── Sound ─────────────────────────────────────────────────────────────────
  const cuePlayer = useAudioPlayer(require("../assets/focus/timer_cue.mp3"));

  /* ── LOAD ──────────────────────────────────────────────────────────────── */
  useFocusEffect(
    useCallback(() => {
      loadTimeFormat24h().then(setTimeFormat24h);
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [t, o] = await Promise.all([loadTasks(), loadObjectives()]);
          setTasks(t); setObjectives(o);
        } catch {}
      })();
    }, [])
  );

  useEffect(() => {
    (async () => {
      const userId = await getCurrentUser();
      if (!userId) return;
      const [storedBg, storedFocus, storedBreak, fmt24h] = await Promise.all([
        loadFocusBackground(), loadFocusMinutes(), loadBreakMinutes(), loadTimeFormat24h(),
      ]);
      setTimeFormat24h(fmt24h);
      if (storedBg) {
        const found = BACKGROUNDS.find((b) => b.id === storedBg);
        if (found) setCurrentRoom(found);
      }
      const fm = clampInt(storedFocus, 5, 240);
      const bm = clampInt(storedBreak, 1, 60);
      setFocusMinutes(fm); setBreakMinutes(bm); setSecondsLeft(fm * 60);
      try {
        const [t, o] = await Promise.all([loadTasks(), loadObjectives()]);
        setTasks(t); setObjectives(o);
        const setup = await loadSetupData().catch(() => null);
        if (setup?.targetMinutesPerDay) setTutorialTargetMins(setup.targetMinutesPerDay);
      } catch {}
    })();
  }, []);

  useEffect(() => { secondsLeftRef.current = secondsLeft; }, [secondsLeft]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  /* ── CLOCK TICK ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const id = setInterval(() => forceClockTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /* ── BACKGROUND / FOREGROUND FAST-FORWARD ──────────────────────────────── */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        if (isRunning) backgroundedAtRef.current = Date.now();
      } else if (nextState === "active") {
        const bgAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (!isRunning || bgAt === null) return;
        const elapsed = Math.floor((Date.now() - bgAt) / 1000);
        if (elapsed <= 0) return;
        if (timerMode === "timer") {
          setElapsedSeconds((p) => p + elapsed);
        } else {
          const newSecsLeft = Math.max(0, secondsLeftRef.current - elapsed);
          setSecondsLeft(newSecsLeft);
          if (phaseRef.current === "work" && focusNotifSessionRef.current && newSecsLeft > 0) {
            void onFocusWorkPhaseStarted(
              Math.ceil(newSecsLeft / 60),
              focusNotifSessionRef.current,
            );
          }
        }
      }
    });
    return () => sub.remove();
  }, [isRunning, timerMode]);

  /* ── CUE SOUND ─────────────────────────────────────────────────────────── */
  const playCueOnce = async () => {
    try {
      cuePlayer.volume = 0.6;
      cuePlayer.seekTo(0);
      await new Promise<void>((res) => {
        const sub = cuePlayer.addListener("playbackStatusUpdate", (status: any) => {
          if (status.didJustFinish) {
            sub.remove();
            res();
          }
        });
        cuePlayer.play();
      });
    } catch {}
  };
  const playCueTwice = async () => { try { await playCueOnce(); await playCueOnce(); } catch {} };

  /* ── MAIN INTERVAL ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isRunning) return;
    timerRef.current = setInterval(() => {
      if (timerMode === "timer") setElapsedSeconds((p) => p + 1);
      else setSecondsLeft((p) => (p <= 0 ? 0 : p - 1));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };
  }, [isRunning, timerMode]);

  /* ── PHASE TRANSITION ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (timerMode !== "pomodoro" || !isRunning || secondsLeft > 0 || transitioningRef.current) return;
    transitioningRef.current = true;
    (async () => {
      try { await playCueTwice(); } catch {}
      const sid = focusNotifSessionRef.current;
      if (phase === "work" && sessionStartRef.current) {
        const saved = await saveFocusSession({ date: todayKey(), startTime: sessionStartRef.current, minutes: focusMinutes, taskId: selectedTaskId || undefined });
        void onFocusSessionCompleted(breakMinutes, sid);
        try {
          const setup = await loadSetupData();
          const target: number = setup?.targetMinutesPerDay ?? 60;
          const total = (saved as any[]).reduce((acc: number, s: any) =>
            s.date === todayKey() ? acc + (s.minutes ?? 0) : acc, 0);
          void checkAndFireDailyFocusGoal(total, target);
        } catch {}
      }
      const next: Phase = phase === "work" ? "break" : "work";
      if (next === "work") {
        const now = new Date();
        sessionStartRef.current = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
        void onBreakCompleted(sid);
        const newSid = generateFocusSessionId();
        focusNotifSessionRef.current = newSid;
        void onFocusWorkPhaseStarted(focusMinutes, newSid);
      }
      setPhase(next);
      const nextSecs = (next === "work" ? focusMinutes : breakMinutes) * 60;
      setSecondsLeft(nextSecs);
      if (liveActivityActiveRef.current) {
        void updateFocusActivity({
          sessionName: currentRoom.label,
          taskName: selectedTask?.title ?? "Focus",
          mode: next === "work" ? "Focus" : "Break",
          timeRemaining: nextSecs,
          isPaused: false,
        });
      }
      transitioningRef.current = false;
    })();
  }, [secondsLeft, isRunning, phase, focusMinutes, breakMinutes, selectedTaskId, timerMode]);

  /* ── ACTIONS ────────────────────────────────────────────────────────────── */
  const toggleRun = () => {
    if (timerMode === "timer") {
      if (!isRunning) {
        if (!sessionStartRef.current) {
          const now = new Date();
          sessionStartRef.current = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
        }
        setIsRunning(true); return;
      }
      setIsRunning(false);
      const deltaSeconds = elapsedSeconds - savedElapsedRef.current;
      const mins = Math.floor(deltaSeconds / 60);
      if (mins > 0 && sessionStartRef.current)
        void saveFocusSession({ date: todayKey(), startTime: sessionStartRef.current, minutes: mins, taskId: selectedTaskId || undefined });
      savedElapsedRef.current = elapsedSeconds;
      sessionStartRef.current = null; return;
    }
    if (secondsLeft <= 0) setSecondsLeft((phase === "work" ? focusMinutes : breakMinutes) * 60);
    if (!isRunning) {
      if (phase === "work") {
        if (!sessionStartRef.current) {
          const now = new Date();
          sessionStartRef.current = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
        }
        const sid = focusNotifSessionRef.current || generateFocusSessionId();
        focusNotifSessionRef.current = sid;
        void onFocusWorkPhaseStarted(Math.ceil(secondsLeft / 60) || focusMinutes, sid);
      }
      const effectiveSecs = secondsLeft <= 0
        ? (phase === "work" ? focusMinutes : breakMinutes) * 60
        : secondsLeft;
      if (!liveActivityActiveRef.current) {
        startFocusActivity({
          sessionId: focusNotifSessionRef.current || `focus-${Date.now()}`,
          sessionName: currentRoom.label,
          taskName: selectedTask?.title ?? "Focus",
          mode: phase === "work" ? "Focus" : "Break",
          durationSeconds: effectiveSecs,
        }).then((started) => { liveActivityActiveRef.current = started; });
      } else {
        void updateFocusActivity({
          sessionName: currentRoom.label,
          taskName: selectedTask?.title ?? "Focus",
          mode: phase === "work" ? "Focus" : "Break",
          timeRemaining: effectiveSecs,
          isPaused: false,
        });
      }
    } else {
      void cancelFocusSessionNotifs(focusNotifSessionRef.current);
      if (liveActivityActiveRef.current) {
        void updateFocusActivity({
          sessionName: currentRoom.label,
          taskName: selectedTask?.title ?? "Focus",
          mode: phase === "work" ? "Focus" : "Break",
          timeRemaining: secondsLeftRef.current,
          isPaused: true,
        });
      }
    }
    setIsRunning((v) => !v);
  };

  const resetTimer = () => {
    void cancelFocusSessionNotifs(focusNotifSessionRef.current);
    focusNotifSessionRef.current = "";
    if (liveActivityActiveRef.current) {
      liveActivityActiveRef.current = false;
      void endFocusActivity({ sessionName: currentRoom.label, taskName: selectedTask?.title ?? "Focus" });
    }
    setIsRunning(false); sessionStartRef.current = null;
    if (timerMode === "timer") { setElapsedSeconds(0); savedElapsedRef.current = 0; return; }
    setPhase("work"); setSecondsLeft(focusMinutes * 60);
  };

  const cycleTimerView = () => {
    setTimerView((v) => {
      if (v === "timer")  return "hidden";
      if (v === "hidden") return "clock";
      return "timer";
    });
  };

  const toggleVisibility = () => {
    if (timerView === "hidden") {
      setTimerView(prevTimerViewRef.current);
    } else {
      prevTimerViewRef.current = timerView as "timer" | "clock";
      setTimerView("hidden");
    }
  };
  const toggleClockMode = () => {
    const next: TimerView = timerView === "clock" ? "timer" : "clock";
    setTimerView(next);
    prevTimerViewRef.current = next;
  };

  const saveSettings = async () => {
    if (timerMode === "pomodoro") {
      const fm = clampInt(focusMinutes, 5, 240);
      const bm = clampInt(breakMinutes, 1, 60);
      await saveFocusMinutes(fm); await saveBreakMinutes(bm);
      if (!isRunning) setSecondsLeft((phase === "work" ? fm : bm) * 60);
    }
    setShowSettings(false);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  /* ── IMMERSIVE TOGGLE ───────────────────────────────────────────────────── */
  const toggleImmersive = () => {
    const next = !immersive;
    setImmersive(next);
    Animated.spring(immAnim, { toValue: next ? 1 : 0, useNativeDriver: false, tension: 65, friction: 14 }).start();
    if (next && currentTrack?.albumArtUrl) {
      Animated.timing(artAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } else {
      Animated.timing(artAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  };

  useEffect(() => {
    if (immersive && currentTrack?.albumArtUrl) {
      Animated.timing(artAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }
  }, [currentTrack?.albumArtUrl, immersive]);

  /* ── FORMATTERS ─────────────────────────────────────────────────────────── */
  const getCurrentTime = () => {
    const now = new Date();
    if (timeFormat24h) {
      return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    }
    const h = now.getHours();
    const m = now.getMinutes();
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m.toString().padStart(2, "0")}`;
  };
  const formatCountdown = () => `${Math.floor(secondsLeft/60)}:${String(secondsLeft%60).padStart(2,"0")}`;
  const formatStopwatch = () => {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    return `${h}:${String(m).padStart(2,"0")}:${String(elapsedSeconds%60).padStart(2,"0")}`;
  };

  const portraitValue =
    timerView === "clock" ? getCurrentTime()  :
    timerMode === "timer" ? formatStopwatch() :
    formatCountdown();

  const landscapeValue =
    timerView === "clock" ? getCurrentTime() :
    timerMode === "timer" ? formatStopwatch() : formatCountdown();

  const mainLabel =
    timerMode === "timer"
      ? (selectedTask?.title ?? "Stopwatch")
      : phase === "work" ? (selectedTask?.title ?? "Work") : "Break";

  const subLabel =
    timerMode === "timer"
      ? (isRunning ? "Focusing…" : "Tap to start")
      : isRunning
        ? (phase === "work" ? "Focusing…" : "Recovering…")
        : secondsLeft <= 0 ? "Session ended · tap to restart" : "Tap to start";

  const timerViewIcon =
    timerView === "hidden" ? "eye"          :
    timerView === "clock"  ? "time-outline" :
    "eye-off";
  const timerViewLabel =
    timerView === "timer"  ? "Hide"       :
    timerView === "hidden" ? "Show Time"  :
    "Show Timer";

  /* ── ROOM NAVIGATION ────────────────────────────────────────────────────── */
  const enterRoom = (room: typeof BACKGROUNDS[0]) => {
    setCurrentRoom(room);
    setIsInRoom(true);
    loadFocusRoomTutorialSeen().then((seen) => {
      if (!seen) setShowFocusTutorial(true);
    }).catch(() => {});
  };
  const leaveRoom = () => {
    void cancelFocusSessionNotifs(focusNotifSessionRef.current);
    focusNotifSessionRef.current = "";
    if (liveActivityActiveRef.current) {
      liveActivityActiveRef.current = false;
      void endFocusActivity({ sessionName: currentRoom.label, taskName: selectedTask?.title ?? "Focus" });
    }
    setIsInRoom(false); setShowLeaveConfirm(false); setIsRunning(false); setPhase("work");
    setSecondsLeft(focusMinutes * 60); setElapsedSeconds(0); sessionStartRef.current = null;
    savedElapsedRef.current = 0;
    setTimerView("timer");
    setImmersive(false); immAnim.setValue(0); artAnim.setValue(0);
  };
  const attemptLeave = () => {
    const pomo = timerMode === "pomodoro" && (isRunning || secondsLeft < (phase === "work" ? focusMinutes*60 : breakMinutes*60));
    const stop  = timerMode === "timer" && (isRunning || elapsedSeconds > 0);
    if (pomo || stop) setShowLeaveConfirm(true); else leaveRoom();
  };

  /* ── ANIMATED VALUES ────────────────────────────────────────────────────── */
  const uiOpacity    = immAnim.interpolate({ inputRange: [0,1], outputRange: [1, 0] });
  const uiTranslateY = immAnim.interpolate({ inputRange: [0,1], outputRange: [0, -s(12)] });

  const isStopwatchDisplay = timerMode === "timer" && timerView !== "clock";
  const normalFontL    = isStopwatchDisplay ? s(56) : s(76);
  const immersiveFontL = isTablet
    ? (isStopwatchDisplay ? Math.min(height * 0.44, width * 0.09) : Math.min(height * 0.62, width * 0.14))
    : (isStopwatchDisplay ? height * 0.44 : height * 0.62);
  const timerFontSizeL = immAnim.interpolate({ inputRange: [0,1], outputRange: [normalFontL, immersiveFontL] });
  const timerSpacingL  = immAnim.interpolate({ inputRange: [0,1], outputRange: [-1, -4] });

  /* ── ROOM SELECTION ─────────────────────────────────────────────────────── */
  if (!isInRoom) {
    return (
      <ImageBackground source={require("../assets/focus/mountainMOB.png")} style={{ flex: 1 }}>
        <LinearGradient colors={["rgba(0,0,0,0.22)","rgba(0,0,0,0.88)"]} style={{ flex:1 }}>
          <SafeAreaView style={styles.container}>
            <View style={styles.topBar}>
              <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.pill,{opacity:pressed?0.85:1}]}>
                <Ionicons name="chevron-back" size={s(14)} color="#fff"/>
                <Text style={styles.pillText}>Dashboard</Text>
              </Pressable>
            </View>
            <View style={{ flex:1, paddingTop: s(28) }}>
              <View style={[{ flex: 1 }, isTablet && { maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" as const, width: "100%" }]}>
                <Text style={styles.roomTitle}>Choose Your Focus Room</Text>
                <Text style={styles.roomSubtitle}>Select an environment to begin</Text>
                <Pressable
                  onPress={() => roomScrollRef.current?.scrollToEnd({ animated: true })}
                  style={({ pressed }) => ({
                    alignSelf: "center" as const,
                    flexDirection: "row" as const,
                    alignItems: "center" as const,
                    gap: s(6),
                    marginTop: s(8),
                    marginBottom: s(2),
                    paddingVertical: s(5),
                    paddingHorizontal: s(14),
                    borderRadius: s(20),
                    borderWidth: s(1),
                    borderColor: "rgba(74,157,255,0.35)",
                    backgroundColor: "rgba(74,157,255,0.10)",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Ionicons name="barbell-outline" size={s(13)} color="#4A9DFF" />
                  <Text style={{ color: "#4A9DFF", fontSize: s(12), fontWeight: "700" }}>Training Room</Text>
                  <Ionicons name="chevron-down" size={s(13)} color="#4A9DFF" />
                </Pressable>
                <ScrollView ref={roomScrollRef} contentContainerStyle={{ gap:s(14), paddingBottom:s(100) }} showsVerticalScrollIndicator={false}>
                  {BACKGROUNDS.map((room) => (
                    <Pressable key={room.id} onPress={() => enterRoom(room)} style={({ pressed }) => [styles.roomCard,{opacity:pressed?0.9:1}]}>
                      <ImageBackground source={room.source} style={styles.roomCardImg} imageStyle={{ borderRadius:s(18) }}>
                        <LinearGradient colors={["rgba(0,0,0,0.08)","rgba(0,0,0,0.78)"]} style={styles.roomCardOverlay}>
                          <Text style={styles.roomCardLabel}>{room.label}</Text>
                          <View style={styles.roomCardEnterBtn}>
                            <Text style={styles.roomCardEnterText}>Enter Room</Text>
                            <Ionicons name="arrow-forward" size={s(15)} color="#fff"/>
                          </View>
                        </LinearGradient>
                      </ImageBackground>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => navigation.navigate("TrainingRoom" as any)}
                    style={({ pressed }) => [styles.roomCard, { opacity: pressed ? 0.9 : 1 }]}
                  >
                    <LinearGradient colors={["#070e1e", "#0c1a34", "#0a1625"]} style={{ flex: 1, width: "100%" }}>
                      <View style={styles.roomCardOverlay}>
                        <View style={{ gap: s(4) }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
                            <View style={{ width: s(34), height: s(34), borderRadius: s(10), backgroundColor: "rgba(74,157,255,0.18)", borderWidth: s(1), borderColor: "rgba(74,157,255,0.4)", alignItems: "center", justifyContent: "center" }}>
                              <Ionicons name="barbell-outline" size={s(18)} color="#4A9DFF" />
                            </View>
                            <Text style={styles.roomCardLabel}>Training Room</Text>
                          </View>
                          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: s(12), fontWeight: "600", marginLeft: s(42) }}>Set-based workout execution</Text>
                        </View>
                        <View style={styles.roomCardEnterBtn}>
                          <Text style={styles.roomCardEnterText}>Enter Room</Text>
                          <Ionicons name="arrow-forward" size={s(15)} color="#fff"/>
                        </View>
                      </View>
                    </LinearGradient>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
    );
  }

  /* ── FOCUS ROOM ─────────────────────────────────────────────────────────── */
  return (
    <ImageBackground source={currentRoom.source} style={{ flex:1 }}>
      <LinearGradient colors={["rgba(0,0,0,0.22)","rgba(0,0,0,0.88)"]} style={{ flex:1 }}>
        <SafeAreaView style={{ flex:1 }} edges={isLandscape ? ["top","left"] : ["top","left","right"]}>

          {isLandscape ? (
            /* ════════════════ LANDSCAPE LAYOUT ════════════════ */
            <View style={ls.root}>
              <View style={ls.timerCol}>
                <Pressable onPress={toggleRun} style={{ alignItems: "center" }}>
                  {timerView !== "hidden" && (
                    <>
                      <Animated.Text style={[ls.timerText, { fontSize: timerFontSizeL, letterSpacing: timerSpacingL }]}>
                        {landscapeValue}
                      </Animated.Text>
                      <View style={styles.timerSubRow}>
                        <View style={[styles.dot, isRunning && styles.dotActive]}/>
                        <Text style={styles.timerSub}>{subLabel}</Text>
                      </View>
                    </>
                  )}
                  {timerView === "hidden" && (
                    <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: s(16), fontWeight: "700" }}>Tap to start</Text>
                  )}
                </Pressable>
                {timerView !== "hidden" && timerView !== "clock" && (
                  <Pressable
                    onPress={resetTimer}
                    style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: s(6), marginTop: s(18), opacity: pressed ? 0.65 : 0.55 }]}
                  >
                    <Ionicons name="refresh" size={s(14)} color="#fff"/>
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: s(12) }}>
                      {timerMode === "timer" ? "Reset timer" : "Reset session"}
                    </Text>
                  </Pressable>
                )}
              </View>

              <Animated.View
                style={[ls.controlsCol, { opacity: uiOpacity }, isTablet && { width: s(300) }]}
                pointerEvents={immersive ? "none" : "auto"}
              >
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: s(10), paddingBottom: s(14) }}>
                  <View style={ls.topRow}>
                    <Pressable onPress={attemptLeave} style={({ pressed }) => [styles.pill,{opacity:pressed?0.85:1}]}>
                      <Entypo name="chevron-left" size={s(13)} color="#fff"/>
                      <Text style={styles.pillText}>Leave</Text>
                    </Pressable>
                    <Pressable onPress={() => setShowSettings(true)} style={({ pressed }) => [styles.pill,{opacity:pressed?0.85:1}]}>
                      <Ionicons name="options-outline" size={s(15)} color="#fff"/>
                      <Text style={styles.pillText}>Settings</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={spotify.connected ? spotify.disconnect : spotify.connect}
                    disabled={spotify.connecting}
                    style={({ pressed }) => [styles.pill, ls.spotifyPill, {
                      opacity: pressed || spotify.connecting ? 0.65 : 1,
                      backgroundColor: spotify.connected ? "rgba(29,185,84,0.22)" : "rgba(255,255,255,0.10)",
                      borderColor: spotify.connected ? "rgba(29,185,84,0.35)" : "rgba(255,255,255,0.14)",
                    }]}
                  >
                    <Entypo name="spotify" size={s(14)} color={spotify.connected ? "#1DB954" : "#fff"}/>
                    <Text style={[styles.pillText, spotify.connected && { color:"#76eea0" }]}>
                      {spotify.connecting ? "Connecting…" : "Spotify"}
                    </Text>
                  </Pressable>

                  {spotify.connected && <SpotifyMiniPlayer onTrackChange={setCurrentTrack} isLandscape={!isTablet}/>}

                  <Text style={styles.phaseLabel}>{mainLabel.toUpperCase()}</Text>

                  <View style={ls.bottomRow}>
                    <AnimToggle value={!isMuted} onChange={toggleMute} disabled={musicLoading} labelOn="Music" labelOff="Music" iconOn="musical-notes" iconOff="volume-mute" />
                    <AnimToggle value={timerView !== "hidden"} onChange={toggleVisibility} labelOn="Visible" labelOff="Hidden" iconOn="eye" iconOff="eye-off" />
                    <AnimToggle value={timerView === "clock"} onChange={toggleClockMode} disabled={false} labelOn="Clock" labelOff="Timer" iconOn="time-outline" iconOff="stopwatch-outline" />
                  </View>
                </ScrollView>
              </Animated.View>

              <Pressable onPress={toggleImmersive} style={[styles.expandBtn, ls.expandBtn]}>
                <Ionicons name={immersive ? "contract-outline" : "expand-outline"} size={s(17)} color={immersive ? "rgba(255,255,255,0.4)" : "#fff"} />
              </Pressable>

              {immersive && spotify.connected && (
                <Animated.View style={[ls.immersiveMiniPlayer, { opacity: artAnim }]}>
                  <SpotifyMiniPlayer onTrackChange={setCurrentTrack} isLandscape={true}/>
                </Animated.View>
              )}
            </View>

          ) : (
            /* ════════════════ PORTRAIT LAYOUT ════════════════ */
            <View style={{ flex:1 }}>
              <View style={[styles.topBar, { paddingHorizontal:s(16) }]}>
                <Pressable onPress={attemptLeave} style={({ pressed }) => [styles.pill,{opacity:pressed?0.85:1}]}>
                  <Entypo name="chevron-left" size={s(14)} color="#fff"/>
                  <Text style={styles.pillText}>Leave Room</Text>
                </Pressable>
                <Pressable
                  onPress={spotify.connected ? spotify.disconnect : spotify.connect}
                  disabled={spotify.connecting}
                  style={({ pressed }) => [styles.pill,{
                    opacity: pressed||spotify.connecting?0.65:1,
                    backgroundColor: spotify.connected?"rgba(29,185,84,0.22)":"rgba(255,255,255,0.10)",
                    borderColor: spotify.connected?"rgba(29,185,84,0.35)":"rgba(255,255,255,0.14)",
                  }]}
                >
                  <Entypo name="spotify" size={s(15)} color={spotify.connected?"#1DB954":"#fff"}/>
                  <Text style={[styles.pillText, spotify.connected && { color:"#76eea0" }]}>
                    {spotify.connecting ? "Connecting…" : "Spotify"}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setShowSettings(true)} style={({ pressed }) => [styles.pill,{opacity:pressed?0.85:1}]}>
                  <Ionicons name="options-outline" size={s(16)} color="#fff"/>
                  <Text style={styles.pillText}>Settings</Text>
                </Pressable>
              </View>

              {spotify.connected && (
                <View style={{ paddingHorizontal:s(16), marginTop:s(10) }}>
                  <SpotifyMiniPlayer onTrackChange={setCurrentTrack}/>
                </View>
              )}

              <View style={styles.timerSection}>
                {timerView !== "hidden" && (
                  <Pressable
                    onPress={toggleRun}
                    style={({ pressed }) => [styles.timerCard, { flex: 1, opacity: pressed ? 0.92 : 1 }]}
                  >
                    <Text style={styles.phaseTag}>{mainLabel}</Text>
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <Text style={[
                        styles.timerText,
                        timerView === "clock" && styles.timerTextClock,
                        timerMode === "timer" && timerView !== "clock" && styles.timerTextStopwatch,
                      ]}>
                        {portraitValue}
                      </Text>
                      <View style={styles.timerSubRow}>
                        <View style={[styles.dot, isRunning && styles.dotActive]}/>
                        <Text style={styles.timerSub}>{subLabel}</Text>
                      </View>
                    </View>
                  </Pressable>
                )}
              </View>

              {timerView !== "hidden" && (
                <Pressable onPress={resetTimer} style={({ pressed }) => [styles.resetLink, { opacity: pressed ? 0.75 : 1 }]}>
                  <Ionicons name="refresh" size={s(16)} color="rgba(255,255,255,0.85)"/>
                  <Text style={styles.resetText}>
                    {timerMode === "timer" ? "Reset timer" : "Reset session"}
                  </Text>
                </Pressable>
              )}

              <View style={styles.bottomBar}>
                <Pressable
                  onPress={toggleMute}
                  disabled={musicLoading}
                  style={({ pressed }) => [styles.actionPill, { opacity: pressed || musicLoading ? 0.88 : 1 }]}
                >
                  <Ionicons name={isMuted ? "volume-mute" : "musical-notes"} size={s(18)} color="#fff"/>
                  <Text style={styles.actionPillText}>
                    {musicLoading ? "Loading…" : isMuted ? "Enable Music" : "Disable Music"}
                  </Text>
                </Pressable>
                <Pressable onPress={cycleTimerView} style={({ pressed }) => [styles.actionPill, { opacity: pressed ? 0.88 : 1 }]}>
                  <Ionicons name={timerViewIcon} size={s(18)} color="#fff"/>
                  <Text style={styles.actionPillText}>{timerViewLabel}</Text>
                </Pressable>
              </View>
            </View>
          )}

        </SafeAreaView>

        {/* ── Leave confirm ── */}
        <Modal visible={showLeaveConfirm} transparent animationType="fade" onRequestClose={() => setShowLeaveConfirm(false)}>
          <View style={styles.dialogBackdrop}>
            <View style={styles.dialogBox}>
              <Ionicons name="warning-outline" size={s(44)} color="#FF6B6B"/>
              <Text style={styles.dialogTitle}>Leave Focus Room?</Text>
              <Text style={styles.dialogMsg}>Your session progress will be lost.</Text>
              <View style={styles.dialogBtns}>
                <Pressable onPress={() => setShowLeaveConfirm(false)} style={({ pressed }) => [styles.dialogBtn, styles.dialogBtnCancel,{opacity:pressed?0.85:1}]}>
                  <Text style={styles.dialogBtnText}>Stay</Text>
                </Pressable>
                <Pressable onPress={leaveRoom} style={({ pressed }) => [styles.dialogBtn, styles.dialogBtnConfirm,{opacity:pressed?0.85:1}]}>
                  <Text style={[styles.dialogBtnText,{color:"#FF6B6B"}]}>Leave</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Focus Room Tutorial ── */}
        <FocusRoomTutorial
          visible={showFocusTutorial}
          targetMinutes={tutorialTargetMins}
          onDone={() => {
            setShowFocusTutorial(false);
            saveFocusRoomTutorialSeen().catch(() => {});
          }}
        />

        {/* ── Settings sheet ── */}
        <BottomSheet visible={showSettings} onClose={() => setShowSettings(false)} title="Settings">
          <View style={styles.settingsTabs}>
            {(["timer", "tasks"] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setSettingsTab(tab)}
                style={({ pressed }) => [styles.settingsTab, {
                  backgroundColor: settingsTab === tab ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.05)",
                  borderColor: settingsTab === tab ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.10)",
                  opacity: pressed ? 0.85 : 1,
                }]}
              >
                <Ionicons name={tab === "tasks" ? "checkbox-outline" : "timer-outline"} size={s(14)} color={settingsTab === tab ? "#fff" : "rgba(255,255,255,0.5)"} />
                <Text style={[styles.settingsTabText, { color: settingsTab === tab ? "#fff" : "rgba(255,255,255,0.5)" }]}>
                  {tab === "tasks" ? "Tasks" : "Timer Mode"}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView style={{ maxHeight: s(440) }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: s(12), paddingTop: s(4) }}>

              {/* ══════════ TASKS TAB ══════════ */}
              {settingsTab === "tasks" && (
                <>
                  <View style={{ flexDirection: "row", gap: s(8), flexWrap: "wrap" }}>
                    {([
                      { k: "my-day",     label: "My Day",     icon: "sunny-outline" },
                      { k: "important",  label: "Important",  icon: "star-outline" },
                      { k: "planned",    label: "Planned",    icon: "calendar-outline" },
                      { k: "objectives", label: "Objectives", icon: "bookmark-outline" },
                    ] as const).map(({ k, label, icon }) => (
                      <Pressable
                        key={k}
                        onPress={() => setTaskSortMode(k)}
                        style={({ pressed }) => [styles.sortPill, {
                          backgroundColor: taskSortMode === k ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)",
                          borderColor: taskSortMode === k ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.14)",
                          opacity: pressed ? 0.85 : 1,
                        }]}
                      >
                        <Ionicons name={icon} size={s(13)} color={taskSortMode === k ? "#fff" : "rgba(255,255,255,0.55)"}/>
                        <Text style={[styles.sortPillText, { color: taskSortMode === k ? "#fff" : "rgba(255,255,255,0.55)" }]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {selectedTaskId && (
                    <Pressable onPress={() => setSelectedTaskId(null)} style={({ pressed }) => [styles.taskRow, { borderColor:"rgba(255,80,80,0.3)", backgroundColor:"rgba(255,80,80,0.08)", opacity:pressed?0.85:1 }]}>
                      <Ionicons name="close-circle-outline" size={s(15)} color="rgba(255,120,120,0.9)"/>
                      <Text style={[styles.taskRowText,{color:"rgba(255,150,150,0.9)",fontSize:s(12)}]}>Remove linked task</Text>
                    </Pressable>
                  )}

                  {taskSortMode === "objectives" ? (
                    (() => {
                      const activeObjectives = objectives.filter((o) => o.status !== "completed");
                      if (activeObjectives.length === 0) {
                        return <Text style={{ color:"rgba(255,255,255,0.4)", fontSize:s(12), fontWeight:"700", textAlign:"center", paddingVertical:s(14) }}>No objectives found</Text>;
                      }
                      return activeObjectives.map((obj) => {
                        const isOpen = expandedObjectives[obj.id] !== false;
                        const grpTasks = activeTasks.filter((t) => t.objectiveId === obj.id);
                        return (
                          <View key={obj.id} style={{ gap: s(6) }}>
                            <Pressable
                              onPress={() => setExpandedObjectives((prev) => ({ ...prev, [obj.id]: !isOpen }))}
                              style={({ pressed }) => [styles.objGroupHeader, {
                                borderRadius: s(10),
                                paddingVertical: s(8),
                                paddingHorizontal: s(10),
                                backgroundColor: "rgba(255,255,255,0.07)",
                                borderWidth: s(1),
                                borderColor: "rgba(255,255,255,0.12)",
                                opacity: pressed ? 0.85 : 1,
                              }]}
                            >
                              <Ionicons name="bookmark-outline" size={s(13)} color="rgba(255,255,255,0.55)"/>
                              <Text style={[styles.objGroupLabel, { flex: 1, color: "rgba(255,255,255,0.75)" }]} numberOfLines={1}>{obj.title}</Text>
                              <Text style={{ color: "rgba(255,255,255,0.35)", fontWeight: "700", fontSize: s(11) }}>{grpTasks.length}</Text>
                              {grpTasks.length > 0 && <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={s(13)} color="rgba(255,255,255,0.4)" />}
                            </Pressable>
                            {isOpen && grpTasks.map((t) => {
                              const active = t.id === selectedTaskId;
                              return (
                                <Pressable key={t.id} onPress={() => { setSelectedTaskId(t.id); setShowSettings(false); }} style={({ pressed }) => [styles.taskRow, {
                                  marginLeft: s(14),
                                  borderColor: active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.10)",
                                  backgroundColor: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
                                  opacity: pressed ? 0.85 : 1,
                                }]}>
                                  <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={s(15)} color={active ? "#fff" : "rgba(255,255,255,0.45)"}/>
                                  <Text style={styles.taskRowText} numberOfLines={1}>{t.title}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        );
                      });
                    })()
                  ) : (
                    (() => {
                      let sorted: typeof activeTasks;
                      if (taskSortMode === "my-day") {
                        sorted = activeTasks.filter((t) => t.deadline === todayKey());
                      } else if (taskSortMode === "important") {
                        sorted = activeTasks.filter((t) => (t.importance ?? 2) >= 3);
                      } else {
                        const all = [...activeTasks].sort((a, b) => {
                          const da = a.deadline ?? "9999-12-31";
                          const db = b.deadline ?? "9999-12-31";
                          return da.localeCompare(db);
                        });
                        const seenObjective = new Set<string>();
                        sorted = all.filter((t) => {
                          if (!t.objectiveId) return true;
                          if (seenObjective.has(t.objectiveId)) return false;
                          seenObjective.add(t.objectiveId);
                          return true;
                        });
                      }
                      if (sorted.length === 0) {
                        return (
                          <Text style={{ color:"rgba(255,255,255,0.4)", fontSize:s(12), fontWeight:"700", textAlign:"center", paddingVertical:s(10) }}>
                            {taskSortMode === "my-day" ? "No tasks due today" : taskSortMode === "important" ? "No starred tasks" : "No tasks"}
                          </Text>
                        );
                      }
                      return sorted.map((t) => {
                        const active = t.id === selectedTaskId;
                        const objTitle = objectivesById.get(t.objectiveId)?.title ?? "";
                        return (
                          <Pressable key={t.id} onPress={() => { setSelectedTaskId(t.id); setShowSettings(false); }} style={({ pressed }) => [styles.taskRow, {
                            borderColor: active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.14)",
                            backgroundColor: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)",
                            opacity: pressed ? 0.85 : 1,
                          }]}>
                            <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={s(15)} color={active ? "#fff" : "rgba(255,255,255,0.5)"}/>
                            <View style={{ flex:1 }}>
                              <Text style={styles.taskRowText} numberOfLines={1}>{t.title}</Text>
                              {!!objTitle && <Text style={{ color:"rgba(255,255,255,0.38)", fontSize:s(10), fontWeight:"700" }} numberOfLines={1}>{objTitle}</Text>}
                            </View>
                            {taskSortMode === "important" && <Ionicons name="star" size={s(12)} color="#FFD700"/>}
                          </Pressable>
                        );
                      });
                    })()
                  )}
                </>
              )}

              {/* ══════════ TIMER MODE TAB ══════════ */}
              {settingsTab === "timer" && (
                <>
                  <View style={{ gap: s(8) }}>
                    {([
                      { m: "timer"    as TimerMode, label: "Stopwatch", sub: "Count up freely — stop anytime", icon: "stopwatch-outline" as const },
                      { m: "pomodoro" as TimerMode, label: "Pomodoro",  sub: "Focused work intervals with breaks", icon: "timer-outline" as const },
                    ]).map(({ m, label, sub, icon }) => {
                      const active = timerMode === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => {
                            setTimerMode(m); setIsRunning(false); setPhase("work");
                            m === "timer" ? setElapsedSeconds(0) : setSecondsLeft(focusMinutes * 60);
                            sessionStartRef.current = null;
                          }}
                          style={({ pressed }) => [{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: s(12),
                            paddingVertical: s(14),
                            paddingHorizontal: s(14),
                            borderRadius: s(14),
                            borderWidth: active ? s(1.5) : s(1),
                            borderColor: active ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.12)",
                            backgroundColor: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                            opacity: pressed ? 0.85 : 1,
                          }]}
                        >
                          <View style={{ width: s(38), height: s(38), borderRadius: s(10), alignItems: "center", justifyContent: "center", backgroundColor: active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)" }}>
                            <Ionicons name={icon as any} size={s(18)} color={active ? "#fff" : "rgba(255,255,255,0.5)"}/>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: active ? "#fff" : "rgba(255,255,255,0.65)", fontWeight: "900", fontSize: s(14) }}>{label}</Text>
                            <Text style={{ color: "rgba(255,255,255,0.38)", fontWeight: "700", fontSize: s(11), marginTop: s(2) }}>{sub}</Text>
                          </View>
                          {active && <Ionicons name="checkmark-circle" size={s(18)} color="rgba(255,255,255,0.8)"/>}
                        </Pressable>
                      );
                    })}
                  </View>

                  {timerMode === "pomodoro" && (
                    <View style={{ borderRadius: s(14), borderWidth: s(1), borderColor: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
                      <Pressable
                        onPress={() => setPomoDurExpanded((v) => !v)}
                        style={({ pressed }) => [{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingVertical: s(13),
                          paddingHorizontal: s(14),
                          backgroundColor: "rgba(255,255,255,0.07)",
                          opacity: pressed ? 0.85 : 1,
                        }]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
                          <Ionicons name="time-outline" size={s(16)} color="rgba(255,255,255,0.75)"/>
                          <View>
                            <Text style={{ color: "#fff", fontWeight: "800", fontSize: s(13) }}>Durations</Text>
                            <Text style={{ color: "rgba(255,255,255,0.4)", fontWeight: "700", fontSize: s(11), marginTop: s(1) }}>
                              {focusMinutes}m focus · {breakMinutes}m break
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}>
                          <Text style={{ color: "rgba(255,255,255,0.35)", fontWeight: "700", fontSize: s(11) }}>{pomoDurExpanded ? "Done" : "Edit"}</Text>
                          <Ionicons name={pomoDurExpanded ? "chevron-up" : "chevron-down"} size={s(15)} color="rgba(255,255,255,0.45)"/>
                        </View>
                      </Pressable>

                      {pomoDurExpanded && (
                        <View style={{ padding: s(14), gap: s(14), backgroundColor: "rgba(255,255,255,0.03)" }}>
                          <SheetRow label="Focus">
                            <Stepper value={focusMinutes} onDec={() => setFocusMinutes((v) => clampInt(v-5,5,240))} onInc={() => setFocusMinutes((v) => clampInt(v+5,5,240))}/>
                          </SheetRow>
                          <SheetRow label="Break">
                            <Stepper value={breakMinutes} onDec={() => setBreakMinutes((v) => clampInt(v-1,1,60))} onInc={() => setBreakMinutes((v) => clampInt(v+1,1,60))}/>
                          </SheetRow>
                          <View>
                            <Text style={{ color: "rgba(255,255,255,0.38)", fontWeight: "700", fontSize: s(11), marginBottom: s(8), textTransform: "uppercase", letterSpacing: s(0.6) }}>Focus presets</Text>
                            <View style={{ flexDirection:"row", gap:s(8), flexWrap:"wrap" }}>
                              {[
                                { focus: 25, brk: 5  },
                                { focus: 45, brk: 10 },
                                { focus: 60, brk: 15 },
                                { focus: 90, brk: 20 },
                              ].map(({ focus, brk }) => {
                                const sel = focusMinutes === focus && breakMinutes === brk;
                                return (
                                  <Pressable
                                    key={focus}
                                    onPress={() => { setFocusMinutes(focus); setBreakMinutes(brk); }}
                                    style={({ pressed }) => [styles.chip, {
                                      borderColor: sel ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.14)",
                                      backgroundColor: sel ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)",
                                      opacity: pressed ? 0.85 : 1,
                                    }]}
                                  >
                                    <Text style={[styles.chipText, { color: sel ? "#fff" : "rgba(255,255,255,0.6)" }]}>{focus}/{brk}m</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}

              <View style={[styles.sheetFooter, { marginTop: s(4) }]}>
                <Pressable onPress={() => setShowSettings(false)} style={({ pressed }) => [styles.footerBtn,{opacity:pressed?0.85:1}]}>
                  <Text style={styles.footerBtnText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveSettings} style={({ pressed }) => [styles.footerBtn,{backgroundColor:"rgba(255,255,255,0.16)",opacity:pressed?0.85:1}]}>
                  <Text style={[styles.footerBtnText,{fontWeight:"900"}]}>Save</Text>
                </Pressable>
              </View>

            </View>
          </ScrollView>
        </BottomSheet>

      </LinearGradient>
    </ImageBackground>
  );
}

/* ─── Small helpers ──────────────────────────────────────────────────────── */

function BottomSheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}/>
      <View style={styles.sheet}>
        <View style={styles.sheetHandle}/>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} style={({ pressed }) => [{ opacity:pressed?0.7:1 }]}>
            <Ionicons name="close" size={s(22)} color="#fff"/>
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

function SheetRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
      <Text style={styles.sheetLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Stepper({ value, onDec, onInc }: { value: number; onDec: () => void; onInc: () => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onDec} style={({ pressed }) => [styles.stepBtn,{opacity:pressed?0.8:1}]}>
        <Ionicons name="remove" size={s(17)} color="#fff"/>
      </Pressable>
      <Text style={styles.stepValue}>{value} min</Text>
      <Pressable onPress={onInc} style={({ pressed }) => [styles.stepBtn,{opacity:pressed?0.8:1}]}>
        <Ionicons name="add" size={s(17)} color="#fff"/>
      </Pressable>
    </View>
  );
}

function AnimToggle({
  value, onChange, labelOn, labelOff, iconOn, iconOff, disabled,
}: {
  value: boolean;
  onChange: () => void;
  labelOn: string;
  labelOff: string;
  iconOn: any;
  iconOff: any;
  disabled?: boolean;
}) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: value ? 1 : 0, useNativeDriver: false, speed: 22, bounciness: 5 }).start();
  }, [value]);

  const trackBg = anim.interpolate({ inputRange: [0,1], outputRange: ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.22)"] });
  const thumbTx = anim.interpolate({ inputRange: [0,1], outputRange: [s(2), s(18)] });
  const thumbBg = anim.interpolate({ inputRange: [0,1], outputRange: ["rgba(255,255,255,0.30)", "#ffffff"] });

  return (
    <Pressable
      onPress={disabled ? undefined : onChange}
      style={({ pressed }) => [{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: s(9),
        paddingHorizontal: s(12),
        borderRadius: s(12),
        borderWidth: s(1),
        borderColor: value ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)",
        backgroundColor: value ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
        opacity: pressed || disabled ? 0.75 : 1,
        gap: s(8),
      }]}
    >
      <Ionicons name={value ? iconOn : iconOff} size={s(13)} color={value ? "#fff" : "rgba(255,255,255,0.45)"} />
      <Text style={{ flex: 1, color: value ? "#fff" : "rgba(255,255,255,0.45)", fontWeight: "800", fontSize: s(12) }}>
        {value ? labelOn : labelOff}
      </Text>
      <Animated.View style={{ width: s(36), height: s(20), borderRadius: s(10), backgroundColor: trackBg, justifyContent: "center", borderWidth: s(1), borderColor: "rgba(255,255,255,0.12)" }}>
        <Animated.View style={{ width: s(14), height: s(14), borderRadius: s(7), backgroundColor: thumbBg, position: "absolute", top: s(2), left: thumbTx as any }} />
      </Animated.View>
    </Pressable>
  );
}

/* ─── Landscape-specific styles ──────────────────────────────────────────── */
const ls = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  timerCol: { flex: 1, alignItems: "center", justifyContent: "center" },
  timerText: { color: "#fff", fontWeight: "200", textAlign: "center" },
  controlsCol: { width: s(200), paddingVertical: s(14), paddingHorizontal: s(14), borderLeftWidth: s(1), borderLeftColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(0,0,0,0.46)" },
  topRow: { flexDirection: "row", gap: s(8), flexWrap: "wrap" },
  spotifyPill: { marginTop: s(8), alignSelf: "flex-start" },
  bottomRow: { gap: s(8) },
  expandBtn: { position: "absolute", bottom: s(12), left: s(12) },
  immersiveMiniPlayer: { position: "absolute", top: s(20), right: s(20), maxWidth: s(280), zIndex: 30 },
});

/* ─── Shared styles ──────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex:1, paddingHorizontal:s(16) },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: s(6), gap: s(8) },
  pill: { flexDirection: "row", alignItems: "center", gap: s(5), paddingVertical: s(8), paddingHorizontal: s(11), borderRadius: s(999), backgroundColor: "rgba(255,255,255,0.10)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.14)" },
  pillText: { color:"#fff", fontWeight:"700", fontSize:s(12) },
  phaseLabel: { color: "rgba(255,255,255,0.45)", fontSize: s(10), fontWeight: "900", letterSpacing: s(1.8), textTransform: "uppercase", marginBottom: s(2) },
  timerSection: { flex: 1, paddingHorizontal: s(16), paddingTop: s(12), paddingBottom: Platform.OS === "ios" ? s(170) : s(90) },
  timerCard: { flex: 1, borderRadius: s(24), borderWidth: s(1), borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.04)", paddingHorizontal: s(18), paddingTop: s(20), paddingBottom: s(20), alignItems: "center", justifyContent: "flex-start" },
  phaseTag: { color: "rgba(255,255,255,0.75)", fontWeight: "900", fontSize: s(13), letterSpacing: s(0.5), marginBottom: s(10), textTransform: "uppercase" },
  timerText: { color: "#fff", fontSize: s(80), fontWeight: "300", letterSpacing: s(-2), lineHeight: s(86) },
  timerTextClock: { fontWeight: "300", letterSpacing: s(2) },
  timerTextStopwatch: { fontSize: s(60), letterSpacing: s(-1) },
  timerSubRow: { flexDirection: "row", alignItems: "center", gap: s(8), marginTop: s(12) },
  dot: { width: s(7), height: s(7), borderRadius: s(999), backgroundColor: "rgba(255,255,255,0.28)" },
  dotActive: { backgroundColor: "#1DB954" },
  timerSub: { color:"rgba(255,255,255,0.6)", fontWeight:"700", fontSize:s(12) },
  resetLink: { position: "absolute", bottom: Platform.OS === "ios" ? s(88) : s(72), alignSelf: "center", flexDirection: "row", gap: s(6), alignItems: "center" },
  resetText: { color: "rgba(255,255,255,0.75)", fontWeight: "700", fontSize: s(12) },
  immersiveArt: { position: "absolute", bottom: Platform.OS === "ios" ? s(90) : s(72), left: s(16), flexDirection: "row", alignItems: "center", gap: s(10), maxWidth: "55%" },
  immersiveArtImg: { width: s(44), height: s(44), borderRadius: s(10), borderWidth: s(1), borderColor: "rgba(255,255,255,0.2)" },
  immersiveTrackInfo: { flex: 1 },
  immersiveTrackName: { color: "#fff", fontWeight: "700", fontSize: s(12) },
  immersiveArtistName: { color: "rgba(255,255,255,0.5)", fontWeight: "600", fontSize: s(11), marginTop: s(1) },
  expandBtn: { width: s(40), height: s(40), borderRadius: s(999), backgroundColor: "rgba(255,255,255,0.10)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", zIndex: 20 },
  bottomBar: { position: "absolute", bottom: Platform.OS === "ios" ? s(110) : s(16), left: s(16), right: s(16), flexDirection: "row", gap: s(12), justifyContent: "center" },
  actionPill: { flexDirection: "row", alignItems: "center", gap: s(8), paddingVertical: s(12), paddingHorizontal: s(16), borderRadius: s(999), backgroundColor: "rgba(20,24,32,0.72)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.18)" },
  actionPillText: { color:"#fff", fontWeight:"800", fontSize:s(13) },
  roomTitle: { color:"#fff", fontSize:s(26), fontWeight:"900", textAlign:"center", marginBottom:s(6) },
  roomSubtitle: { color:"rgba(255,255,255,0.6)", fontSize:s(13), fontWeight:"700", textAlign:"center", marginBottom:s(22) },
  roomCard: { width:"100%", height:s(175), borderRadius:s(18), overflow:"hidden", borderWidth:s(1), borderColor:"rgba(255,255,255,0.14)" },
  roomCardImg: { flex:1, width:"100%" },
  roomCardOverlay: { flex:1, justifyContent:"space-between", padding:s(18) },
  roomCardLabel: { color:"#fff", fontSize:s(22), fontWeight:"900" },
  roomCardEnterBtn: { flexDirection:"row", alignItems:"center", gap:s(8), alignSelf:"flex-end", backgroundColor:"rgba(255,255,255,0.18)", paddingVertical:s(9), paddingHorizontal:s(14), borderRadius:s(999), borderWidth:s(1), borderColor:"rgba(255,255,255,0.22)" },
  roomCardEnterText: { color:"#fff", fontWeight:"900", fontSize:s(13) },
  dialogBackdrop: { flex:1, backgroundColor:"rgba(0,0,0,0.75)", alignItems:"center", justifyContent:"center", padding:s(20) },
  dialogBox: { backgroundColor:"rgba(16,20,30,0.98)", borderRadius:s(20), padding:s(24), width:"100%", maxWidth:s(340), alignItems:"center", borderWidth:s(1), borderColor:"rgba(255,255,255,0.12)" },
  dialogTitle: { color:"#fff", fontSize:s(18), fontWeight:"900", marginTop:s(14), marginBottom:s(6) },
  dialogMsg: { color:"rgba(255,255,255,0.6)", fontSize:s(13), fontWeight:"700", textAlign:"center", marginBottom:s(22) },
  dialogBtns: { flexDirection:"row", gap:s(12), width:"100%" },
  dialogBtn: { flex:1, paddingVertical:s(13), borderRadius:s(14), alignItems:"center", borderWidth:s(1) },
  dialogBtnCancel: { backgroundColor:"rgba(255,255,255,0.10)", borderColor:"rgba(255,255,255,0.14)" },
  dialogBtnConfirm: { backgroundColor:"rgba(255,107,107,0.10)", borderColor:"rgba(255,107,107,0.2)" },
  dialogBtnText: { color:"#fff", fontSize:s(13), fontWeight:"900" },
  sheetBackdrop: { flex:1, backgroundColor:"rgba(0,0,0,0.45)" },
  sheet: { paddingHorizontal:s(16), paddingTop:s(10), paddingBottom:Platform.OS==="ios"?s(32):s(20), backgroundColor:"rgba(12,16,24,0.98)", borderTopLeftRadius:s(22), borderTopRightRadius:s(22), borderWidth:s(1), borderColor:"rgba(255,255,255,0.10)" },
  sheetHandle: { width:s(40), height:s(4), borderRadius:s(999), backgroundColor:"rgba(255,255,255,0.2)", alignSelf:"center", marginBottom:s(10) },
  sheetHeader: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:s(14) },
  sheetTitle: { color:"#fff", fontWeight:"900", fontSize:s(16) },
  sectionLabel: { color:"rgba(255,255,255,0.4)", fontWeight:"800", fontSize:s(11), textTransform:"uppercase", letterSpacing:s(0.8) },
  sheetLabel: { color:"rgba(255,255,255,0.85)", fontWeight:"800", fontSize:s(13) },
  stepper: { flexDirection:"row", alignItems:"center", gap:s(10), paddingVertical:s(7), paddingHorizontal:s(10), borderRadius:s(14), backgroundColor:"rgba(255,255,255,0.08)", borderWidth:s(1), borderColor:"rgba(255,255,255,0.12)" },
  stepBtn: { width:s(32), height:s(32), borderRadius:s(16), alignItems:"center", justifyContent:"center", backgroundColor:"rgba(255,255,255,0.10)", borderWidth:s(1), borderColor:"rgba(255,255,255,0.12)" },
  stepValue: { color:"#fff", fontWeight:"900", fontSize:s(13), minWidth:s(54), textAlign:"center" },
  chip: { paddingVertical:s(10), paddingHorizontal:s(12), borderRadius:s(999), borderWidth:s(1) },
  chipText: { color:"#fff", fontWeight:"900", fontSize:s(12) },
  sheetFooter: { flexDirection:"row", justifyContent:"flex-end", gap:s(10), marginTop:s(8) },
  footerBtn: { paddingVertical:s(11), paddingHorizontal:s(14), borderRadius:s(14), borderWidth:s(1), borderColor:"rgba(255,255,255,0.12)", backgroundColor:"rgba(255,255,255,0.08)" },
  footerBtnText: { color:"#fff", fontWeight:"800", fontSize:s(13) },
  taskRow: { flexDirection:"row", alignItems:"center", gap:s(10), paddingVertical:s(10), paddingHorizontal:s(12), borderRadius:s(14), borderWidth:s(1) },
  taskRowText: { color:"#fff", fontWeight:"800", fontSize:s(13) },
  settingsTabs: { flexDirection: "row", gap: s(8), marginBottom: s(14) },
  settingsTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: s(6), paddingVertical: s(10), borderRadius: s(12), borderWidth: s(1) },
  settingsTabText: { fontWeight: "800", fontSize: s(13) },
  sortPill: { flexDirection: "row", alignItems: "center", gap: s(5), paddingVertical: s(7), paddingHorizontal: s(11), borderRadius: s(999), borderWidth: s(1) },
  sortPillText: { fontWeight: "800", fontSize: s(12) },
  objGroupHeader: { flexDirection: "row", alignItems: "center", gap: s(5), paddingVertical: s(4), paddingHorizontal: s(4) },
  objGroupLabel: { color: "rgba(255,255,255,0.45)", fontWeight: "800", fontSize: s(11), textTransform: "uppercase", letterSpacing: s(0.6) },
  modeChip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: s(7), paddingVertical: s(12), borderRadius: s(14), borderWidth: s(1) },
  modeChipText: { fontWeight: "800", fontSize: s(13) },
});