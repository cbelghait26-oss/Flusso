// screens/TrainingRoomScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAudioPlayer } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import { useFocusEffect } from "@react-navigation/native";
import { s } from "../src/ui/ts";
import { useSpotifyRemote } from "../src/hooks/useSpotifyRemote";
import { SpotifyMiniPlayer, type TrackInfo } from "../src/components/SpotifyMiniPlayer";
import {
  loadTasks,
  loadTrainingPlans,
  saveFocusSession,
  todayKey,
  updateTrainingPlan,
  updateTask,
  loadTrainingRoomTutorialSeen,
  saveTrainingRoomTutorialSeen,
} from "../src/data/storage";
import { TrainingRoomTutorial } from "../src/components/ui/TrainingRoomTutorial";
import type { Task, TrainingPlan } from "../src/data/models";

// ─── Types ────────────────────────────────────────────────────────────────────
type TrainingPhase = "select" | "pick-exercise" | "work" | "rest" | "ready" | "complete";

type SetLogEntry = {
  setNumber: number;
  reps:      string;
  weight:    string;
  notes:     string;
};

type ExerciseLog = {
  exerciseName: string;
  sets:         SetLogEntry[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clampInt(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.floor(Number.isFinite(n) ? n : lo)));
}

function fmtSecs(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const sec = totalSecs % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({
  value, onDec, onInc, unit = "sets", formatVal,
}: {
  value: number; onDec: () => void; onInc: () => void;
  unit?: string; formatVal?: (v: number) => string;
}) {
  return (
    <View style={ss.stepper}>
      <Pressable onPress={onDec} style={({ pressed }) => [ss.stepBtn, { opacity: pressed ? 0.8 : 1 }]}>
        <Ionicons name="remove" size={s(17)} color="#fff" />
      </Pressable>
      <Text style={ss.stepValue}>{formatVal ? formatVal(value) : `${value} ${unit}`}</Text>
      <Pressable onPress={onInc} style={({ pressed }) => [ss.stepBtn, { opacity: pressed ? 0.8 : 1 }]}>
        <Ionicons name="add" size={s(17)} color="#fff" />
      </Pressable>
    </View>
  );
}

// ─── ToggleRow ────────────────────────────────────────────────────────────────
function ToggleRow({
  label, sub, value, onChange,
}: {
  label: string; sub: string; value: boolean; onChange: () => void;
}) {
  return (
    <Pressable
      onPress={onChange}
      style={({ pressed }) => [ss.toggleRow, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={ss.settingLabel}>{label}</Text>
        <Text style={ss.settingSubLabel}>{sub}</Text>
      </View>
      <View style={[ss.toggleTrack, value && ss.toggleTrackOn]}>
        <View style={[ss.toggleThumb, value && ss.toggleThumbOn]} />
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function TrainingRoomScreen({ navigation }: any) {
  const spotify = useSpotifyRemote();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [plans, setPlans]   = useState<TrainingPlan[]>([]);
  const [, setCurrentTrack] = useState<TrackInfo | null>(null);

  // ── Phase machine ─────────────────────────────────────────────────────────
  const [phase,      setPhase]      = useState<TrainingPhase>("select");
  const [currentSet, setCurrentSet] = useState(1);

  // ── Selected task ─────────────────────────────────────────────────────────
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // ── Settings ──────────────────────────────────────────────────────────────
  const [totalSets,     setTotalSets]     = useState(4);
  const [restSeconds,   setRestSeconds]   = useState(90);
  const [exerciseLabel, setExerciseLabel] = useState("");
  const [autoStartRest, setAutoStartRest] = useState(true);
  const [soundEnabled,  setSoundEnabled]  = useState(true);
  const [showSettings,  setShowSettings]  = useState(false);

  // ── Exercises & workout log ────────────────────────────────────────────────
  const [exercises,            setExercises]            = useState<string[]>([]);
  const [currentExerciseName,  setCurrentExerciseName]  = useState("");
  const [doneExercises,        setDoneExercises]        = useState<string[]>([]);
  const [workoutLog,           setWorkoutLog]           = useState<ExerciseLog[]>([]);
  const [pendingEntry,         setPendingEntry]         = useState({ reps: "", weight: "", notes: "" });
  const [weightUnit,           setWeightUnit]           = useState<"kg" | "lbs">("lbs");
  const [showSetLog,           setShowSetLog]           = useState(false);
  const [pickExerciseInput,    setPickExerciseInput]    = useState("");
  const [showExerciseDecision, setShowExerciseDecision] = useState(false);

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  // ── Rest timer ────────────────────────────────────────────────────────────
  const [restLeft, setRestLeft]   = useState(restSeconds);
  const restMaxRef = useRef(restSeconds);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Leave confirm ─────────────────────────────────────────────────────────
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // ── Tutorial ──────────────────────────────────────────────────────────────
  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    loadTrainingRoomTutorialSeen()
      .then((seen) => { if (!seen) setShowTutorial(true); })
      .catch(() => {});
  }, []);

  // ── Session tracking ──────────────────────────────────────────────────────
  const sessionStartRef = useRef<Date | null>(null);
  const [sessionDurSec, setSessionDurSec] = useState(0);
  const sessionTickRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Sound ─────────────────────────────────────────────────────────────────
  const cuePlayer = useAudioPlayer(require("../assets/Completed.mp3"));

  // ── Animations ────────────────────────────────────────────────────────────
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const trophyAnim   = useRef(new Animated.Value(0)).current;

  // ─── Load data ─────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const [t, p] = await Promise.all([loadTasks(), loadTrainingPlans()]);
        if (mounted) { setTasks(t); setPlans(p); }
      })();
      return () => { mounted = false; };
    }, [])
  );

  // ─── Training plan tasks only ──────────────────────────────────────────────
  const trainingTasks = useMemo(
    () => tasks.filter((t) => t.status !== "completed" && !!t.trainingPlanId),
    [tasks]
  );

  // ─── One next task per plan (earliest deadline) ───────────────────────────
  const tasksByPlan = useMemo(() => {
    const map = new Map<string, { plan: TrainingPlan; task: Task }>();
    const sorted = [...trainingTasks].sort((a, b) => {
      const da = a.deadline ?? "9999-12-31";
      const db = b.deadline ?? "9999-12-31";
      return da.localeCompare(db);
    });
    for (const t of sorted) {
      if (!t.trainingPlanId) continue;
      if (map.has(t.trainingPlanId)) continue;
      const plan = plans.find((p) => p.id === t.trainingPlanId);
      if (!plan) continue;
      map.set(t.trainingPlanId, { plan, task: t });
    }
    return Array.from(map.values());
  }, [trainingTasks, plans]);

  // ─── Session wall-clock tick ───────────────────────────────────────────────
  useEffect(() => {
    if (phase === "select" || phase === "complete" || phase === "pick-exercise") {
      if (sessionTickRef.current) { clearInterval(sessionTickRef.current); sessionTickRef.current = null; }
      return;
    }
    sessionTickRef.current = setInterval(() => {
      if (!sessionStartRef.current) return;
      setSessionDurSec(Math.floor((Date.now() - sessionStartRef.current.getTime()) / 1000));
    }, 1000);
    return () => { if (sessionTickRef.current) { clearInterval(sessionTickRef.current); sessionTickRef.current = null; } };
  }, [phase]);

  // ─── Rest countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "rest") {
      if (restIntervalRef.current) { clearInterval(restIntervalRef.current); restIntervalRef.current = null; }
      return;
    }
    restIntervalRef.current = setInterval(() => {
      setRestLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => { if (restIntervalRef.current) { clearInterval(restIntervalRef.current); restIntervalRef.current = null; } };
  }, [phase]);

  // ─── Rest hits zero → move to ready ───────────────────────────────────────
  useEffect(() => {
    if (phase !== "rest" || restLeft > 0) return;
    if (restIntervalRef.current) { clearInterval(restIntervalRef.current); restIntervalRef.current = null; }
    void playCue();
    try { Vibration.vibrate([0, 200, 100, 200]); } catch {}
    setPhase("ready");
  }, [restLeft, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Trophy animation (complete phase) ──────────────────────────────────
  useEffect(() => {
    if (phase === "complete") {
      trophyAnim.setValue(0);
      Animated.spring(trophyAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Pulse animation (ready phase) ────────────────────────────────────────
  useEffect(() => {
    if (phase === "ready") {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 650, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 650, useNativeDriver: true }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (restIntervalRef.current)  clearInterval(restIntervalRef.current);
      if (sessionTickRef.current)   clearInterval(sessionTickRef.current);
      pulseLoopRef.current?.stop();
    };
  }, []);

  // ─── Sound ────────────────────────────────────────────────────────────────
  const playCue = useCallback(async () => {
    if (!soundEnabledRef.current) return;
    try {
      cuePlayer.volume = 0.7;
      cuePlayer.seekTo(0);
      cuePlayer.play();
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Save focus session on completion ─────────────────────────────────────
  const saveSession = async () => {
    if (!sessionStartRef.current) return;
    const now  = new Date();
    const mins = Math.max(1, Math.floor((now.getTime() - sessionStartRef.current.getTime()) / 60_000));
    const hh   = sessionStartRef.current.getHours().toString().padStart(2, "0");
    const mm   = sessionStartRef.current.getMinutes().toString().padStart(2, "0");
    try {
      await saveFocusSession({ date: todayKey(), startTime: `${hh}:${mm}`, minutes: mins, taskId: selectedTask?.id });
    } catch {}
  };

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setCurrentSet(1);
    setRestLeft(restSeconds);
    restMaxRef.current = restSeconds;
    sessionStartRef.current = new Date();
    setSessionDurSec(0);
    const plan = plans.find((p) => p.id === task.trainingPlanId);
    const matchedSession = plan?.sessions.find((s) => !s.isRest && s.name === task.title);
    const planExercises: string[] = (matchedSession?.exercises ?? []).filter(Boolean);
    const initExercises =
      planExercises.length > 0
        ? planExercises
        : exerciseLabel.trim()
        ? [exerciseLabel.trim()]
        : [];
    setExercises(initExercises);
    setCurrentExerciseName("");
    setDoneExercises([]);
    setWorkoutLog([]);
    setPickExerciseInput("");
    setPhase("pick-exercise");
  };

  const handlePickExercise = (name: string) => {
    setCurrentExerciseName(name);
    setCurrentSet(1);
    setPickExerciseInput("");
    setPhase("work");
  };

  const handleAddNewExercise = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setExercises((prev) => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    if (selectedTask?.trainingPlanId) {
      const plan = plans.find((p) => p.id === selectedTask.trainingPlanId);
      if (plan) {
        const updatedSessions = plan.sessions.map((session) => {
          if (session.isRest) return session;
          if (session.name !== selectedTask.title) return session;
          if (session.exercises.includes(trimmed)) return session;
          return { ...session, exercises: [...session.exercises, trimmed] };
        });
        updateTrainingPlan(plan.id, { sessions: updatedSessions }).catch(() => {});
        setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, sessions: updatedSessions } : p));
      }
    }
    setPickExerciseInput("");
    handlePickExercise(trimmed);
  };

  const handleCompleteSet = () => {
    try { Vibration.vibrate(150); } catch {}
    setPendingEntry({ reps: "", weight: "", notes: "" });
    setShowSetLog(true);
  };

  const handleSaveSetLog = () => {
    const exName = currentExerciseName || `Exercise`;
    const rawWeight = pendingEntry.weight.trim();
    const weightStr = rawWeight && !/kg|lbs|lb\b|bodyweight|bw/i.test(rawWeight)
      ? `${rawWeight} ${weightUnit}`
      : rawWeight;
    const entry: SetLogEntry = {
      setNumber: currentSet,
      reps:      pendingEntry.reps,
      weight:    weightStr,
      notes:     pendingEntry.notes,
    };
    setWorkoutLog((prev) => {
      const updated = [...prev];
      const idx = updated.findIndex((l) => l.exerciseName === exName);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], sets: [...updated[idx].sets, entry] };
      } else {
        updated.push({ exerciseName: exName, sets: [entry] });
      }
      return updated;
    });
    setShowSetLog(false);
    if (currentSet >= totalSets) {
      setDoneExercises((prev) => prev.includes(exName) ? prev : [...prev, exName]);
      void playCue();
      setShowExerciseDecision(true);
    } else {
      if (autoStartRest) {
        setRestLeft(restSeconds);
        restMaxRef.current = restSeconds;
        setPhase("rest");
      } else {
        setPhase("ready");
      }
    }
  };

  const handleAddAnotherExercise = () => {
    setShowExerciseDecision(false);
    setCurrentExerciseName("");
    setPickExerciseInput("");
    setPhase("pick-exercise");
  };

  const handleEndWorkout = () => {
    setShowExerciseDecision(false);
    void saveSession();
    if (selectedTask) {
      updateTask(selectedTask.id, { status: "completed" }).catch(() => {});
    }
    setPhase("complete");
  };

  const handleStartNextSet = () => {
    setCurrentSet((n) => n + 1);
    setPhase("work");
  };

  const handleSkipRest = () => {
    if (restIntervalRef.current) { clearInterval(restIntervalRef.current); restIntervalRef.current = null; }
    setPhase("ready");
  };

  const handleAddRestTime = () => setRestLeft((n) => n + 15);

  const attemptLeave = () => {
    if (phase === "select" || phase === "complete") { navigation.goBack(); return; }
    setShowLeaveConfirm(true);
  };

  const confirmLeave = () => {
    if (restIntervalRef.current)  clearInterval(restIntervalRef.current);
    if (sessionTickRef.current)   clearInterval(sessionTickRef.current);
    navigation.goBack();
  };

  // ─── Derived labels ───────────────────────────────────────────────────────
  const planName = selectedTask
    ? (plans.find((p) => p.id === selectedTask.trainingPlanId)?.name ?? selectedTask.title)
    : "";
  const displayLabel = currentExerciseName || exerciseLabel.trim() || "";

  const fmtDuration = () => {
    const h   = Math.floor(sessionDurSec / 3600);
    const m   = Math.floor((sessionDurSec % 3600) / 60);
    const sec = sessionDurSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  const restBarPct = restMaxRef.current > 0 ? (restLeft / restMaxRef.current) * 100 : 0;

  const fmtRestSetting = (v: number) =>
    v < 60 ? `${v}s` : `${Math.floor(v / 60)}m${v % 60 > 0 ? ` ${v % 60}s` : ""}`;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={["#050810", "#0a1628", "#0f2040"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* ── Top Bar ── */}
        <View style={ss.topBar}>
          <Pressable onPress={attemptLeave} style={({ pressed }) => [ss.pill, { opacity: pressed ? 0.85 : 1 }]}>
            <Entypo name="chevron-left" size={s(14)} color="#fff" />
            <Text style={ss.pillText}>{phase === "select" ? "Back" : "Leave"}</Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: s(8) }}>
            <Pressable
              onPress={spotify.connected ? spotify.disconnect : spotify.connect}
              disabled={spotify.connecting}
              style={({ pressed }) => [ss.pill, {
                opacity: pressed || spotify.connecting ? 0.65 : 1,
                backgroundColor: spotify.connected ? "rgba(29,185,84,0.22)" : "rgba(255,255,255,0.10)",
                borderColor:     spotify.connected ? "rgba(29,185,84,0.35)" : "rgba(255,255,255,0.14)",
              }]}
            >
              <Entypo name="spotify" size={s(14)} color={spotify.connected ? "#1DB954" : "#fff"} />
              <Text style={[ss.pillText, spotify.connected && { color: "#76eea0" }]}>
                {spotify.connecting ? "Connecting…" : "Spotify"}
              </Text>
            </Pressable>
            {phase !== "select" && (
              <Pressable onPress={() => setShowSettings(true)} style={({ pressed }) => [ss.pill, { opacity: pressed ? 0.85 : 1 }]}>
                <Ionicons name="options-outline" size={s(15)} color="#fff" />
                <Text style={ss.pillText}>Settings</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Spotify mini player ── */}
        {spotify.connected && phase !== "select" && (
          <View style={{ paddingHorizontal: s(16), marginTop: s(6) }}>
            <SpotifyMiniPlayer onTrackChange={setCurrentTrack} />
          </View>
        )}

        {/* ═══════════════ SELECT PHASE ═══════════════ */}
        {phase === "select" && (
          <ScrollView contentContainerStyle={ss.selectContent} showsVerticalScrollIndicator={false}>
            <View style={ss.selectHeader}>
              <View style={ss.iconBadge}>
                <Ionicons name="barbell-outline" size={s(30)} color={BLUE} />
              </View>
              <Text style={ss.pageTitle}>Training Room</Text>
              <Text style={ss.pageSubtitle}>Select a session to begin your workout</Text>
            </View>

            {tasksByPlan.length === 0 ? (
              <View style={ss.emptyBox}>
                <Ionicons name="barbell-outline" size={s(36)} color="rgba(255,255,255,0.14)" />
                <Text style={ss.emptyTitle}>No training sessions found</Text>
                <Text style={ss.emptySubText}>
                  Create a training plan in the Tasks screen, then come back to start a session.
                </Text>
              </View>
            ) : (
              tasksByPlan.map(({ plan, task }) => (
                <Pressable
                  key={plan.id}
                  onPress={() => handleSelectTask(task)}
                  style={({ pressed }) => [ss.taskCard, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={ss.planGroupHeader}>
                      <Ionicons name="fitness-outline" size={s(12)} color="rgba(74,157,255,0.7)" />
                      <Text style={ss.planGroupLabel}>{plan.name}</Text>
                    </View>
                    <Text style={ss.taskCardTitle} numberOfLines={1}>{task.title}</Text>
                    {task.deadline && (
                      <Text style={ss.taskCardSub}>{task.deadline}</Text>
                    )}
                  </View>
                  <View style={ss.taskCardStartBadge}>
                    <Text style={ss.taskCardStartText}>Start</Text>
                    <Ionicons name="arrow-forward" size={s(13)} color={BLUE} />
                  </View>
                </Pressable>
              ))
            )}

            <Pressable
              onPress={() => setShowSettings(true)}
              style={({ pressed }) => [ss.settingsStrip, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Ionicons name="options-outline" size={s(14)} color="rgba(255,255,255,0.5)" />
              <Text style={ss.settingsStripText}>
                {totalSets} sets · {fmtRestSetting(restSeconds)} rest{exerciseLabel.trim() ? ` · ${exerciseLabel.trim()}` : ""}
              </Text>
              <Ionicons name="chevron-forward" size={s(13)} color="rgba(255,255,255,0.28)" />
            </Pressable>
          </ScrollView>
        )}

        {/* ═══════════════ PICK EXERCISE PHASE ═══════════════ */}
        {phase === "pick-exercise" && (
          <ScrollView
            contentContainerStyle={ss.selectContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={ss.selectHeader}>
              <View style={ss.iconBadge}>
                <Ionicons name="fitness-outline" size={s(30)} color={BLUE} />
              </View>
              <Text style={ss.pageTitle}>Choose Exercise</Text>
              {doneExercises.length > 0 && (
                <Text style={ss.pageSubtitle}>{doneExercises.length} done this workout</Text>
              )}
            </View>

            {(() => {
              const available = exercises.filter((e) => !doneExercises.includes(e));
              return available.length > 0 ? (
                <View style={{ gap: s(10) }}>
                  <Text style={ss.sectionLabelPicker}>FROM YOUR PLAN</Text>
                  <View style={ss.exerciseChipRow}>
                    {available.map((ex) => (
                      <Pressable
                        key={ex}
                        onPress={() => handlePickExercise(ex)}
                        style={({ pressed }) => [ss.exerciseChip, { opacity: pressed ? 0.8 : 1 }]}
                      >
                        <Ionicons name="barbell-outline" size={s(13)} color={BLUE} />
                        <Text style={ss.exerciseChipText}>{ex}</Text>
                        <Ionicons name="arrow-forward" size={s(12)} color="rgba(74,157,255,0.55)" />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={[ss.emptyBox, { borderColor: "rgba(74,157,255,0.18)", backgroundColor: "rgba(74,157,255,0.05)" }]}>
                  <Ionicons name="checkmark-done-circle-outline" size={s(30)} color="rgba(74,157,255,0.45)" />
                  <Text style={[ss.emptyTitle, { color: "rgba(74,157,255,0.7)" }]}>All plan exercises done</Text>
                  <Text style={ss.emptySubText}>Add a custom exercise below to keep going</Text>
                </View>
              );
            })()}

            {doneExercises.length > 0 && (
              <View style={{ gap: s(8) }}>
                <Text style={ss.sectionLabelPicker}>COMPLETED</Text>
                <View style={ss.exerciseChipRow}>
                  {doneExercises.map((ex) => (
                    <View key={ex} style={[ss.exerciseChip, { backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", opacity: 0.5 }]}>
                      <Ionicons name="checkmark-circle" size={s(13)} color="rgba(255,255,255,0.4)" />
                      <Text style={[ss.exerciseChipText, { color: "rgba(255,255,255,0.35)" }]}>{ex}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={{ gap: s(8) }}>
              <Text style={ss.sectionLabelPicker}>ADD NEW EXERCISE</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
                <TextInput
                  value={pickExerciseInput}
                  onChangeText={setPickExerciseInput}
                  placeholder="e.g. Pull-ups, Romanian Deadlift…"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  style={[ss.textInput, { flex: 1 }]}
                  returnKeyType="done"
                  onSubmitEditing={() => handleAddNewExercise(pickExerciseInput)}
                  autoCorrect={false}
                />
                <Pressable
                  onPress={() => handleAddNewExercise(pickExerciseInput)}
                  style={({ pressed }) => [ss.stepBtn, {
                    opacity: pressed ? 0.8 : 1,
                    backgroundColor: pickExerciseInput.trim() ? BLUE_DIM : "rgba(255,255,255,0.06)",
                    borderColor:     pickExerciseInput.trim() ? BLUE_BORDER : "rgba(255,255,255,0.10)",
                    width: s(44), height: s(44), borderRadius: s(14),
                  }]}
                >
                  <Ionicons name="arrow-forward" size={s(18)} color={pickExerciseInput.trim() ? BLUE : "rgba(255,255,255,0.3)"} />
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}

        {/* ═══════════════ ACTIVE PHASES ═══════════════ */}
        {phase !== "select" && phase !== "pick-exercise" && (
          <View style={{ flex: 1, paddingHorizontal: s(20) }}>

            {!!planName && (
              <Text style={ss.planTag} numberOfLines={1}>{planName.toUpperCase()}</Text>
            )}

            <View style={ss.centerContent}>

              {/* ─── WORK ─── */}
              {phase === "work" && (
                <>
                  {!!displayLabel && (
                    <Text style={ss.exerciseLabel} numberOfLines={2}>{displayLabel}</Text>
                  )}
                  <Text style={ss.setCounter}>{`Set ${currentSet}`}</Text>
                  <Text style={ss.setTotal}>{`of ${totalSets}`}</Text>
                  <Text style={ss.phaseSub}>Tap when done</Text>
                </>
              )}

              {/* ─── REST ─── */}
              {phase === "rest" && (
                <>
                  <Text style={ss.completedLabel}>{`Set ${currentSet} done`}</Text>
                  <Text style={ss.restTimer}>{fmtSecs(restLeft)}</Text>
                  <Text style={ss.phaseSub}>
                    {currentSet < totalSets
                      ? `Next: Set ${currentSet + 1} of ${totalSets}`
                      : "Exercise complete · rest up"}
                  </Text>
                  <View style={ss.restBarTrack}>
                    <View style={[ss.restBarFill, { width: `${restBarPct}%` as any }]} />
                  </View>
                </>
              )}

              {/* ─── READY ─── */}
              {phase === "ready" && (
                <>
                  {!!displayLabel && (
                    <Text style={ss.exerciseLabel} numberOfLines={2}>{displayLabel}</Text>
                  )}
                  <Animated.Text style={[ss.setCounter, { transform: [{ scale: pulseAnim }] }]}>
                    {`Set ${currentSet + 1}`}
                  </Animated.Text>
                  <Text style={ss.setTotal}>{`of ${totalSets}`}</Text>
                  <Text style={[ss.phaseSub, { color: BLUE }]}>Ready when you are</Text>
                </>
              )}

              {/* ─── COMPLETE ─── */}
              {phase === "complete" && (
                <>
                  <Animated.View style={[ss.trophyBadge, {
                    transform: [
                      { scale: trophyAnim },
                      { rotate: trophyAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: ["0deg", "-8deg", "0deg"] }) },
                    ],
                    opacity: trophyAnim,
                  }]}>
                    <Ionicons name="trophy" size={s(44)} color="#FFD700" />
                  </Animated.View>
                  <Text style={ss.completeTitle}>Workout Complete!</Text>
                  <Text style={[ss.completeDuration, { marginTop: s(2) }]}>
                    {doneExercises.length} exercise{doneExercises.length === 1 ? "" : "s"}{sessionDurSec > 0 ? ` · ${fmtDuration()}` : ""}
                  </Text>
                  {workoutLog.length > 0 && (
                    <ScrollView
                      style={{ width: "100%", maxHeight: s(260), marginTop: s(18) }}
                      contentContainerStyle={{ gap: s(14) }}
                      showsVerticalScrollIndicator={false}
                    >
                      {workoutLog.map((exLog, exIdx) => (
                        <View key={exIdx}>
                          <Text style={{ color: BLUE, fontWeight: "800", fontSize: s(11), letterSpacing: s(0.8), marginBottom: s(6), textTransform: "uppercase" }}>
                            {exLog.exerciseName}
                          </Text>
                          {exLog.sets.map((setEntry, si) => (
                            <View
                              key={si}
                              style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: s(8), paddingVertical: s(5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.07)" }}
                            >
                              <Text style={{ color: "rgba(255,255,255,0.38)", fontWeight: "700", fontSize: s(11), width: s(44) }}>
                                Set {setEntry.setNumber}
                              </Text>
                              {!!setEntry.reps   && <Text style={{ color: "rgba(255,255,255,0.75)", fontWeight: "600", fontSize: s(12) }}>{setEntry.reps} reps</Text>}
                              {!!setEntry.weight && <Text style={{ color: "rgba(255,255,255,0.55)", fontWeight: "600", fontSize: s(12) }}>· {setEntry.weight}</Text>}
                              {!!setEntry.notes  && <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: s(11), flexShrink: 1 }}>{setEntry.notes}</Text>}
                            </View>
                          ))}
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}
            </View>

            {/* Bottom actions */}
            <View style={ss.bottomActions}>
              {phase === "work" && (
                <Pressable
                  onPress={handleCompleteSet}
                  style={({ pressed }) => [ss.primaryBtn, { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                >
                  <Ionicons name="checkmark-circle" size={s(22)} color="#fff" />
                  <Text style={ss.primaryBtnText}>Complete Set</Text>
                </Pressable>
              )}

              {phase === "rest" && (
                <View style={ss.restActions}>
                  <Pressable
                    onPress={handleAddRestTime}
                    style={({ pressed }) => [ss.outlineBtn, { flex: 1, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Ionicons name="add-circle-outline" size={s(18)} color="rgba(255,255,255,0.75)" />
                    <Text style={ss.outlineBtnText}>+15s</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSkipRest}
                    style={({ pressed }) => [ss.outlineBtn, { flex: 2, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Ionicons name="play-skip-forward" size={s(18)} color="rgba(255,255,255,0.75)" />
                    <Text style={ss.outlineBtnText}>Skip Rest</Text>
                  </Pressable>
                </View>
              )}

              {phase === "ready" && (
                <Pressable
                  onPress={handleStartNextSet}
                  style={({ pressed }) => [ss.primaryBtn, ss.primaryBtnBlue, { opacity: pressed ? 0.88 : 1 }]}
                >
                  <Ionicons name="barbell-outline" size={s(22)} color={BLUE} />
                  <Text style={[ss.primaryBtnText, { color: BLUE }]}>Start Set {currentSet + 1}</Text>
                </Pressable>
              )}

              {phase === "complete" && (
                <Pressable
                  onPress={() => navigation.goBack()}
                  style={({ pressed }) => [ss.primaryBtn, { opacity: pressed ? 0.88 : 1 }]}
                >
                  <Ionicons name="checkmark-done" size={s(22)} color="#fff" />
                  <Text style={ss.primaryBtnText}>Done</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ── Leave Confirm ── */}
        <Modal visible={showLeaveConfirm} transparent animationType="fade" onRequestClose={() => setShowLeaveConfirm(false)}>
          <View style={ss.dialogBackdrop}>
            <View style={ss.dialogBox}>
              <Ionicons name="warning-outline" size={s(42)} color="#FF6B6B" />
              <Text style={ss.dialogTitle}>End Workout?</Text>
              <Text style={ss.dialogMsg}>Your current session progress will not be saved.</Text>
              <View style={ss.dialogBtns}>
                <Pressable onPress={() => setShowLeaveConfirm(false)} style={({ pressed }) => [ss.dialogBtn, ss.dialogBtnCancel, { opacity: pressed ? 0.85 : 1 }]}>
                  <Text style={ss.dialogBtnText}>Keep Going</Text>
                </Pressable>
                <Pressable onPress={confirmLeave} style={({ pressed }) => [ss.dialogBtn, ss.dialogBtnConfirm, { opacity: pressed ? 0.85 : 1 }]}>
                  <Text style={[ss.dialogBtnText, { color: "#FF6B6B" }]}>End Workout</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Set Log Sheet ── */}
        <Modal visible={showSetLog} transparent animationType="slide" onRequestClose={() => handleSaveSetLog()}>
          <Pressable style={ss.sheetBackdrop} onPress={() => handleSaveSetLog()} />
          <View style={ss.sheet}>
            <View style={ss.sheetHandle} />
            <View style={ss.sheetHeader}>
              <View>
                <Text style={ss.sheetTitle}>Log Set {currentSet}</Text>
                {!!currentExerciseName && (
                  <Text style={[ss.settingSubLabel, { color: "rgba(74,157,255,0.8)", marginTop: s(2) }]}>{currentExerciseName}</Text>
                )}
              </View>
              <Pressable onPress={() => handleSaveSetLog()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <Text style={{ color: BLUE, fontWeight: "900", fontSize: s(15) }}>Save</Text>
              </Pressable>
            </View>
            <View style={{ gap: s(14), paddingBottom: s(20) }}>
              <View style={{ gap: s(6) }}>
                <Text style={ss.settingLabel}>Reps</Text>
                <TextInput
                  value={pendingEntry.reps}
                  onChangeText={(v) => setPendingEntry((e) => ({ ...e, reps: v }))}
                  placeholder="e.g. 10, 8–10, AMRAP"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  style={ss.textInput}
                  returnKeyType="next"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ gap: s(6) }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={ss.settingLabel}>Weight</Text>
                  <View style={unitSS.toggle}>
                    {(["kg", "lbs"] as const).map((u) => (
                      <Pressable key={u} onPress={() => setWeightUnit(u)} style={[unitSS.chip, weightUnit === u && unitSS.chipActive]}>
                        <Text style={[unitSS.text, weightUnit === u && unitSS.textActive]}>{u}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <TextInput
                  value={pendingEntry.weight}
                  onChangeText={(v) => setPendingEntry((e) => ({ ...e, weight: v }))}
                  placeholder="e.g. 80, BW, BW+10"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  style={ss.textInput}
                  returnKeyType="next"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ gap: s(6) }}>
                <Text style={ss.settingLabel}>Notes</Text>
                <TextInput
                  value={pendingEntry.notes}
                  onChangeText={(v) => setPendingEntry((e) => ({ ...e, notes: v }))}
                  placeholder="Optional notes…"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  style={[ss.textInput, { minHeight: s(64), textAlignVertical: "top" }]}
                  multiline
                />
              </View>
              <Pressable onPress={() => handleSaveSetLog()} style={({ pressed }) => [ss.primaryBtn, { opacity: pressed ? 0.88 : 1 }]}>
                <Ionicons name="checkmark-circle" size={s(20)} color="#fff" />
                <Text style={ss.primaryBtnText}>
                  {currentSet >= totalSets ? "Save & Finish Exercise" : "Save & Rest"}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* ── Exercise Decision ── */}
        <Modal visible={showExerciseDecision} transparent animationType="none" onRequestClose={() => {}}>
          <View style={ss.dialogBackdrop}>
            <View style={ss.dialogBox}>
              <View style={[ss.trophyBadge, { backgroundColor: "rgba(74,157,255,0.12)", borderColor: BLUE_BORDER, marginBottom: s(4) }]}>
                <Ionicons name="checkmark-circle" size={s(38)} color={BLUE} />
              </View>
              <Text style={ss.dialogTitle}>{currentExerciseName || "Exercise"} done!</Text>
              <Text style={ss.dialogMsg}>
                {doneExercises.length} exercise{doneExercises.length === 1 ? "" : "s"} completed · what's next?
              </Text>
              <View style={{ width: "100%", gap: s(12) }}>
                <Pressable onPress={handleAddAnotherExercise} style={({ pressed }) => [ss.primaryBtn, ss.primaryBtnBlue, { opacity: pressed ? 0.85 : 1 }]}>
                  <Ionicons name="add-circle-outline" size={s(18)} color={BLUE} />
                  <Text style={[ss.primaryBtnText, { color: BLUE }]}>Add Exercise</Text>
                </Pressable>
                <Pressable onPress={handleEndWorkout} style={({ pressed }) => [ss.primaryBtn, { opacity: pressed ? 0.85 : 1, backgroundColor: "rgba(255,107,107,0.12)", borderColor: "rgba(255,107,107,0.35)" }]}>
                  <Ionicons name="stop-circle-outline" size={s(18)} color="#FF6B6B" />
                  <Text style={[ss.primaryBtnText, { color: "#FF6B6B" }]}>Finish Workout</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Settings Sheet ── */}
        <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
          <Pressable style={ss.sheetBackdrop} onPress={() => setShowSettings(false)} />
          <View style={ss.sheet}>
            <View style={ss.sheetHandle} />
            <View style={ss.sheetHeader}>
              <Text style={ss.sheetTitle}>Training Settings</Text>
              <Pressable onPress={() => setShowSettings(false)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name="close" size={s(22)} color="#fff" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: s(500) }}>
              <View style={{ gap: s(18), paddingBottom: s(20) }}>
                <View style={ss.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={ss.settingLabel}>Sets</Text>
                    <Text style={ss.settingSubLabel}>Total sets per exercise (1–12)</Text>
                  </View>
                  <Stepper value={totalSets} onDec={() => setTotalSets((v) => clampInt(v - 1, 1, 12))} onInc={() => setTotalSets((v) => clampInt(v + 1, 1, 12))} unit="sets" />
                </View>
                <View style={ss.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={ss.settingLabel}>Rest Duration</Text>
                    <Text style={ss.settingSubLabel}>Time between sets</Text>
                  </View>
                  <Stepper value={restSeconds} onDec={() => setRestSeconds((v) => clampInt(v - 15, 15, 600))} onInc={() => setRestSeconds((v) => clampInt(v + 15, 15, 600))} formatVal={fmtRestSetting} />
                </View>
                <View>
                  <Text style={ss.sectionLabel}>Rest Presets</Text>
                  <View style={ss.presetRow}>
                    {([
                      { label: "Endurance",   secs: 30,  sub: "30s" },
                      { label: "Hypertrophy", secs: 75,  sub: "75s" },
                      { label: "Strength",    secs: 180, sub: "3m"  },
                      { label: "Power",       secs: 240, sub: "4m"  },
                    ] as const).map(({ label, secs, sub }) => {
                      const active = restSeconds === secs;
                      return (
                        <Pressable
                          key={label}
                          onPress={() => setRestSeconds(secs)}
                          style={({ pressed }) => [ss.presetChip, {
                            backgroundColor: active ? BLUE_DIM : "rgba(255,255,255,0.06)",
                            borderColor:     active ? BLUE_BORDER : "rgba(255,255,255,0.12)",
                            opacity: pressed ? 0.85 : 1,
                          }]}
                        >
                          <Text style={[ss.presetChipLabel, { color: active ? BLUE : "rgba(255,255,255,0.7)" }]}>{label}</Text>
                          <Text style={[ss.presetChipSub,   { color: active ? "rgba(74,157,255,0.7)" : "rgba(255,255,255,0.35)" }]}>{sub}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={{ gap: s(8) }}>
                  <View>
                    <Text style={ss.settingLabel}>Exercise Label</Text>
                    <Text style={ss.settingSubLabel}>Fallback label shown when no exercise list is set</Text>
                  </View>
                  <TextInput
                    value={exerciseLabel}
                    onChangeText={setExerciseLabel}
                    placeholder="e.g. Bench Press, Squats…"
                    placeholderTextColor="rgba(255,255,255,0.22)"
                    style={ss.textInput}
                    maxLength={40}
                    returnKeyType="done"
                  />
                </View>
                <View style={{ gap: s(10) }}>
                  <View>
                    <Text style={ss.settingLabel}>Exercises</Text>
                    <Text style={ss.settingSubLabel}>Workout order · auto-filled from your training plan</Text>
                  </View>
                  {exercises.map((ex, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
                      <Text style={{ color: "rgba(255,255,255,0.35)", fontWeight: "700", fontSize: s(12), width: s(22), textAlign: "right" }}>{i + 1}.</Text>
                      <TextInput
                        value={ex}
                        onChangeText={(v) => setExercises((prev) => prev.map((e, j) => (j === i ? v : e)))}
                        style={[ss.textInput, { flex: 1 }]}
                        placeholder={`Exercise ${i + 1}`}
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        returnKeyType="done"
                      />
                      <Pressable onPress={() => setExercises((prev) => prev.filter((_, j) => j !== i))} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, padding: s(4) }]}>
                        <Ionicons name="close-circle-outline" size={s(20)} color="rgba(255,87,87,0.8)" />
                      </Pressable>
                    </View>
                  ))}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
                    <TextInput
                      value={pickExerciseInput}
                      onChangeText={setPickExerciseInput}
                      placeholder="Add exercise…"
                      placeholderTextColor="rgba(255,255,255,0.22)"
                      style={[ss.textInput, { flex: 1 }]}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (pickExerciseInput.trim()) {
                          setExercises((prev) => [...prev, pickExerciseInput.trim()]);
                          setPickExerciseInput("");
                        }
                      }}
                    />
                    <Pressable
                      onPress={() => {
                        if (pickExerciseInput.trim()) {
                          setExercises((prev) => [...prev, pickExerciseInput.trim()]);
                          setPickExerciseInput("");
                        }
                      }}
                      style={({ pressed }) => [ss.stepBtn, { opacity: pressed ? 0.8 : 1, backgroundColor: BLUE_DIM, borderColor: BLUE_BORDER }]}
                    >
                      <Ionicons name="add" size={s(17)} color={BLUE} />
                    </Pressable>
                  </View>
                </View>
                <ToggleRow label="Auto-start Rest" sub="Rest timer begins immediately after completing a set" value={autoStartRest} onChange={() => setAutoStartRest((v) => !v)} />
                <ToggleRow label="Sound Cues" sub="Play a sound when rest period ends" value={soundEnabled} onChange={() => setSoundEnabled((v) => !v)} />
              </View>
            </ScrollView>
          </View>
        </Modal>

      </SafeAreaView>

      <TrainingRoomTutorial
        visible={showTutorial}
        onDone={() => {
          setShowTutorial(false);
          saveTrainingRoomTutorialSeen().catch(() => {});
        }}
      />
    </LinearGradient>
  );
}

// ─── Colours ──────────────────────────────────────────────────────────────────
const BLUE        = "#4A9DFF";
const BLUE_DIM    = "rgba(74,157,255,0.16)";
const BLUE_BORDER = "rgba(74,157,255,0.42)";

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: s(16), marginTop: s(6), gap: s(8) },
  pill: { flexDirection: "row", alignItems: "center", gap: s(5), paddingVertical: s(8), paddingHorizontal: s(11), borderRadius: s(999), backgroundColor: "rgba(255,255,255,0.10)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.14)" },
  pillText: { color: "#fff", fontWeight: "700", fontSize: s(12) },
  selectContent: { paddingHorizontal: s(20), paddingTop: s(24), paddingBottom: s(60), gap: s(20) },
  selectHeader: { alignItems: "center", gap: s(10) },
  iconBadge: { width: s(72), height: s(72), borderRadius: s(22), backgroundColor: BLUE_DIM, borderWidth: s(1), borderColor: BLUE_BORDER, alignItems: "center", justifyContent: "center", marginBottom: s(4) },
  pageTitle: { color: "#fff", fontSize: s(24), fontWeight: "900" },
  pageSubtitle: { color: "rgba(255,255,255,0.42)", fontSize: s(13), fontWeight: "600", textAlign: "center" },
  sectionLabelPicker: { color: "rgba(255,255,255,0.32)", fontWeight: "800", fontSize: s(10), textTransform: "uppercase", letterSpacing: s(1.2), marginBottom: s(2) },
  exerciseChipRow: { flexDirection: "row", flexWrap: "wrap", gap: s(8) },
  exerciseChip: { flexDirection: "row", alignItems: "center", gap: s(7), paddingVertical: s(10), paddingHorizontal: s(14), borderRadius: s(14), backgroundColor: BLUE_DIM, borderWidth: s(1), borderColor: BLUE_BORDER },
  exerciseChipText: { color: BLUE, fontWeight: "800", fontSize: s(13) },
  emptyBox: { alignItems: "center", gap: s(10), paddingVertical: s(44), paddingHorizontal: s(20), borderRadius: s(20), backgroundColor: "rgba(255,255,255,0.04)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.08)" },
  emptyTitle: { color: "rgba(255,255,255,0.5)", fontWeight: "800", fontSize: s(14) },
  emptySubText: { color: "rgba(255,255,255,0.28)", fontWeight: "600", fontSize: s(12), textAlign: "center", lineHeight: s(18) },
  planGroup: { gap: s(8) },
  planGroupHeader: { flexDirection: "row", alignItems: "center", gap: s(7), paddingLeft: s(2) },
  planGroupLabel: { color: "rgba(255,255,255,0.5)", fontWeight: "800", fontSize: s(11), textTransform: "uppercase", letterSpacing: s(0.9) },
  taskCard: { flexDirection: "row", alignItems: "center", paddingVertical: s(14), paddingHorizontal: s(16), borderRadius: s(16), backgroundColor: "rgba(255,255,255,0.05)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.10)", gap: s(12) },
  taskCardTitle: { color: "#fff", fontWeight: "800", fontSize: s(14) },
  taskCardSub: { color: "rgba(255,255,255,0.35)", fontWeight: "600", fontSize: s(11), marginTop: s(2) },
  taskCardStartBadge: { flexDirection: "row", alignItems: "center", gap: s(5), paddingVertical: s(7), paddingHorizontal: s(12), borderRadius: s(999), backgroundColor: BLUE_DIM, borderWidth: s(1), borderColor: BLUE_BORDER },
  taskCardStartText: { color: BLUE, fontWeight: "800", fontSize: s(12) },
  settingsStrip: { flexDirection: "row", alignItems: "center", gap: s(10), paddingVertical: s(12), paddingHorizontal: s(14), borderRadius: s(14), backgroundColor: "rgba(255,255,255,0.04)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.08)" },
  settingsStripText: { flex: 1, color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: s(12) },
  planTag: { color: "rgba(255,255,255,0.3)", fontSize: s(10), fontWeight: "900", letterSpacing: s(2), textAlign: "center", marginTop: s(8), marginBottom: s(4), textTransform: "uppercase" },
  centerContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: s(6) },
  exerciseLabel: { color: "rgba(74,157,255,0.85)", fontWeight: "800", fontSize: s(14), textAlign: "center", letterSpacing: s(0.5), marginBottom: s(4) },
  setCounter: { color: "#fff", fontSize: s(90), fontWeight: "200", letterSpacing: s(-4), lineHeight: s(98) },
  setTotal: { color: "rgba(255,255,255,0.32)", fontSize: s(20), fontWeight: "700", letterSpacing: s(-0.5), marginTop: s(-6) },
  phaseSub: { color: "rgba(255,255,255,0.42)", fontWeight: "700", fontSize: s(14), marginTop: s(14) },
  completedLabel: { color: "rgba(255,255,255,0.55)", fontWeight: "800", fontSize: s(15), letterSpacing: s(0.4), marginBottom: s(4) },
  restTimer: { color: "#fff", fontSize: s(84), fontWeight: "200", letterSpacing: s(6) },
  restBarTrack: { width: "75%", height: s(4), borderRadius: s(999), backgroundColor: "rgba(255,255,255,0.10)", marginTop: s(22), overflow: "hidden" },
  restBarFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: BLUE, borderRadius: s(999) },
  trophyBadge: { width: s(84), height: s(84), borderRadius: s(26), backgroundColor: "rgba(255,215,0,0.10)", borderWidth: s(1), borderColor: "rgba(255,215,0,0.28)", alignItems: "center", justifyContent: "center", marginBottom: s(8) },
  completeTitle: { color: "#fff", fontSize: s(26), fontWeight: "900", letterSpacing: s(-0.5) },
  completeSets: { color: "rgba(255,255,255,0.5)", fontWeight: "700", fontSize: s(16), marginTop: s(6) },
  completeDuration: { color: "rgba(255,255,255,0.32)", fontWeight: "700", fontSize: s(13), marginTop: s(4) },
  bottomActions: { paddingBottom: Platform.OS === "ios" ? s(32) : s(20), paddingTop: s(10), gap: s(10) },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: s(10), paddingVertical: s(18), borderRadius: s(20), backgroundColor: "rgba(255,255,255,0.13)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.22)" },
  primaryBtnBlue: { backgroundColor: BLUE_DIM, borderColor: BLUE_BORDER },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: s(16) },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: s(8), paddingVertical: s(16), borderRadius: s(16), backgroundColor: "rgba(255,255,255,0.06)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.13)" },
  outlineBtnText: { color: "rgba(255,255,255,0.72)", fontWeight: "800", fontSize: s(14) },
  restActions: { flexDirection: "row", gap: s(10) },
  dialogBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: s(20) },
  dialogBox: { backgroundColor: "rgba(10,14,26,0.99)", borderRadius: s(22), padding: s(24), width: "100%", maxWidth: s(340), alignItems: "center", borderWidth: s(1), borderColor: "rgba(255,255,255,0.12)" },
  dialogTitle: { color: "#fff", fontSize: s(18), fontWeight: "900", marginTop: s(12), marginBottom: s(6) },
  dialogMsg: { color: "rgba(255,255,255,0.52)", fontSize: s(13), fontWeight: "600", textAlign: "center", marginBottom: s(22), lineHeight: s(19) },
  dialogBtns: { flexDirection: "row", gap: s(12), width: "100%" },
  dialogBtn: { flex: 1, paddingVertical: s(13), borderRadius: s(14), alignItems: "center", borderWidth: s(1) },
  dialogBtnCancel: { backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.14)" },
  dialogBtnConfirm: { backgroundColor: "rgba(255,107,107,0.10)", borderColor: "rgba(255,107,107,0.2)" },
  dialogBtnText: { color: "#fff", fontSize: s(13), fontWeight: "900" },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { paddingHorizontal: s(16), paddingTop: s(10), paddingBottom: Platform.OS === "ios" ? s(34) : s(20), backgroundColor: "rgba(6,10,20,0.99)", borderTopLeftRadius: s(24), borderTopRightRadius: s(24), borderWidth: s(1), borderColor: "rgba(255,255,255,0.10)" },
  sheetHandle: { width: s(40), height: s(4), borderRadius: s(999), backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: s(10) },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: s(16) },
  sheetTitle: { color: "#fff", fontWeight: "900", fontSize: s(16) },
  sectionLabel: { color: "rgba(255,255,255,0.38)", fontWeight: "800", fontSize: s(11), textTransform: "uppercase", letterSpacing: s(0.8), marginBottom: s(8) },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s(12) },
  settingLabel: { color: "#fff", fontWeight: "800", fontSize: s(14) },
  settingSubLabel: { color: "rgba(255,255,255,0.38)", fontWeight: "600", fontSize: s(11), marginTop: s(2) },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: s(8) },
  presetChip: { paddingVertical: s(9), paddingHorizontal: s(13), borderRadius: s(12), borderWidth: s(1), alignItems: "center", gap: s(2) },
  presetChipLabel: { fontWeight: "800", fontSize: s(12) },
  presetChipSub: { fontWeight: "600", fontSize: s(10) },
  textInput: { paddingVertical: s(12), paddingHorizontal: s(14), borderRadius: s(12), backgroundColor: "rgba(255,255,255,0.07)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.14)", color: "#fff", fontWeight: "700", fontSize: s(14) },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: s(12), paddingVertical: s(14), paddingHorizontal: s(14), borderRadius: s(14), backgroundColor: "rgba(255,255,255,0.04)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.09)" },
  toggleTrack: { width: s(42), height: s(24), borderRadius: s(12), backgroundColor: "rgba(255,255,255,0.12)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.15)", justifyContent: "center", paddingHorizontal: s(3) },
  toggleTrackOn: { backgroundColor: BLUE_DIM, borderColor: BLUE_BORDER },
  toggleThumb: { width: s(16), height: s(16), borderRadius: s(8), backgroundColor: "rgba(255,255,255,0.4)", alignSelf: "flex-start" },
  toggleThumbOn: { backgroundColor: BLUE, alignSelf: "flex-end" },
  stepper: { flexDirection: "row", alignItems: "center", gap: s(8), paddingVertical: s(6), paddingHorizontal: s(8), borderRadius: s(12), backgroundColor: "rgba(255,255,255,0.07)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.12)" },
  stepBtn: { width: s(30), height: s(30), borderRadius: s(15), alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)", borderWidth: s(1), borderColor: "rgba(255,255,255,0.12)" },
  stepValue: { color: "#fff", fontWeight: "900", fontSize: s(12), minWidth: s(58), textAlign: "center" },
});

const unitSS = StyleSheet.create({
  toggle: { flexDirection: "row" as const, borderRadius: s(8), overflow: "hidden" as const, borderWidth: s(1), borderColor: "rgba(255,255,255,0.14)" },
  chip: { paddingVertical: s(4), paddingHorizontal: s(11), backgroundColor: "transparent" as const },
  chipActive: { backgroundColor: "rgba(74,157,255,0.16)" },
  text: { color: "rgba(255,255,255,0.4)", fontWeight: "800" as const, fontSize: s(12) },
  textActive: { color: "#4A9DFF" },
});