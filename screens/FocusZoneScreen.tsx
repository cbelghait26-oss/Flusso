import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Pressable,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/components/theme/theme";
import { useGlobalMusic } from "../src/services/GlobalMusicPlayer";
import { s } from "react-native-size-matters";
import {
  loadTasks,
  loadObjectives,
  saveFocusSession,
  todayKey,
  loadFocusBackground,
  saveFocusBackground,
  loadFocusMinutes,
  saveFocusMinutes,
  loadBreakMinutes,
  saveBreakMinutes,
} from "../src/data/storage";
import type { Task, Objective } from "../src/data/models";
import Entypo from '@expo/vector-icons/Entypo';
import { SpotifyMiniPlayer } from "../src/components/SpotifyMiniPlayer";
import { useSpotifyRemote } from "../src/hooks/useSpotifyRemote";

const BACKGROUNDS = [
  {
    id: "mountain",
    label: "Mountain",
    source: require("../assets/focus/mountainMOB.png"),
  },
  {
    id: "forest",
    label: "Forest",
    source: require("../assets/focus/forest1.png"),
  },
  {
    id: "ocean",
    label: "Ocean",
    source: require("../assets/focus/Ocean1.png"),
  },
  { id: "space", label: "Space", source: require("../assets/focus/space.png") },
  {
    id: "skyline",
    label: "Skyline",
    source: require("../assets/focus/skylineMOB.png"),
  },
];

function clampInt(n: number, min: number, max: number) {
  const x = Math.floor(Number.isFinite(n) ? n : min);
  return Math.max(min, Math.min(max, x));
}

type Phase = "work" | "break";

export default function FocusZoneScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { isMuted, toggleMute, loading } = useGlobalMusic();

  // Spotify (Focus screen only)
  const spotify = useSpotifyRemote();

  // Log music state changes
  useEffect(() => {
    console.log("FocusZone: Music state - isMuted:", isMuted, "loading:", loading);
  }, [isMuted, loading]);

  // Room navigation
  const [isInRoom, setIsInRoom] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(BACKGROUNDS[0]);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [displayTime, setDisplayTime] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);

  // Tasks & Objectives
  const [tasks, setTasks] = useState<Task[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);

  const [phase, setPhase] = useState<Phase>("work");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);

  const cueRef = useRef<Audio.Sound | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitioningRef = useRef(false);
  const sessionStartTimeRef = useRef<string | null>(null);

  // sheets
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showTaskSheet, setShowTaskSheet] = useState(false);

  // task selection
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  // Active tasks only (no completed)
  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== "completed"),
    [tasks],
  );

  // Objectives map for displaying objective titles
  const objectivesById = useMemo(() => {
    const m = new Map<string, Objective>();
    objectives.forEach((o) => m.set(o.id, o));
    return m;
  }, [objectives]);

  /* ------------------ LOAD ------------------ */
  useEffect(() => {
    (async () => {
      const storedBg = await loadFocusBackground();
      const storedFocus = await loadFocusMinutes();
      const storedBreak = await loadBreakMinutes();

      if (storedBg) {
        const found = BACKGROUNDS.find((b) => b.id === storedBg);
        if (found) setBackground(found);
      }

      const fm = clampInt(storedFocus, 5, 240);
      setFocusMinutes(fm);
      setSecondsLeft(fm * 60);

      const bm = clampInt(storedBreak, 1, 60);
      setBreakMinutes(bm);

      const loadedTasks = await loadTasks();
      const loadedObjectives = await loadObjectives();
      setTasks(loadedTasks);
      setObjectives(loadedObjectives);
    })();
  }, []);

  /* ------------------ CUE SOUND ------------------ */
  const ensureCueLoaded = async () => {
    if (cueRef.current) return cueRef.current;

    const { sound } = await Audio.Sound.createAsync(
      require("../assets/focus/timer_cue.mp3"),
      { volume: 0.6 },
    );

    cueRef.current = sound;
    return sound;
  };

  const playCueOnce = async () => {
    const sfx = await ensureCueLoaded();
    await sfx.setPositionAsync(0);

    await new Promise<void>((resolve) => {
      sfx.setOnPlaybackStatusUpdate((st) => {
        if (!st.isLoaded) return;
        if (st.didJustFinish) {
          sfx.setOnPlaybackStatusUpdate(null);
          resolve();
        }
      });
      void sfx.playAsync();
    });
  };

  const playCueTwice = async () => {
    try {
      await playCueOnce();
      await playCueOnce();
    } catch {}
  };

  const unloadCue = async () => {
    try {
      await cueRef.current?.unloadAsync();
    } catch {}
    cueRef.current = null;
  };

  /* ------------------ TIMER ------------------ */
  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isRunning]);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!displayTime) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [displayTime]);

  useEffect(() => {
    if (!isRunning) return;
    if (secondsLeft > 0) return;
    if (transitioningRef.current) return;

    transitioningRef.current = true;

    (async () => {
      try {
        await playCueTwice();
      } catch {}

      if (phase === "work" && sessionStartTimeRef.current) {
        await saveFocusSession({
          date: todayKey(),
          startTime: sessionStartTimeRef.current,
          minutes: focusMinutes,
          taskId: selectedTaskId || undefined,
        });
      }

      const nextPhase: Phase = phase === "work" ? "break" : "work";
      const nextSeconds =
        (nextPhase === "work" ? focusMinutes : breakMinutes) * 60;

      if (nextPhase === "work") {
        const now = new Date();
        sessionStartTimeRef.current = `${now
          .getHours()
          .toString()
          .padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      }

      setPhase(nextPhase);
      setSecondsLeft(nextSeconds);
      transitioningRef.current = false;
    })();
  }, [secondsLeft, isRunning, phase, focusMinutes, breakMinutes, selectedTaskId]);

  const toggleRun = () => {
    if (secondsLeft <= 0) {
      const snap = (phase === "work" ? focusMinutes : breakMinutes) * 60;
      setSecondsLeft(snap);
    }

    if (!isRunning && phase === "work" && !sessionStartTimeRef.current) {
      const now = new Date();
      sessionStartTimeRef.current = `${now
        .getHours()
        .toString()
        .padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    }

    setIsRunning((v) => !v);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setPhase("work");
    setSecondsLeft(focusMinutes * 60);
    sessionStartTimeRef.current = null;
  };

  const formatTime = () => {
    const m = Math.floor(secondsLeft / 60);
    const sLeft = secondsLeft % 60;
    return `${m}:${String(sLeft).padStart(2, "0")}`;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      void unloadCue();
    };
  }, []);

  /* ------------------ SETTINGS SAVE ------------------ */
  const saveSettings = async () => {
    const fm = clampInt(focusMinutes, 5, 240);
    const bm = clampInt(breakMinutes, 1, 60);

    await saveFocusMinutes(fm);
    await saveBreakMinutes(bm);

    if (!isRunning) {
      setSecondsLeft((phase === "work" ? fm : bm) * 60);
    }

    setShowSettingsSheet(false);
  };

  const taskLabel = selectedTask ? selectedTask.title : "Link a task";

  const phaseLabel =
    phase === "work" ? (selectedTask ? selectedTask.title : "Work") : "Break";
  const subLabel = isRunning
    ? phase === "work"
      ? "Focusing…"
      : "Recovering…"
    : secondsLeft <= 0
      ? "Session ended. Tap to restart"
      : "Tap to start";

  /* ------------------ ROOM NAVIGATION ------------------ */
  const enterRoom = (room: typeof BACKGROUNDS[0]) => {
    setCurrentRoom(room);
    setBackground(room);
    setIsInRoom(true);
  };

  const attemptLeaveRoom = () => {
    if (
      isRunning ||
      secondsLeft <
        (phase === "work" ? focusMinutes * 60 : breakMinutes * 60)
    ) {
      setShowLeaveConfirm(true);
    } else {
      leaveRoom();
    }
  };

  const leaveRoom = () => {
    setIsInRoom(false);
    setShowLeaveConfirm(false);
    resetTimer();
  };

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  /* ------------------ RENDER ------------------ */

  if (!isInRoom) {
    return (
      <ImageBackground
        source={require("../assets/focus/mountainMOB.png")}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={["rgba(0,0,0,0.22)", "rgba(0,0,0,0.88)"]}
          style={{ flex: 1 }}
        >
          <SafeAreaView style={styles.container}>
            <View style={styles.topBar}>
              <Pressable
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [
                  styles.iconPill,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Ionicons name="chevron-back" size={s(14)} color="#fff" />
                <Text style={styles.pillText}>Dashboard</Text>
              </Pressable>
            </View>

            <View style={styles.roomSelectionContainer}>
              <Text style={styles.roomSelectionTitle}>Choose Your Focus Room</Text>
              <Text style={styles.roomSelectionSubtitle}>
                Select an environment to begin your focus session
              </Text>

              <ScrollView
                style={styles.roomGrid}
                contentContainerStyle={{ paddingBottom: s(100) }}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ gap: s(16) }}>
                  {BACKGROUNDS.map((room) => (
                    <Pressable
                      key={room.id}
                      onPress={() => enterRoom(room)}
                      style={({ pressed }) => [
                        styles.roomCard,
                        { opacity: pressed ? 0.9 : 1 },
                      ]}
                    >
                      <ImageBackground
                        source={room.source}
                        style={styles.roomCardImage}
                        imageStyle={{ borderRadius: s(18) }}
                      >
                        <LinearGradient
                          colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.75)"]}
                          style={styles.roomCardOverlay}
                        >
                          <Text style={styles.roomCardLabel}>{room.label}</Text>
                          <View style={styles.roomCardEnter}>
                            <Text style={styles.roomCardEnterText}>Enter Room</Text>
                            <Ionicons name="arrow-forward" size={s(18)} color="#fff" />
                          </View>
                        </LinearGradient>
                      </ImageBackground>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={currentRoom.source} style={{ flex: 1 }}>
      <LinearGradient
        colors={["rgba(0,0,0,0.22)", "rgba(0,0,0,0.88)"]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.container} edges={["top"]}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: s(100) }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topBar}>
              <Pressable
                onPress={attemptLeaveRoom}
                style={({ pressed }) => [
                  styles.iconPill,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Ionicons name="chevron-back" size={s(14)} color="#fff" />
                <Text style={styles.pillText}>Leave Room</Text>
              </Pressable>

              <View style={{ flexDirection: "row", gap: s(8) }}>
                <Pressable
                  onPress={spotify.connected ? spotify.disconnect : spotify.connect}
                  disabled={spotify.connecting}
                  style={({ pressed }) => [
                    styles.smallIconPill,
                    {
                      opacity: pressed || spotify.connecting ? 0.65 : 1,
                      backgroundColor: spotify.connected 
                        ? "rgba(29, 185, 84, 0.25)" 
                        : "rgba(29, 185, 84, 0.18)",
                    },
                  ]}
                >
                  <Entypo name="spotify" size={s(18)} color="#1DB954" />
                  <Text style={[styles.smallPillText, { color: "#76eea0" }]}>
                    {spotify.connecting 
                      ? "Connecting..." 
                      : spotify.connected 
                        ? "Spotify On" 
                        : "Spotify"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowSettingsSheet(true)}
                  style={({ pressed }) => [
                    styles.smallIconPill,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Ionicons name="options-outline" size={s(16)} color="#fff" />
                  <Text style={styles.smallPillText}>Settings</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={() => setShowTaskSheet(true)}
              style={({ pressed }) => [
                styles.taskBadge,
                {
                  opacity: pressed ? 0.92 : 1,
                  borderColor: "rgba(255,255,255,0.14)",
                },
              ]}
            >
              <Ionicons name="list-outline" size={s(18)} color="#fff" />
              <Text style={styles.taskBadgeText} numberOfLines={1}>
                {taskLabel}
              </Text>
              <Ionicons
                name="chevron-down"
                size={s(16)}
                color="rgba(255,255,255,0.75)"
              />
            </Pressable>

            <View style={{ marginTop: s(12) }}>
              <SpotifyMiniPlayer />
            </View>

            <View style={styles.center}>
              <View style={styles.timerContainer}>
                {!hideTimer && (
                  <Pressable
                    onPress={toggleRun}
                    style={({ pressed }) => [
                      styles.timerCard,
                      {
                        borderColor: "rgba(255,255,255,0.16)",
                        backgroundColor: "rgba(255,255,255,0.10)",
                        opacity: pressed ? 0.92 : 1,
                      },
                    ]}
                  >
                    <Text style={styles.phaseTag}>{phaseLabel}</Text>
                    <Text style={[styles.timerText, displayTime && styles.timerTextClockDisplay]}>
                      {displayTime ? getCurrentTime() : formatTime()}
                    </Text>
                    <View style={styles.timerSubRow}>
                      <View style={styles.dot} />
                      <Text style={styles.timerSub}>{subLabel}</Text>
                    </View>
                  </Pressable>
                )}
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={toggleMute}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.actionPill,
                    {
                      backgroundColor: "rgba(255,255,255,0.12)",
                      opacity: pressed || loading ? 0.88 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={isMuted ? "volume-mute" : "musical-notes"}
                    size={s(18)}
                    color="#fff"
                  />
                  <Text style={styles.actionPillText}>
                    {loading ? "Loading..." : isMuted ? "Disable" : "Enable"} Music
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setHideTimer((v) => !v)}
                  style={({ pressed }) => [
                    styles.actionPill,
                    {
                      backgroundColor: "rgba(255,255,255,0.12)",
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={hideTimer ? "eye" : "eye-off"}
                    size={s(18)}
                    color="#fff"
                  />
                  <Text style={styles.actionPillText}>
                    {hideTimer ? "Show" : "Hide"} 
                  </Text>
                </Pressable>
              </View>

              {!hideTimer && (
                <Pressable
                  onPress={resetTimer}
                  style={({ pressed }) => [
                    styles.resetLink,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Ionicons
                    name="refresh"
                    size={s(16)}
                    color="rgba(255,255,255,0.85)"
                  />
                  <Text style={styles.resetText}>Reset session</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>

        <Modal
          visible={showLeaveConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLeaveConfirm(false)}
        >
          <View style={styles.dialogBackdrop}>
            <View style={styles.dialogBox}>
              <Ionicons name="warning-outline" size={s(48)} color="#FF6B6B" />
              <Text style={styles.dialogTitle}>Leave Focus Room?</Text>
              <Text style={styles.dialogMessage}>
                If you leave now, you will lose your current session progress.
              </Text>
              <View style={styles.dialogButtons}>
                <Pressable
                  onPress={() => setShowLeaveConfirm(false)}
                  style={({ pressed }) => [
                    styles.dialogBtn,
                    styles.dialogBtnCancel,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={styles.dialogBtnText}>Stay</Text>
                </Pressable>
                <Pressable
                  onPress={leaveRoom}
                  style={({ pressed }) => [
                    styles.dialogBtn,
                    styles.dialogBtnConfirm,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[styles.dialogBtnText, { color: "#FF6B6B" }]}>
                    Leave
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <BottomSheet
          visible={showSettingsSheet}
          onClose={() => setShowSettingsSheet(false)}
          title="Timer settings"
        >
          <View style={{ gap: s(12) }}>
            <Row label="Focus">
              <Stepper
                value={focusMinutes}
                onDec={() => setFocusMinutes((v) => clampInt(v - 5, 5, 240))}
                onInc={() => setFocusMinutes((v) => clampInt(v + 5, 5, 240))}
              />
            </Row>

            <Row label="Break">
              <Stepper
                value={breakMinutes}
                onDec={() => setBreakMinutes((v) => clampInt(v - 1, 1, 60))}
                onInc={() => setBreakMinutes((v) => clampInt(v + 1, 1, 60))}
              />
            </Row>

            <Row label="Display Time">
              <Pressable
                onPress={() => setDisplayTime((v) => !v)}
                style={({ pressed }) => [
                  styles.toggleBtn,
                  {
                    backgroundColor: displayTime
                      ? "rgba(255,255,255,0.18)"
                      : "rgba(255,255,255,0.08)",
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <Text style={styles.toggleBtnText}>
                  {displayTime ? "Clock" : "Timer"}
                </Text>
                <Ionicons
                  name={displayTime ? "time-outline" : "timer-outline"}
                  size={s(18)}
                  color="#fff"
                />
              </Pressable>
            </Row>

            <View
              style={{
                flexDirection: "row",
                gap: s(10),
                marginTop: s(6),
                flexWrap: "wrap",
              }}
            >
              {[1, 15, 25, 45, 60].map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setFocusMinutes(p)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      borderColor: "rgba(255,255,255,0.18)",
                      backgroundColor:
                        focusMinutes === p
                          ? "rgba(255,255,255,0.18)"
                          : "rgba(255,255,255,0.08)",
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Text style={styles.chipText}>{p} min</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.sheetFooter}>
              <Pressable
                onPress={() => setShowSettingsSheet(false)}
                style={({ pressed }) => [
                  styles.footerBtn,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.footerBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={saveSettings}
                style={({ pressed }) => [
                  styles.footerBtn,
                  {
                    backgroundColor: "rgba(255,255,255,0.16)",
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.footerBtnText, { fontWeight: "900" }]}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </BottomSheet>

        <BottomSheet
          visible={showTaskSheet}
          onClose={() => setShowTaskSheet(false)}
          title="Link a task"
        >
          <ScrollView style={{ maxHeight: s(280) }} showsVerticalScrollIndicator={false}>
            {activeTasks.length === 0 ? (
              <View style={{ paddingVertical: s(20), alignItems: "center" }}>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontWeight: "800",
                    fontSize: s(13),
                  }}
                >
                  No active tasks found
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.50)",
                    fontWeight: "700",
                    fontSize: s(12),
                    marginTop: s(4),
                  }}
                >
                  Create a task in Tasks & Objectives
                </Text>
              </View>
            ) : (
              <View style={{ gap: s(10) }}>
                {activeTasks.map((t) => {
                  const active = t.id === selectedTaskId;
                  const objTitle = objectivesById.get(t.objectiveId)?.title ?? "";
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        setSelectedTaskId(t.id);
                        setShowTaskSheet(false);
                      }}
                      style={({ pressed }) => [
                        styles.taskRow,
                        {
                          borderColor: active
                            ? "rgba(255,255,255,0.55)"
                            : "rgba(255,255,255,0.14)",
                          backgroundColor: active
                            ? "rgba(255,255,255,0.14)"
                            : "rgba(255,255,255,0.08)",
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, gap: s(6) }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
                          <Ionicons
                            name={active ? "checkmark-circle" : "ellipse-outline"}
                            size={s(18)}
                            color="#fff"
                          />
                          <Text style={styles.taskRowText} numberOfLines={1}>
                            {t.title}
                          </Text>
                        </View>

                        {objTitle && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: s(6),
                              marginLeft: s(26),
                            }}
                          >
                            <Ionicons
                              name="bookmark-outline"
                              size={s(12)}
                              color="rgba(255,255,255,0.55)"
                            />
                            <Text
                              style={{
                                color: "rgba(255,255,255,0.55)",
                                fontWeight: "800",
                                fontSize: s(11),
                              }}
                              numberOfLines={1}
                            >
                              {objTitle}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </BottomSheet>
      </LinearGradient>
    </ImageBackground>
  );
}

/* ------------------ Small UI helpers ------------------ */

function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
            <Ionicons name="close" size={s(22)} color="#fff" />
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.sheetLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Stepper({
  value,
  onDec,
  onInc,
}: {
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onDec} style={({ pressed }) => [styles.stepBtn, { opacity: pressed ? 0.8 : 1 }]}>
        <Ionicons name="remove" size={s(18)} color="#fff" />
      </Pressable>

      <Text style={styles.stepValue}>{value} min</Text>

      <Pressable onPress={onInc} style={({ pressed }) => [styles.stepBtn, { opacity: pressed ? 0.8 : 1 }]}>
        <Ionicons name="add" size={s(18)} color="#fff" />
      </Pressable>
    </View>
  );
}

/* ------------------ STYLES ------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: s(16) },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: s(6),
  },

  iconPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
    paddingVertical: s(11),
    paddingHorizontal: s(14),
    borderRadius: s(999),
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.14)",
  },
  pillText: { color: "#fff", fontWeight: "900", fontSize: s(13) },
  smallIconPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(5),
    paddingVertical: s(8),
    paddingHorizontal: s(10),
    borderRadius: s(999),
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.14)",
  },
  smallPillText: { color: "#fff", fontWeight: "900", fontSize: s(11) },

  roomSelectionContainer: {
    flex: 1,
    paddingTop: s(40),
  },
  roomSelectionTitle: {
    color: "#fff",
    fontSize: s(28),
    fontWeight: "900",
    textAlign: "center",
    marginBottom: s(8),
  },
  roomSelectionSubtitle: {
    color: "rgba(255,255,255,0.70)",
    fontSize: s(14),
    fontWeight: "700",
    textAlign: "center",
    marginBottom: s(32),
  },
  roomGrid: {
    flex: 1,
  },
  roomCard: {
    width: "100%",
    height: s(180),
    borderRadius: s(18),
    overflow: "hidden",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.16)",
  },
  roomCardImage: {
    flex: 1,
    width: "100%",
  },
  roomCardOverlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: s(20),
  },
  roomCardLabel: {
    color: "#fff",
    fontSize: s(24),
    fontWeight: "900",
  },
  roomCardEnter: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    alignSelf: "flex-end",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: s(10),
    paddingHorizontal: s(16),
    borderRadius: s(999),
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.25)",
  },
  roomCardEnterText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: s(13),
  },

  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: s(20),
  },
  dialogBox: {
    backgroundColor: "rgba(20, 25, 35, 0.98)",
    borderRadius: s(20),
    padding: s(24),
    width: "100%",
    maxWidth: s(340),
    alignItems: "center",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.12)",
  },
  dialogTitle: {
    color: "#fff",
    fontSize: s(20),
    fontWeight: "900",
    marginTop: s(16),
    marginBottom: s(8),
  },
  dialogMessage: {
    color: "rgba(255,255,255,0.70)",
    fontSize: s(14),
    fontWeight: "700",
    textAlign: "center",
    marginBottom: s(24),
    lineHeight: s(20),
  },
  dialogButtons: {
    flexDirection: "row",
    gap: s(12),
    width: "100%",
  },
  dialogBtn: {
    flex: 1,
    paddingVertical: s(14),
    borderRadius: s(14),
    alignItems: "center",
    borderWidth: s(1),
  },
  dialogBtnCancel: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  dialogBtnConfirm: {
    backgroundColor: "rgba(255,107,107,0.14)",
    borderColor: "rgba(255,107,107,0.25)",
  },
  dialogBtnText: {
    color: "#fff",
    fontSize: s(14),
    fontWeight: "900",
  },

  taskBadge: {
    marginTop: s(14),
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
    paddingVertical: s(12),
    paddingHorizontal: s(14),
    borderRadius: s(16),
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: s(1),
  },
  taskBadgeText: { color: "#fff", fontWeight: "900", flex: 1, fontSize: s(13) },

  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: s(60),
    flexGrow: 1,
  },

  timerContainer: {
    width: "100%",
    minHeight: s(200),
    justifyContent: "center",
    alignItems: "center",
  },

  timerCard: {
    width: "100%",
    borderRadius: s(22),
    borderWidth: s(1),
    paddingVertical: s(26),
    paddingHorizontal: s(18),
    alignItems: "center",
  },
  phaseTag: {
    color: "rgba(255,255,255,0.80)",
    fontWeight: "900",
    fontSize: s(12),
    marginBottom: s(8),
  },
  timerText: {
    color: "#fff",
    fontSize: s(64),
    fontWeight: "600",
    letterSpacing: s(-0.5),
    fontFamily: "System",
  },
  timerTextClockDisplay: {
    fontFamily: "SF Pro Display",
    fontWeight: "400",
    letterSpacing: s(1),
  },
  timerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    marginTop: s(10),
  },
  dot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  timerSub: {
    color: "rgba(255,255,255,0.78)",
    fontWeight: "800",
    fontSize: s(12),
  },

  actionRow: { 
    flexDirection: "row", 
    gap: s(12), 
    marginTop: s(16),
    justifyContent: "center",
    paddingHorizontal: s(16),
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    paddingVertical: s(12),
    paddingHorizontal: s(16),
    borderRadius: s(999),
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.14)",
  },
  actionPillText: { color: "#fff", fontWeight: "900", fontSize: s(13) },

  resetLink: {
    marginTop: s(14),
    flexDirection: "row",
    gap: s(8),
    alignItems: "center",
  },
  resetText: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "800",
    fontSize: s(12),
  },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    paddingHorizontal: s(16),
    paddingTop: s(10),
    paddingBottom: Platform.OS === "ios" ? s(24) : s(18),
    backgroundColor: "rgba(15, 20, 28, 0.98)",
    borderTopLeftRadius: s(22),
    borderTopRightRadius: s(22),
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.10)",
  },
  sheetHandle: {
    width: s(44),
    height: s(5),
    borderRadius: s(999),
    backgroundColor: "rgba(255,255,255,0.25)",
    alignSelf: "center",
    marginBottom: s(10),
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: s(12),
  },
  sheetTitle: { color: "#fff", fontWeight: "900", fontSize: s(16) },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetLabel: { color: "rgba(255,255,255,0.85)", fontWeight: "900" },

  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
    paddingVertical: s(10),
    paddingHorizontal: s(14),
    borderRadius: s(14),
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.14)",
  },
  toggleBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: s(13),
  },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
    paddingVertical: s(8),
    paddingHorizontal: s(10),
    borderRadius: s(14),
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.12)",
  },
  stepBtn: {
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.14)",
  },
  stepValue: {
    color: "#fff",
    fontWeight: "900",
    fontSize: s(13),
    minWidth: s(56),
    textAlign: "center",
  },

  chip: {
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    borderRadius: s(999),
    borderWidth: s(1),
  },
  chipText: { color: "#fff", fontWeight: "900", fontSize: s(12) },

  sheetFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: s(10),
    marginTop: s(14),
  },
  footerBtn: {
    paddingVertical: s(12),
    paddingHorizontal: s(14),
    borderRadius: s(14),
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  footerBtnText: { color: "#fff", fontWeight: "800" },

  taskRow: {
    paddingVertical: s(14),
    paddingHorizontal: s(12),
    borderRadius: s(16),
    borderWidth: s(1),
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
  },
  taskRowText: { color: "#fff", fontWeight: "900", fontSize: s(13), flex: 1 },
});
