/**
 * TrainingPlanWizard
 * Full-screen step wizard for creating / editing a training plan.
 */
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { s } from "../../ui/ts";
import { useTheme } from "../theme/theme";
import type {
  CycleDay,
  MissedBehavior,
  TrainingPlan,
  TrainingSession,
  WeekDayAssignment,
} from "../../data/models";
import { uid } from "../../data/storage";
import { DatePickerSheet } from "./DatePickerSheet";

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(ymd: string): string {
  const [y, m, day] = ymd.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const WEEK_DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0] as const; // Mon first
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Draft types (internal wizard state) ──────────────────────────────────────

type CycleDayDraft = {
  id: string;
  label: string;
  isRest: boolean;
};

type WeekDayDraft = {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  label: string;
  isRest: boolean;
};

type SessionDetail = {
  description: string;
  exercises: string; // one exercise per line
  durationMinutes: string;
  timeOfDay: string;
};

type WizardStep = 0 | 1 | 2 | 3 | 4;

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  objectiveId: string;
  existingPlan?: TrainingPlan;
  onClose: () => void;
  onSave: (plan: TrainingPlan) => Promise<void>;
};

export function TrainingPlanWizard({
  visible,
  objectiveId,
  existingPlan,
  onClose,
  onSave,
}: Props) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<WizardStep>(0);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // ── Wizard state ─────────────────────────────────────────────────────────

  const [type, setType] = useState<"cycle" | "week" | null>(null);
  const [planName, setPlanName] = useState("");
  const [cycleDays, setCycleDays] = useState<CycleDayDraft[]>([]);
  const [weekDays, setWeekDays] = useState<WeekDayDraft[]>([]);
  const [sessionDetails, setSessionDetails] = useState<Record<string, SessionDetail>>({});
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayKey());
  const [startCycleDayIndex, setStartCycleDayIndex] = useState(0);
  const [missedBehavior, setMissedBehavior] = useState<MissedBehavior>("shift-forward");

  // Reset / pre-populate on open
  useEffect(() => {
    if (!visible) return;
    if (existingPlan) {
      setType(existingPlan.type);
      setPlanName(existingPlan.name);
      setStartDate(existingPlan.startDate ?? todayKey());
      setStartCycleDayIndex(existingPlan.startCycleDayIndex ?? 0);
      setMissedBehavior(existingPlan.missedBehavior ?? "shift-forward");

      if (existingPlan.type === "cycle") {
        setCycleDays(
          (existingPlan.cycleDays ?? []).map((cd) => ({
            id: cd.id,
            label: cd.isRest ? "" : cd.label,
            isRest: cd.isRest,
          }))
        );
      } else {
        setWeekDays(
          WEEK_DAYS_ORDER.map((dow) => {
            const a = (existingPlan.weekSchedule ?? []).find((x) => x.dayOfWeek === dow);
            const session = a ? existingPlan.sessions.find((s) => s.id === a.sessionId) : null;
            return {
              dayOfWeek: dow,
              label: session?.name ?? "",
              isRest: a?.isRest ?? true,
            };
          })
        );
      }

      // Populate session details from existing sessions
      const details: Record<string, SessionDetail> = {};
      for (const sess of existingPlan.sessions) {
        details[sess.name] = {
          description: sess.description ?? "",
          exercises: sess.exercises.join("\n"),
          durationMinutes: sess.durationMinutes ? String(sess.durationMinutes) : "",
          timeOfDay: sess.timeOfDay ?? "",
        };
      }
      setSessionDetails(details);
      setStep(1);
    } else {
      setStep(0);
      setType(null);
      setPlanName("");
      setCycleDays([
        { id: uid("cd"), label: "Push", isRest: false },
        { id: uid("cd"), label: "Pull", isRest: false },
        { id: uid("cd"), label: "Legs", isRest: false },
        { id: uid("cd"), label: "", isRest: true },
      ]);
      setWeekDays(
        WEEK_DAYS_ORDER.map((dow) => ({
          dayOfWeek: dow,
          label: "",
          isRest: dow === 0, // Sun = rest by default
        }))
      );
      setSessionDetails({});
      setStartDate(todayKey());
      setStartCycleDayIndex(0);
      setMissedBehavior("shift-forward");
      setExpandedSession(null);
    }
  }, [visible]);

  // Sync sessionDetails when moving to step 2
  const initSessionDetails = () => {
    const labels = getUniqueSessionLabels();
    const next: Record<string, SessionDetail> = {};
    for (const label of labels) {
      next[label] = sessionDetails[label] ?? {
        description: "",
        exercises: "",
        durationMinutes: "",
        timeOfDay: "",
      };
    }
    setSessionDetails(next);
  };

  // ── Derived helpers ───────────────────────────────────────────────────────

  const getUniqueSessionLabels = (): string[] => {
    const seen = new Set<string>();
    const labels: string[] = [];
    const days = type === "cycle" ? cycleDays : weekDays;
    for (const d of days) {
      if (d.isRest) continue;
      const label = d.label.trim() || "Workout";
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
    return labels;
  };

  const totalSteps = type === "cycle" ? 4 : 3;

  const canGoNext = (): boolean => {
    if (step === 0) return type !== null;
    if (step === 1) {
      if (!planName.trim()) return false;
      if (type === "cycle") return cycleDays.length > 0;
      if (type === "week") return weekDays.some((d) => !d.isRest && d.label.trim());
    }
    return true;
  };

  const isLastStep = () =>
    (type === "cycle" && step === 4) || (type === "week" && step === 3);

  // ── Build final plan ──────────────────────────────────────────────────────

  const buildPlan = (): TrainingPlan => {
    const id = existingPlan?.id ?? uid("plan");
    const sessions: TrainingSession[] = [];
    let cycleDaysData: CycleDay[] | undefined;
    let weekScheduleData: WeekDayAssignment[] | undefined;

    if (type === "cycle") {
      const labelToSessionId = new Map<string, string>();
      const seenLabels = new Set<string>();
      for (const day of cycleDays) {
        if (day.isRest) continue;
        const label = day.label.trim() || "Workout";
        if (!seenLabels.has(label)) {
          seenLabels.add(label);
          const detail = sessionDetails[label];
          const sessionId = uid("sess");
          labelToSessionId.set(label, sessionId);
          sessions.push({
            id: sessionId,
            name: label,
            description: detail?.description.trim() || undefined,
            durationMinutes: detail?.durationMinutes
              ? parseInt(detail.durationMinutes)
              : undefined,
            timeOfDay: detail?.timeOfDay.trim() || undefined,
            exercises: detail?.exercises
              ? detail.exercises
                  .split("\n")
                  .map((e) => e.trim())
                  .filter(Boolean)
              : [],
            isRest: false,
          });
        }
      }
      cycleDaysData = cycleDays.map((day) => ({
        id: day.id,
        label: day.isRest ? "Rest" : day.label.trim() || "Workout",
        sessionId: day.isRest
          ? ""
          : labelToSessionId.get(day.label.trim() || "Workout") ?? "",
        isRest: day.isRest,
      }));
    } else {
      const labelToSessionId = new Map<string, string>();
      const seenLabels = new Set<string>();
      for (const day of weekDays) {
        if (day.isRest) continue;
        const label = day.label.trim() || "Workout";
        if (!seenLabels.has(label)) {
          seenLabels.add(label);
          const detail = sessionDetails[label];
          const sessionId = uid("sess");
          labelToSessionId.set(label, sessionId);
          sessions.push({
            id: sessionId,
            name: label,
            description: detail?.description.trim() || undefined,
            durationMinutes: detail?.durationMinutes
              ? parseInt(detail.durationMinutes)
              : undefined,
            timeOfDay: detail?.timeOfDay.trim() || undefined,
            exercises: detail?.exercises
              ? detail.exercises
                  .split("\n")
                  .map((e) => e.trim())
                  .filter(Boolean)
              : [],
            isRest: false,
          });
        }
      }
      weekScheduleData = weekDays.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        sessionId: day.isRest
          ? null
          : labelToSessionId.get(day.label.trim() || "Workout") ?? null,
        isRest: day.isRest,
      }));
    }

    return {
      id,
      objectiveId,
      name: planName.trim(),
      type: type!,
      sessions,
      cycleDays: cycleDaysData,
      startDate,
      startCycleDayIndex: type === "cycle" ? startCycleDayIndex : undefined,
      missedBehavior: type === "cycle" ? missedBehavior : undefined,
      weekSchedule: weekScheduleData,
      createdAt: existingPlan?.createdAt ?? new Date().toISOString(),
      status: existingPlan?.status ?? "active",
    };
  };

  const handleCreate = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(buildPlan());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (step === 0) { setStep(1); return; }
    if (step === 1) { initSessionDetails(); setStep(2); return; }
    if (step === 2) { setStep(3); return; }
    if (step === 3 && type === "cycle") { setStep(4); return; }
    handleCreate();
  };

  const handleBack = () => {
    if (step === 0) { onClose(); return; }
    setStep((p) => (p - 1) as WizardStep);
  };

  const stepTitle = () => {
    if (step === 0) return "Add Training Plan";
    if (step === 1) return type === "cycle" ? "Build your cycle" : "Weekly schedule";
    if (step === 2) return "Session details";
    if (step === 3) return "Start configuration";
    return "Missed workout";
  };

  // ── Shared style helpers ──────────────────────────────────────────────────

  const inputContainer = {
    borderRadius: radius.xl,
    borderWidth: s(1),
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    paddingHorizontal: s(12),
    marginTop: s(6),
  };
  const inputStyle = {
    color: colors.text,
    fontWeight: "800" as const,
    fontSize: s(14),
    paddingVertical: s(10),
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleBack}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingTop: insets.top + s(12),
            paddingBottom: s(12),
            paddingHorizontal: s(16),
            borderBottomWidth: s(1),
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
            gap: s(8),
          }}
        >
          <TouchableOpacity onPress={handleBack} style={{ padding: s(4) }}>
            <Ionicons
              name={step === 0 ? "close" : "arrow-back"}
              size={s(22)}
              color={colors.text}
            />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: s(16) }}>
              {stepTitle()}
            </Text>
            {type !== null && (
              <Text style={{ color: colors.muted, fontSize: s(12), fontWeight: "700", marginTop: s(2) }}>
                Step {step} of {totalSteps}
              </Text>
            )}
          </View>
          <View style={{ width: s(30) }} />
        </View>

        {/* Progress bar */}
        {type !== null && (
          <View style={{ height: s(3), backgroundColor: colors.surface2 }}>
            <View
              style={{
                height: "100%",
                width: `${(step / totalSteps) * 100}%`,
                backgroundColor: colors.accent,
              }}
            />
          </View>
        )}

        <ScrollView
          contentContainerStyle={{ padding: s(16), paddingBottom: s(40) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Step 0: Type choice ── */}
          {step === 0 && (
            <View style={{ gap: s(16) }}>
              <Text style={{ color: colors.muted, fontWeight: "700", fontSize: s(14), lineHeight: s(22) }}>
                How does your training repeat?
              </Text>

              <TypeChoiceCard
                selected={type === "cycle"}
                onPress={() => setType("cycle")}
                title="Cycle-based"
                icon="refresh-circle-outline"
                subtitle="Workouts repeat in order — Day 1 → Day 2 → Day 3 → back to Day 1"
                examples={["Push / Pull / Legs", "Upper / Lower split", "4-day split + rest"]}
                colors={colors}
                radius={radius}
              />

              <TypeChoiceCard
                selected={type === "week"}
                onPress={() => setType("week")}
                title="Week-based"
                icon="calendar-outline"
                subtitle="Each weekday always has the same assigned workout"
                examples={["Mon = Chest, Tue = Back", "Every weekday = Swimming", "Fixed sports schedule"]}
                colors={colors}
                radius={radius}
              />
            </View>
          )}

          {/* ── Step 1: Structure ── */}
          {step === 1 && (
            <View style={{ gap: s(16) }}>
              {/* Plan name */}
              <View>
                <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12) }}>Plan name</Text>
                <View style={inputContainer}>
                  <TextInput
                    value={planName}
                    onChangeText={setPlanName}
                    placeholder={type === "cycle" ? "e.g. Push Pull Legs" : "e.g. Weekly Swim"}
                    placeholderTextColor={colors.muted}
                    style={inputStyle}
                    autoFocus
                  />
                </View>
              </View>

              {/* Cycle day builder */}
              {type === "cycle" && (
                <View>
                  <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12), marginBottom: s(8) }}>
                    Cycle days
                  </Text>
                  {cycleDays.map((day, i) => (
                    <CycleDayRow
                      key={day.id}
                      day={day}
                      index={i}
                      total={cycleDays.length}
                      onChangeLabel={(label) =>
                        setCycleDays((prev) =>
                          prev.map((d) => (d.id === day.id ? { ...d, label } : d))
                        )
                      }
                      onToggleRest={() =>
                        setCycleDays((prev) =>
                          prev.map((d) => (d.id === day.id ? { ...d, isRest: !d.isRest } : d))
                        )
                      }
                      onMoveUp={() => {
                        if (i === 0) return;
                        setCycleDays((prev) => {
                          const next = [...prev];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          return next;
                        });
                      }}
                      onMoveDown={() => {
                        if (i === cycleDays.length - 1) return;
                        setCycleDays((prev) => {
                          const next = [...prev];
                          [next[i], next[i + 1]] = [next[i + 1], next[i]];
                          return next;
                        });
                      }}
                      onDelete={() => {
                        if (cycleDays.length <= 1) return;
                        setCycleDays((prev) => prev.filter((d) => d.id !== day.id));
                      }}
                      colors={colors}
                      radius={radius}
                    />
                  ))}
                  <TouchableOpacity
                    onPress={() =>
                      setCycleDays((prev) => [
                        ...prev,
                        { id: uid("cd"), label: "", isRest: false },
                      ])
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: s(8),
                      padding: s(12),
                      borderRadius: radius.xl,
                      borderWidth: s(1),
                      borderColor: colors.accent,
                      borderStyle: "dashed",
                      marginTop: s(4),
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={s(18)} color={colors.accent} />
                    <Text style={{ color: colors.accent, fontWeight: "800", fontSize: s(14) }}>
                      Add day
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Week schedule builder */}
              {type === "week" && (
                <View>
                  <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12), marginBottom: s(8) }}>
                    Weekly schedule
                  </Text>
                  {weekDays.map((day) => (
                    <WeekDayRow
                      key={day.dayOfWeek}
                      day={day}
                      onChangeLabel={(label) =>
                        setWeekDays((prev) =>
                          prev.map((d) =>
                            d.dayOfWeek === day.dayOfWeek ? { ...d, label } : d
                          )
                        )
                      }
                      onToggleRest={() =>
                        setWeekDays((prev) =>
                          prev.map((d) =>
                            d.dayOfWeek === day.dayOfWeek
                              ? { ...d, isRest: !d.isRest, label: d.isRest ? d.label : "" }
                              : d
                          )
                        )
                      }
                      colors={colors}
                      radius={radius}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Step 2: Session details ── */}
          {step === 2 && (
            <View style={{ gap: s(14) }}>
              <Text style={{ color: colors.muted, fontWeight: "700", fontSize: s(14), lineHeight: s(22) }}>
                Add optional details to each workout session. You can skip this step.
              </Text>
              {getUniqueSessionLabels().map((label) => {
                const isOpen = expandedSession === label;
                const detail = sessionDetails[label] ?? {
                  description: "",
                  exercises: "",
                  durationMinutes: "",
                  timeOfDay: "",
                };
                return (
                  <View
                    key={label}
                    style={{
                      borderRadius: radius.xl,
                      borderWidth: s(1),
                      borderColor: isOpen ? colors.accent : colors.border,
                      backgroundColor: colors.surface,
                      overflow: "hidden",
                    }}
                  >
                    {/* Session header */}
                    <Pressable
                      onPress={() => setExpandedSession(isOpen ? null : label)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        padding: s(14),
                        gap: s(10),
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <View
                        style={{
                          width: s(32),
                          height: s(32),
                          borderRadius: s(16),
                          backgroundColor: colors.accent + "22",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name="barbell-outline"
                          size={s(16)}
                          color={colors.accent}
                        />
                      </View>
                      <Text style={{ flex: 1, color: colors.text, fontWeight: "800", fontSize: s(15) }}>
                        {label}
                      </Text>
                      <Ionicons
                        name={isOpen ? "chevron-up" : "chevron-down"}
                        size={s(18)}
                        color={colors.muted}
                      />
                    </Pressable>

                    {/* Session detail fields */}
                    {isOpen && (
                      <View
                        style={{
                          padding: s(14),
                          paddingTop: 0,
                          gap: s(12),
                          borderTopWidth: s(1),
                          borderTopColor: colors.border,
                        }}
                      >
                        <View style={{ gap: s(4) }}>
                          <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(11) }}>
                            EXERCISES (one per line)
                          </Text>
                          <View style={inputContainer}>
                            <TextInput
                              value={detail.exercises}
                              onChangeText={(v) =>
                                setSessionDetails((prev) => ({
                                  ...prev,
                                  [label]: { ...detail, exercises: v },
                                }))
                              }
                              placeholder={"Bench press\nIncline dumbbell press\nShoulder press"}
                              placeholderTextColor={colors.muted}
                              style={[inputStyle, { height: s(100), textAlignVertical: "top", paddingTop: s(10) }]}
                              multiline
                            />
                          </View>
                        </View>

                        <View style={{ gap: s(4) }}>
                          <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(11) }}>
                            NOTES (optional)
                          </Text>
                          <View style={inputContainer}>
                            <TextInput
                              value={detail.description}
                              onChangeText={(v) =>
                                setSessionDetails((prev) => ({
                                  ...prev,
                                  [label]: { ...detail, description: v },
                                }))
                              }
                              placeholder="e.g. Focus on form today"
                              placeholderTextColor={colors.muted}
                              style={inputStyle}
                            />
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", gap: s(10) }}>
                          <View style={{ flex: 1, gap: s(4) }}>
                            <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(11) }}>
                              DURATION (min)
                            </Text>
                            <View style={inputContainer}>
                              <TextInput
                                value={detail.durationMinutes}
                                onChangeText={(v) =>
                                  setSessionDetails((prev) => ({
                                    ...prev,
                                    [label]: { ...detail, durationMinutes: v },
                                  }))
                                }
                                placeholder="60"
                                placeholderTextColor={colors.muted}
                                style={inputStyle}
                                keyboardType="numeric"
                              />
                            </View>
                          </View>
                          <View style={{ flex: 1, gap: s(4) }}>
                            <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(11) }}>
                              TIME OF DAY
                            </Text>
                            <View style={inputContainer}>
                              <TextInput
                                value={detail.timeOfDay}
                                onChangeText={(v) =>
                                  setSessionDetails((prev) => ({
                                    ...prev,
                                    [label]: { ...detail, timeOfDay: v },
                                  }))
                                }
                                placeholder="07:00"
                                placeholderTextColor={colors.muted}
                                style={inputStyle}
                              />
                            </View>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Step 3: Start configuration ── */}
          {step === 3 && (
            <View style={{ gap: s(16) }}>
              {/* Start date */}
              <View>
                <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12) }}>
                  When does this plan start?
                </Text>
                <View style={{ flexDirection: "row", gap: s(10), marginTop: s(8) }}>
                  <Pressable
                    onPress={() => setStartDate(todayKey())}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: s(44),
                      borderRadius: radius.xl,
                      borderWidth: s(1),
                      borderColor:
                        startDate === todayKey() ? colors.accent : colors.border,
                      backgroundColor:
                        startDate === todayKey()
                          ? colors.accent + "1A"
                          : colors.surface2,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color:
                          startDate === todayKey() ? colors.accent : colors.text,
                        fontWeight: "800",
                      }}
                    >
                      Start today
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setDatePickerOpen(true)}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: s(44),
                      borderRadius: radius.xl,
                      borderWidth: s(1),
                      borderColor:
                        startDate !== todayKey() ? colors.accent : colors.border,
                      backgroundColor:
                        startDate !== todayKey()
                          ? colors.accent + "1A"
                          : colors.surface2,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: s(6),
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={s(16)}
                      color={startDate !== todayKey() ? colors.accent : colors.muted}
                    />
                    <Text
                      style={{
                        color:
                          startDate !== todayKey() ? colors.accent : colors.text,
                        fontWeight: "800",
                        fontSize: s(13),
                      }}
                    >
                      {startDate !== todayKey() ? fmtDate(startDate) : "Pick date"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Cycle day start index */}
              {type === "cycle" && cycleDays.length > 0 && (
                <View>
                  <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12), marginBottom: s(8) }}>
                    Which cycle day is{" "}
                    {startDate === todayKey() ? "today" : fmtDate(startDate)}?
                  </Text>
                  <Text style={{ color: colors.muted, fontWeight: "700", fontSize: s(12), marginBottom: s(10), lineHeight: s(18) }}>
                    If you already started your split, pick the day you're on now.
                  </Text>
                  {cycleDays.map((day, i) => (
                    <Pressable
                      key={day.id}
                      onPress={() => setStartCycleDayIndex(i)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        padding: s(12),
                        borderRadius: radius.xl,
                        borderWidth: s(1),
                        borderColor:
                          startCycleDayIndex === i ? colors.accent : colors.border,
                        backgroundColor:
                          startCycleDayIndex === i
                            ? colors.accent + "1A"
                            : colors.surface2,
                        marginBottom: s(8),
                        gap: s(12),
                        opacity: pressed ? 0.88 : 1,
                      })}
                    >
                      <Text style={{ color: colors.muted, fontWeight: "700", fontSize: s(12), width: s(44) }}>
                        Day {i + 1}
                      </Text>
                      <Text style={{ flex: 1, color: colors.text, fontWeight: "800" }}>
                        {day.isRest ? "Rest" : day.label || `Day ${i + 1}`}
                      </Text>
                      {startCycleDayIndex === i && (
                        <Ionicons name="checkmark-circle" size={s(20)} color={colors.accent} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Step 4 (cycle only): Missed workout behavior ── */}
          {step === 4 && (
            <View style={{ gap: s(16) }}>
              <Text style={{ color: colors.muted, fontWeight: "700", fontSize: s(14), lineHeight: s(22) }}>
                What should happen if you miss a workout day?
              </Text>

              <MissedBehaviorCard
                selected={missedBehavior === "shift-forward"}
                onPress={() => setMissedBehavior("shift-forward")}
                title="Shift the plan forward"
                description="The plan waits for you. If you miss a day, the same workout appears the next day."
                example="Missed Push on Mon → Tue still shows Push"
                icon="arrow-forward-circle-outline"
                colors={colors}
                radius={radius}
              />

              <MissedBehaviorCard
                selected={missedBehavior === "keep-order"}
                onPress={() => setMissedBehavior("keep-order")}
                title="Keep calendar order"
                description="The plan advances regardless. Missed days are gone."
                example="Missed Push on Mon → Tue shows Pull as scheduled"
                icon="calendar-number-outline"
                colors={colors}
                radius={radius}
              />
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View
          style={{
            paddingHorizontal: s(16),
            paddingBottom: insets.bottom + s(12),
            paddingTop: s(12),
            borderTopWidth: s(1),
            borderTopColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <TouchableOpacity
            onPress={isLastStep() ? handleCreate : handleNext}
            disabled={!canGoNext() || saving}
            style={{
              height: s(52),
              borderRadius: radius.xl,
              backgroundColor: canGoNext() ? colors.accent : colors.surface2,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: s(8),
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                color: canGoNext() ? colors.bg : colors.muted,
                fontWeight: "900",
                fontSize: s(15),
              }}
            >
              {isLastStep() ? (saving ? "Creating…" : "Create plan") : "Next"}
            </Text>
            {!isLastStep() && (
              <Ionicons
                name="arrow-forward"
                size={s(18)}
                color={canGoNext() ? colors.bg : colors.muted}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Date picker for start date */}
      <DatePickerSheet
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        value={startDate}
        onChange={(v) => {
          if (v) setStartDate(v);
          setDatePickerOpen(false);
        }}
        title="Plan start date"
      />
    </Modal>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeChoiceCard({
  selected,
  onPress,
  title,
  icon,
  subtitle,
  examples,
  colors,
  radius,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  examples: string[];
  colors: any;
  radius: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: radius.xl,
        borderWidth: s(selected ? 2 : 1),
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.accent + "12" : colors.surface,
        padding: s(16),
        gap: s(10),
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}>
        <View
          style={{
            width: s(38),
            height: s(38),
            borderRadius: s(19),
            backgroundColor: selected ? colors.accent + "25" : colors.surface2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={icon}
            size={s(20)}
            color={selected ? colors.accent : colors.muted}
          />
        </View>
        <Text style={{ flex: 1, color: colors.text, fontWeight: "900", fontSize: s(16) }}>
          {title}
        </Text>
        {selected && (
          <Ionicons name="checkmark-circle" size={s(22)} color={colors.accent} />
        )}
      </View>
      <Text style={{ color: colors.muted, fontWeight: "700", fontSize: s(13), lineHeight: s(20) }}>
        {subtitle}
      </Text>
      <View style={{ gap: s(4) }}>
        {examples.map((ex) => (
          <View key={ex} style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}>
            <View
              style={{
                width: s(5),
                height: s(5),
                borderRadius: s(3),
                backgroundColor: colors.muted,
              }}
            />
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: s(12) }}>{ex}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function CycleDayRow({
  day,
  index,
  total,
  onChangeLabel,
  onToggleRest,
  onMoveUp,
  onMoveDown,
  onDelete,
  colors,
  radius,
}: {
  day: CycleDayDraft;
  index: number;
  total: number;
  onChangeLabel: (v: string) => void;
  onToggleRest: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  colors: any;
  radius: any;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: radius.xl,
        borderWidth: s(1),
        borderColor: colors.border,
        backgroundColor: day.isRest ? colors.surface2 : colors.surface,
        paddingHorizontal: s(10),
        paddingVertical: s(8),
        marginBottom: s(8),
        gap: s(8),
      }}
    >
      <Text style={{ color: colors.muted, fontWeight: "800", fontSize: s(12), width: s(36) }}>
        Day {index + 1}
      </Text>

      {day.isRest ? (
        <Text style={{ flex: 1, color: colors.muted, fontWeight: "700", fontSize: s(14) }}>
          Rest
        </Text>
      ) : (
        <TextInput
          value={day.label}
          onChangeText={onChangeLabel}
          placeholder="e.g. Push"
          placeholderTextColor={colors.muted}
          style={{ flex: 1, color: colors.text, fontWeight: "800", fontSize: s(14) }}
        />
      )}

      {/* Rest toggle */}
      <Pressable
        onPress={onToggleRest}
        style={({ pressed }) => ({
          paddingVertical: s(4),
          paddingHorizontal: s(8),
          borderRadius: s(999),
          borderWidth: s(1),
          borderColor: day.isRest ? colors.accent : colors.border,
          backgroundColor: day.isRest ? colors.accent + "20" : "transparent",
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text
          style={{
            color: day.isRest ? colors.accent : colors.muted,
            fontWeight: "800",
            fontSize: s(11),
          }}
        >
          Rest
        </Text>
      </Pressable>

      {/* Reorder */}
      <View style={{ gap: s(2) }}>
        <Pressable onPress={onMoveUp} disabled={index === 0} style={{ opacity: index === 0 ? 0.25 : 1 }}>
          <Ionicons name="chevron-up" size={s(16)} color={colors.muted} />
        </Pressable>
        <Pressable onPress={onMoveDown} disabled={index === total - 1} style={{ opacity: index === total - 1 ? 0.25 : 1 }}>
          <Ionicons name="chevron-down" size={s(16)} color={colors.muted} />
        </Pressable>
      </View>

      {/* Delete */}
      <Pressable
        onPress={onDelete}
        disabled={total <= 1}
        style={({ pressed }) => ({
          padding: s(4),
          opacity: total <= 1 ? 0.2 : pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="close-circle-outline" size={s(18)} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function WeekDayRow({
  day,
  onChangeLabel,
  onToggleRest,
  colors,
  radius,
}: {
  day: WeekDayDraft;
  onChangeLabel: (v: string) => void;
  onToggleRest: () => void;
  colors: any;
  radius: any;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: radius.xl,
        borderWidth: s(1),
        borderColor: colors.border,
        backgroundColor: day.isRest ? colors.surface2 : colors.surface,
        paddingHorizontal: s(12),
        paddingVertical: s(10),
        marginBottom: s(8),
        gap: s(10),
      }}
    >
      <Text style={{ color: colors.muted, fontWeight: "800", fontSize: s(13), width: s(36) }}>
        {DAY_NAMES[day.dayOfWeek]}
      </Text>

      {day.isRest ? (
        <Text style={{ flex: 1, color: colors.muted, fontWeight: "700", fontSize: s(14) }}>
          Rest
        </Text>
      ) : (
        <TextInput
          value={day.label}
          onChangeText={onChangeLabel}
          placeholder="Session name"
          placeholderTextColor={colors.muted}
          style={{ flex: 1, color: colors.text, fontWeight: "800", fontSize: s(14) }}
        />
      )}

      <Pressable
        onPress={onToggleRest}
        style={({ pressed }) => ({
          paddingVertical: s(4),
          paddingHorizontal: s(8),
          borderRadius: s(999),
          borderWidth: s(1),
          borderColor: day.isRest ? colors.accent : colors.border,
          backgroundColor: day.isRest ? colors.accent + "20" : "transparent",
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text
          style={{
            color: day.isRest ? colors.accent : colors.muted,
            fontWeight: "800",
            fontSize: s(11),
          }}
        >
          Rest
        </Text>
      </Pressable>
    </View>
  );
}

function MissedBehaviorCard({
  selected,
  onPress,
  title,
  description,
  example,
  icon,
  colors,
  radius,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  description: string;
  example: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: any;
  radius: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: radius.xl,
        borderWidth: s(selected ? 2 : 1),
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.accent + "12" : colors.surface,
        padding: s(16),
        gap: s(8),
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}>
        <Ionicons name={icon} size={s(22)} color={selected ? colors.accent : colors.muted} />
        <Text style={{ flex: 1, color: colors.text, fontWeight: "900", fontSize: s(15) }}>
          {title}
        </Text>
        {selected && (
          <Ionicons name="checkmark-circle" size={s(22)} color={colors.accent} />
        )}
      </View>
      <Text style={{ color: colors.muted, fontWeight: "700", fontSize: s(13), lineHeight: s(20) }}>
        {description}
      </Text>
      <View
        style={{
          backgroundColor: colors.surface2,
          borderRadius: radius.lg,
          padding: s(10),
          borderWidth: s(1),
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.muted, fontWeight: "700", fontSize: s(12), fontStyle: "italic" }}>
          {example}
        </Text>
      </View>
    </Pressable>
  );
}
