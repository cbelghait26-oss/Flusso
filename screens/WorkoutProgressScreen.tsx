// screens/WorkoutProgressScreen.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { s } from "../src/ui/ts";
import { useTheme } from "../src/components/theme/theme";
import {
  loadWorkoutSessions,
  type WorkoutSession,
} from "../src/data/storage";

// ─── Muscle group config ──────────────────────────────────────────────────────

type MuscleGroup =
  | "Chest"
  | "Back"
  | "Legs"
  | "Shoulders"
  | "Arms"
  | "Core"
  | "Cardio"
  | "Full Body"
  | "Other";

const MUSCLE_COLORS: Record<MuscleGroup, string> = {
  Chest:     "#007AFF",
  Back:      "#AF52DE",
  Legs:      "#34C759",
  Shoulders: "#FF9500",
  Arms:      "#5AC8FA",
  Core:      "#FFCC00",
  Cardio:    "#FF2D55",
  "Full Body": "#FF6B35",
  Other:     "#8E8E93",
};

const MUSCLE_ICONS: Record<MuscleGroup, keyof typeof Ionicons.glyphMap> = {
  Chest:     "body-outline",
  Back:      "barbell-outline",
  Legs:      "walk-outline",
  Shoulders: "body-outline",
  Arms:      "fitness-outline",
  Core:      "ellipse-outline",
  Cardio:    "heart-outline",
  "Full Body": "person-outline",
  Other:     "help-circle-outline",
};

/** Map exercise keywords → muscle group */
const EXERCISE_TO_MUSCLE: [RegExp, MuscleGroup][] = [
  // Chest
  [/bench\s*press|chest\s*press|pec\s*(deck|fly)|dumbbell\s*fly|push.?up|dip|cable\s*cross|incline|decline/i, "Chest"],
  // Back
  [/pull.?up|chin.?up|lat\s*pull|row|deadlift|t.?bar|cable\s*row|seated\s*row|bent.?over|back\s*ext|hyper/i, "Back"],
  // Legs
  [/squat|leg\s*(press|curl|ext|raise)|lunge|calf|rdl|glute|hip\s*(thrust|hinge)|step.?up|hack\s*squat|bulgarian/i, "Legs"],
  // Shoulders
  [/overhead\s*press|shoulder\s*press|ohp|lateral\s*raise|front\s*raise|face\s*pull|upright\s*row|arnold|military/i, "Shoulders"],
  // Arms
  [/curl|tricep|preacher|hammer|skullcrusher|close.?grip|pushdown|dip|kickback/i, "Arms"],
  // Core
  [/plank|crunch|sit.?up|ab\s*(wheel|rollout)|russian\s*twist|leg\s*raise|hollow|cable\s*crunch|woodchop/i, "Core"],
  // Cardio
  [/run|jog|treadmill|bike|cycling|elliptic|row(?!ing\s*back)|swim|jump\s*rope|hiit|cardio/i, "Cardio"],
  // Full Body
  [/clean|snatch|thruster|burpee|turkish\s*get|kettlebell\s*swing|complex/i, "Full Body"],
];

function muscleGroupForExercise(name: string): MuscleGroup {
  for (const [re, group] of EXERCISE_TO_MUSCLE) {
    if (re.test(name)) return group;
  }
  return "Other";
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

type ExerciseStat = {
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sessions: {
    date: string; // YYYY-MM-DD
    bestWeightKg: number; // best numeric weight in session (0 = bodyweight)
    totalSets: number;
    totalReps: number;
  }[];
};

function parseWeight(raw: string): number {
  if (!raw) return 0;
  const lower = raw.toLowerCase();
  if (/bodyweight|bw/.test(lower)) return 0;
  const match = raw.match(/[\d.]+/);
  if (!match) return 0;
  const val = parseFloat(match[0]);
  if (/\blb|lbs\b/.test(lower)) return val * 0.453592;
  return val; // assume kg
}

function parseReps(raw: string): number {
  const m = raw.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function buildExerciseStats(sessions: WorkoutSession[]): ExerciseStat[] {
  const map = new Map<string, ExerciseStat>();

  for (const session of sessions) {
    for (const exLog of session.exercises) {
      const name = exLog.exerciseName;
      const muscle = (exLog.muscleGroup as MuscleGroup) || muscleGroupForExercise(name);

      if (!map.has(name)) {
        map.set(name, { exerciseName: name, muscleGroup: muscle, sessions: [] });
      }
      const stat = map.get(name)!;

      let bestWeight = 0;
      let totalSets = 0;
      let totalReps = 0;
      for (const set of exLog.sets) {
        const w = parseWeight(set.weight);
        if (w > bestWeight) bestWeight = w;
        totalSets++;
        totalReps += parseReps(set.reps);
      }

      stat.sessions.push({
        date: session.date,
        bestWeightKg: bestWeight,
        totalSets,
        totalReps,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.exerciseName.localeCompare(b.exerciseName)
  );
}

type MuscleGroupData = {
  group: MuscleGroup;
  exercises: ExerciseStat[];
  totalSessions: number;
};

function buildMuscleGroups(stats: ExerciseStat[]): MuscleGroupData[] {
  const map = new Map<MuscleGroup, ExerciseStat[]>();
  for (const stat of stats) {
    const arr = map.get(stat.muscleGroup) ?? [];
    arr.push(stat);
    map.set(stat.muscleGroup, arr);
  }
  return Array.from(map.entries())
    .map(([group, exercises]) => ({
      group,
      exercises,
      totalSessions: exercises.reduce((acc, e) => acc + e.sessions.length, 0),
    }))
    .sort((a, b) => b.totalSessions - a.totalSessions);
}

// ─── Tiny SVG line chart ──────────────────────────────────────────────────────

const CHART_W = 280;
const CHART_H = 100;
const CHART_PAD_L = 32;
const CHART_PAD_B = 20;
const CHART_PAD_R = 12;
const CHART_PAD_T = 10;
const CHART_IW = CHART_W - CHART_PAD_L - CHART_PAD_R;
const CHART_IH = CHART_H - CHART_PAD_T - CHART_PAD_B;

type ChartPoint = { x: number; y: number; label: string; valueLabel: string };

function buildChartPoints(
  dataSeries: { date: string; value: number }[],
): ChartPoint[] {
  if (dataSeries.length === 0) return [];

  const minVal = Math.min(...dataSeries.map((d) => d.value));
  const maxVal = Math.max(...dataSeries.map((d) => d.value));
  const range = maxVal - minVal || 1;

  return dataSeries.map((d, i) => {
    const xFrac = dataSeries.length === 1 ? 0.5 : i / (dataSeries.length - 1);
    const yFrac = (d.value - minVal) / range;
    return {
      x: CHART_PAD_L + xFrac * CHART_IW,
      y: CHART_PAD_T + (1 - yFrac) * CHART_IH,
      label: d.date.slice(5), // "MM-DD"
      valueLabel:
        d.value === 0
          ? "BW"
          : d.value < 100
          ? `${d.value.toFixed(1)}`
          : `${Math.round(d.value)}`,
    };
  });
}

function LineChart({
  sessions,
  color,
}: {
  sessions: ExerciseStat["sessions"];
  color: string;
}) {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  const hasWeights = sorted.some((s) => s.bestWeightKg > 0);
  const series = sorted.map((s) => ({
    date: s.date,
    value: hasWeights ? s.bestWeightKg : s.totalSets,
  }));

  const points = buildChartPoints(series);

  if (points.length === 0) return null;

  const polyline =
    points.length > 1
      ? points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
      : null;

  // Y-axis labels
  const allVals = series.map((s) => s.value);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);

  // Show subset of X labels so they don't overlap
  const labelStep = Math.max(1, Math.ceil(points.length / 4));
  const xLabels = points.filter((_, i) => i % labelStep === 0 || i === points.length - 1);

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {/* Grid lines */}
      {[0, 0.5, 1].map((frac) => {
        const y = CHART_PAD_T + frac * CHART_IH;
        return (
          <Line
            key={frac}
            x1={CHART_PAD_L}
            y1={y}
            x2={CHART_W - CHART_PAD_R}
            y2={y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        );
      })}

      {/* Y-axis labels */}
      <SvgText
        x={CHART_PAD_L - 4}
        y={CHART_PAD_T + 4}
        fontSize={s(8)}
        fill="rgba(255,255,255,0.3)"
        textAnchor="end"
      >
        {hasWeights
          ? maxV < 100
            ? `${maxV.toFixed(1)}`
            : `${Math.round(maxV)}`
          : `${Math.round(maxV)}`}
      </SvgText>
      <SvgText
        x={CHART_PAD_L - 4}
        y={CHART_PAD_T + CHART_IH + 4}
        fontSize={s(8)}
        fill="rgba(255,255,255,0.3)"
        textAnchor="end"
      >
        {hasWeights
          ? minV < 100
            ? `${minV.toFixed(1)}`
            : `${Math.round(minV)}`
          : `${Math.round(minV)}`}
      </SvgText>

      {/* Line */}
      {polyline && (
        <Path
          d={polyline}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Dots */}
      {points.map((p, i) => (
        <Circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill={color}
          opacity={0.9}
        />
      ))}

      {/* X labels */}
      {xLabels.map((p, i) => (
        <SvgText
          key={i}
          x={p.x}
          y={CHART_H - 4}
          fontSize={s(7)}
          fill="rgba(255,255,255,0.35)"
          textAnchor="middle"
        >
          {p.label}
        </SvgText>
      ))}
    </Svg>
  );
}

// ─── Exercise detail sheet ────────────────────────────────────────────────────

function ExerciseDetailSheet({
  stat,
  visible,
  onClose,
}: {
  stat: ExerciseStat | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!stat) return null;

  const color = MUSCLE_COLORS[stat.muscleGroup];
  const sorted = [...stat.sessions].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const hasWeights = sorted.some((s) => s.bestWeightKg > 0);

  const bestWeight = Math.max(...sorted.map((s) => s.bestWeightKg));
  const totalSets = sorted.reduce((acc, s) => acc + s.totalSets, 0);
  const totalReps = sorted.reduce((acc, s) => acc + s.totalReps, 0);

  const formatWeight = (kg: number) =>
    kg === 0 ? "Bodyweight" : kg >= 100 ? `${Math.round(kg)} kg` : `${kg.toFixed(1)} kg`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={ds.backdrop} onPress={onClose} />
      <View style={ds.sheet}>
        <View style={ds.handle} />

        {/* Header */}
        <View style={ds.header}>
          <View style={[ds.dot, { backgroundColor: color }]} />
          <View style={{ flex: 1 }}>
            <Text style={ds.exName} numberOfLines={2}>
              {stat.exerciseName}
            </Text>
            <Text style={[ds.muscleBadge, { color }]}>
              {stat.muscleGroup}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={s(20)} color="rgba(255,255,255,0.45)" />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: s(40) }}
        >
          {/* Chart */}
          {sorted.length >= 2 ? (
            <View style={ds.chartWrap}>
              <Text style={ds.chartLabel}>
                {hasWeights ? "Best Weight per Session (kg)" : "Sets per Session"}
              </Text>
              <LineChart sessions={sorted} color={color} />
            </View>
          ) : (
            <View style={ds.singleSessionNote}>
              <Ionicons name="information-circle-outline" size={s(15)} color="rgba(255,255,255,0.3)" />
              <Text style={ds.singleSessionText}>
                Train this exercise more to see your progress chart
              </Text>
            </View>
          )}

          {/* Stats row */}
          <View style={ds.statsRow}>
            <View style={ds.statBox}>
              <Text style={[ds.statVal, { color }]}>
                {hasWeights ? formatWeight(bestWeight) : "—"}
              </Text>
              <Text style={ds.statLbl}>Best Weight</Text>
            </View>
            <View style={[ds.statBox, ds.statBoxMid]}>
              <Text style={[ds.statVal, { color }]}>{sorted.length}</Text>
              <Text style={ds.statLbl}>Sessions</Text>
            </View>
            <View style={ds.statBox}>
              <Text style={[ds.statVal, { color }]}>{totalSets}</Text>
              <Text style={ds.statLbl}>Total Sets</Text>
            </View>
          </View>

          {/* Session history */}
          <Text style={ds.sectionTitle}>Session History</Text>
          {[...sorted].reverse().map((sess, i) => (
            <View key={i} style={ds.historyRow}>
              <View style={[ds.historyDot, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <Text style={ds.historyDate}>{formatDate(sess.date)}</Text>
                <Text style={ds.historySub}>
                  {sess.totalSets} sets · {sess.totalReps} reps
                  {sess.bestWeightKg > 0 ? ` · ${formatWeight(sess.bestWeightKg)}` : ""}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// ─── Muscle group row (collapsible) ──────────────────────────────────────────

function MuscleGroupRow({
  data,
  onSelectExercise,
}: {
  data: MuscleGroupData;
  onSelectExercise: (stat: ExerciseStat) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const animRef = useRef(new Animated.Value(0)).current;
  const color = MUSCLE_COLORS[data.group];

  const toggle = () => {
    const toVal = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.spring(animRef, {
      toValue: toVal,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const rotate = animRef.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "90deg"],
  });

  return (
    <View style={mg.container}>
      {/* Header row */}
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [mg.header, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={[mg.iconBadge, { backgroundColor: color + "22" }]}>
          <Ionicons name={MUSCLE_ICONS[data.group]} size={s(16)} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={mg.groupName}>{data.group}</Text>
          <Text style={mg.groupSub}>
            {data.exercises.length} exercise{data.exercises.length !== 1 ? "s" : ""}
            {" · "}
            {data.totalSessions} session{data.totalSessions !== 1 ? "s" : ""}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="chevron-forward" size={s(16)} color="rgba(255,255,255,0.35)" />
        </Animated.View>
      </Pressable>

      {/* Exercise chips */}
      {expanded && (
        <View style={mg.exerciseList}>
          {data.exercises.map((stat) => {
            const sorted = [...stat.sessions].sort((a, b) =>
              a.date.localeCompare(b.date)
            );
            const hasWeights = sorted.some((s) => s.bestWeightKg > 0);
            const latest = sorted[sorted.length - 1];
            const trend = sorted.length >= 2
              ? sorted[sorted.length - 1].bestWeightKg - sorted[sorted.length - 2].bestWeightKg
              : 0;

            return (
              <Pressable
                key={stat.exerciseName}
                onPress={() => onSelectExercise(stat)}
                style={({ pressed }) => [mg.exRow, { opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={mg.exName} numberOfLines={1}>
                    {stat.exerciseName}
                  </Text>
                  <Text style={mg.exSub}>
                    {stat.sessions.length} session{stat.sessions.length !== 1 ? "s" : ""}
                    {latest && hasWeights && latest.bestWeightKg > 0
                      ? ` · ${latest.bestWeightKg < 100
                          ? `${latest.bestWeightKg.toFixed(1)}`
                          : `${Math.round(latest.bestWeightKg)}`} kg last`
                      : ""}
                  </Text>
                </View>
                {/* Mini trend */}
                <View style={mg.trendWrap}>
                  {hasWeights && sorted.length >= 2 && (
                    <Ionicons
                      name={
                        trend > 0
                          ? "trending-up"
                          : trend < 0
                          ? "trending-down"
                          : "remove"
                      }
                      size={s(14)}
                      color={
                        trend > 0 ? "#34C759" : trend < 0 ? "#FF3B30" : "rgba(255,255,255,0.25)"
                      }
                    />
                  )}
                  {/* Tiny inline sparkline */}
                  {sorted.length >= 2 && (
                    <MiniSparkline
                      values={sorted.map((s) =>
                        hasWeights ? s.bestWeightKg : s.totalSets
                      )}
                      color={color}
                    />
                  )}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={s(13)}
                  color="rgba(255,255,255,0.2)"
                  style={{ marginLeft: s(4) }}
                />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Mini sparkline ───────────────────────────────────────────────────────────

const SPARK_W = 44;
const SPARK_H = 20;

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const xFrac = i / (values.length - 1);
    const yFrac = (v - min) / range;
    return {
      x: xFrac * SPARK_W,
      y: SPARK_H - 2 - yFrac * (SPARK_H - 4),
    };
  });

  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  return (
    <Svg width={SPARK_W} height={SPARK_H} style={{ marginHorizontal: s(4) }}>
      <Path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name="barbell-outline" size={s(44)} color="rgba(255,255,255,0.12)" />
      <Text style={styles.emptyTitle}>No workout data yet</Text>
      <Text style={styles.emptySub}>
        Complete a session in the Training Room to start tracking your progress.
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function WorkoutProgressScreen({ navigation }: any) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStat, setSelectedStat] = useState<ExerciseStat | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);
      loadWorkoutSessions()
        .then((data) => {
          if (mounted) { setSessions(data); setLoading(false); }
        })
        .catch(() => { if (mounted) setLoading(false); });
      return () => { mounted = false; };
    }, [])
  );

  const exerciseStats = useMemo(() => buildExerciseStats(sessions), [sessions]);
  const muscleGroups = useMemo(() => buildMuscleGroups(exerciseStats), [exerciseStats]);

  const handleSelectExercise = (stat: ExerciseStat) => {
    setSelectedStat(stat);
    setDetailVisible(true);
  };

  const totalSessions = sessions.length;
  const totalExercises = exerciseStats.length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={s(22)} color="rgba(255,255,255,0.75)" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Progress</Text>
          {!loading && totalSessions > 0 && (
            <Text style={styles.subtitle}>
              {totalSessions} workout{totalSessions !== 1 ? "s" : ""}
              {" · "}
              {totalExercises} exercise{totalExercises !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptySub}>Loading…</Text>
        </View>
      ) : muscleGroups.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionHeader}>BY MUSCLE GROUP</Text>
          {muscleGroups.map((data) => (
            <MuscleGroupRow
              key={data.group}
              data={data}
              onSelectExercise={handleSelectExercise}
            />
          ))}
          <View style={{ height: s(32) }} />
        </ScrollView>
      )}

      <ExerciseDetailSheet
        stat={selectedStat}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BG = "#000612";
const SURFACE = "rgba(255,255,255,0.05)";
const BORDER = "rgba(255,255,255,0.09)";

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(16),
    paddingVertical: s(12),
    gap: s(10),
  },
  backBtn: {
    width: s(36),
    height: s(36),
    borderRadius: s(10),
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: s(22),
    fontWeight: "800",
    letterSpacing: s(-0.5),
  },
  subtitle: {
    color: "rgba(255,255,255,0.38)",
    fontSize: s(12),
    fontWeight: "500",
    marginTop: s(1),
  },
  listContent: {
    paddingHorizontal: s(16),
    paddingTop: s(4),
  },
  sectionHeader: {
    color: "rgba(255,255,255,0.3)",
    fontSize: s(10),
    fontWeight: "900",
    letterSpacing: s(1.5),
    marginBottom: s(10),
    textTransform: "uppercase",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: s(12),
    paddingHorizontal: s(40),
  },
  emptyTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: s(17),
    fontWeight: "700",
    textAlign: "center",
  },
  emptySub: {
    color: "rgba(255,255,255,0.28)",
    fontSize: s(13),
    fontWeight: "500",
    textAlign: "center",
    lineHeight: s(19),
  },
});

// Muscle group row styles
const mg = StyleSheet.create({
  container: {
    backgroundColor: SURFACE,
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: s(10),
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(12),
    paddingHorizontal: s(14),
    paddingVertical: s(14),
  },
  iconBadge: {
    width: s(36),
    height: s(36),
    borderRadius: s(10),
    alignItems: "center",
    justifyContent: "center",
  },
  groupName: {
    color: "#fff",
    fontSize: s(15),
    fontWeight: "700",
    letterSpacing: s(-0.2),
  },
  groupSub: {
    color: "rgba(255,255,255,0.35)",
    fontSize: s(11),
    fontWeight: "500",
    marginTop: s(1),
  },
  exerciseList: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  exRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(14),
    paddingVertical: s(11),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    gap: s(8),
  },
  exName: {
    color: "rgba(255,255,255,0.85)",
    fontSize: s(13),
    fontWeight: "600",
  },
  exSub: {
    color: "rgba(255,255,255,0.32)",
    fontSize: s(11),
    fontWeight: "500",
    marginTop: s(1),
  },
  trendWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(2),
  },
});

// Detail sheet styles
const ds = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#0B0F1A",
    borderTopLeftRadius: s(22),
    borderTopRightRadius: s(22),
    paddingHorizontal: s(18),
    paddingTop: s(10),
    maxHeight: "85%",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  handle: {
    width: s(36),
    height: s(4),
    borderRadius: s(2),
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginBottom: s(16),
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: s(12),
    marginBottom: s(20),
  },
  dot: {
    width: s(10),
    height: s(10),
    borderRadius: s(5),
    marginTop: s(4),
  },
  exName: {
    color: "#fff",
    fontSize: s(18),
    fontWeight: "800",
    letterSpacing: s(-0.3),
    lineHeight: s(24),
  },
  muscleBadge: {
    fontSize: s(12),
    fontWeight: "700",
    marginTop: s(2),
    textTransform: "uppercase",
    letterSpacing: s(0.5),
  },
  chartWrap: {
    marginBottom: s(20),
  },
  chartLabel: {
    color: "rgba(255,255,255,0.3)",
    fontSize: s(10),
    fontWeight: "700",
    letterSpacing: s(0.5),
    marginBottom: s(8),
    textTransform: "uppercase",
  },
  singleSessionNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
    paddingVertical: s(12),
    marginBottom: s(10),
  },
  singleSessionText: {
    color: "rgba(255,255,255,0.28)",
    fontSize: s(12),
    fontWeight: "500",
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: s(1),
    marginBottom: s(24),
    backgroundColor: SURFACE,
    borderRadius: s(14),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: s(14),
    gap: s(3),
  },
  statBoxMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: BORDER,
  },
  statVal: {
    fontSize: s(18),
    fontWeight: "800",
    letterSpacing: s(-0.3),
  },
  statLbl: {
    color: "rgba(255,255,255,0.35)",
    fontSize: s(10),
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: s(0.3),
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.3)",
    fontSize: s(10),
    fontWeight: "900",
    letterSpacing: s(1.5),
    marginBottom: s(10),
    textTransform: "uppercase",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(12),
    paddingVertical: s(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  historyDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
  },
  historyDate: {
    color: "rgba(255,255,255,0.75)",
    fontSize: s(13),
    fontWeight: "600",
  },
  historySub: {
    color: "rgba(255,255,255,0.32)",
    fontSize: s(11),
    fontWeight: "500",
    marginTop: s(1),
  },
});
