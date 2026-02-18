import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { s } from "react-native-size-matters";

import type { EventColorKey, HM, LocalEvent, YMD } from "./types";
import { isValidHM, ymdCompare } from "./date";
import { eventColor } from "./eventColors";

/** =========================
 *  Config
 *  ========================= */
const COLORS: { key: EventColorKey; label: string }[] = [
  { key: "blue", label: "Blue" },
  { key: "teal", label: "Teal" },
  { key: "green", label: "Green" },
  { key: "yellow", label: "Yellow" },
  { key: "orange", label: "Orange" },
  { key: "red", label: "Red" },
  { key: "purple", label: "Purple" },
  { key: "gray", label: "Gray" },
];

type Mode = "event" | "birthday";

const REMINDER_ORDER: LocalEvent["reminder"][] = ["none", "at_time", "5min", "10min", "30min", "1h", "1d"];

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pad2(n: number) {
  return `${n < 10 ? "0" : ""}${n}`;
}

function ymdParts(ymd: YMD) {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  return { y, m, d };
}

function toYMD(y: number, m: number, d: number): YMD {
  return `${y}-${pad2(m)}-${pad2(d)}` as YMD;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

function weekdayOf(y: number, m: number, d: number) {
  // 0=Sun..6=Sat
  return new Date(y, m - 1, d).getDay();
}

function addMonths(y: number, m: number, delta: number) {
  const dt = new Date(y, m - 1 + delta, 1);
  return { y: dt.getFullYear(), m: dt.getMonth() + 1 };
}

function hmTo12(hm: HM) {
  const [hh, mm] = hm.split(":").map((x) => parseInt(x, 10));
  const am = hh < 12;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return { h12, mm, ap: am ? "AM" : "PM" as "AM" | "PM" };
}

function hmFrom12(h12: number, mm: number, ap: "AM" | "PM"): HM {
  let hh = h12 % 12;
  if (ap === "PM") hh += 12;
  return `${pad2(hh)}:${pad2(mm)}` as HM;
}

/** =========================
 *  CreateSheet
 *  ========================= */
export function CreateSheet(props: {
  theme: any;
  visible: boolean;
  insets: { top: number; bottom: number; left: number; right: number };
  defaultDate: YMD;
  onClose: () => void;
  onSaveEvent: (ev: LocalEvent | LocalEvent[]) => Promise<void>;
  editingEvent?: LocalEvent | null;
}) {
  const { theme, visible, insets, defaultDate, onClose, onSaveEvent, editingEvent } = props;

  const sheetY = useRef(new Animated.Value(s(999))).current;

  useEffect(() => {
    Animated.timing(sheetY, {
      toValue: visible ? s(0) : s(999),
      duration: visible ? 190 : 140,
      useNativeDriver: true,
    }).start();
  }, [visible, sheetY]);

  // mode
  const [mode, setMode] = useState<Mode>("event");

  // common
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<EventColorKey>("blue");
  const [reminder, setReminder] = useState<LocalEvent["reminder"]>("10min");
  const [recurrence, setRecurrence] = useState<LocalEvent["recurrence"]>("none");

  // event/task
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState<YMD>(defaultDate);
  const [endDate, setEndDate] = useState<YMD>(defaultDate);
  const [startTime, setStartTime] = useState<HM>("09:00");
  const [endTime, setEndTime] = useState<HM>("10:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  // birthday
  const [bdayDate, setBdayDate] = useState<YMD>(defaultDate);
  const [birthYear, setBirthYear] = useState<number>(2000);

  // pickers visibility
  const [datePicker, setDatePicker] = useState<null | { kind: "start" | "end" | "bday" }>(null);
  const [timePicker, setTimePicker] = useState<null | { kind: "start" | "end" }>(null);
  const [yearPicker, setYearPicker] = useState(false);
  const [recurrencePicker, setRecurrencePicker] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;

    // If editing an existing event, pre-fill the form
    if (editingEvent) {
      if (editingEvent.eventType === "birthday") {
        // Editing a birthday
        setMode("birthday");
        setTitle(editingEvent.title);
        setColor(editingEvent.color || "blue");
        setReminder(editingEvent.reminder || "10min");
        setRecurrence("yearly"); // birthdays always repeat yearly
        
        // Parse the startDate to get month/day and year
        const { y, m, d } = ymdParts(editingEvent.startDate);
        // Create a bdayDate with current year (just for display in the picker)
        const currentYear = new Date().getFullYear();
        setBdayDate(toYMD(currentYear, m, d));
        setBirthYear(y);
      } else {
        // Editing a regular event
        setMode("event");
        setTitle(editingEvent.title);
        setColor(editingEvent.color || "blue");
        setReminder(editingEvent.reminder || "10min");
        setRecurrence(editingEvent.recurrence || "none");
        setAllDay(editingEvent.allDay);
        setStartDate(editingEvent.startDate);
        setEndDate(editingEvent.endDate);
        setStartTime(editingEvent.startTime);
        setEndTime(editingEvent.endTime);
        setLocation(editingEvent.location || "");
        setNotes(editingEvent.notes || "");
      }
    } else {
      // Creating a new event
      setMode("event");
      setTitle("");
      setColor("blue");
      setReminder("10min");
      setRecurrence("none");
      setAllDay(false);
      setStartDate(defaultDate);
      setEndDate(defaultDate);
      setStartTime("09:00");
      setEndTime("10:00");
      setLocation("");
      setNotes("");
      setBdayDate(defaultDate);
      setBirthYear(2000);
    }

    setDatePicker(null);
    setTimePicker(null);
    setYearPicker(false);
    setRecurrencePicker(false);
    setMoreOptionsOpen(false);
  }, [visible, defaultDate, editingEvent]);

  // Auto-set recurrence to yearly for birthdays
  useEffect(() => {
    if (mode === "birthday") {
      setRecurrence("yearly");
    }
  }, [mode]);

  const error = useMemo(() => {
    if (mode === "birthday") {
      if (!title.trim()) return "Add a name";
      return "";
    }

    if (!title.trim()) return "Add a title";

    if (allDay) {
      if (ymdCompare(endDate, startDate) < 0) return "End date must be after start date";
      return "";
    }

    if (!isValidHM(startTime) || !isValidHM(endTime)) return "Time format: HH:MM";
    if (ymdCompare(endDate, startDate) < 0) return "End date must be after start date";
    if (startDate === endDate && endTime <= startTime) return "End must be after start";
    return "";
  }, [mode, title, allDay, startTime, endTime, startDate, endDate]);

  const canSave = !error;

  const generateRecurringEvents = (baseEvent: LocalEvent, count: number = 10): LocalEvent[] => {
    const events: LocalEvent[] = [baseEvent];
    const rec = baseEvent.recurrence;
    if (!rec || rec === "none") return events;

    const { y, m, d } = ymdParts(baseEvent.startDate);
    const endParts = ymdParts(baseEvent.endDate);
    
    // Calculate duration in days
    const startMs = new Date(y, m - 1, d).getTime();
    const endMs = new Date(endParts.y, endParts.m - 1, endParts.d).getTime();
    const durationDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));

    for (let i = 1; i < count; i++) {
      let newY = y, newM = m, newD = d;
      let newEndY = endParts.y, newEndM = endParts.m, newEndD = endParts.d;

      switch (rec) {
        case "daily":
          const dailyStart = new Date(y, m - 1, d + i);
          newY = dailyStart.getFullYear();
          newM = dailyStart.getMonth() + 1;
          newD = dailyStart.getDate();
          const dailyEnd = new Date(y, m - 1, d + i + durationDays);
          newEndY = dailyEnd.getFullYear();
          newEndM = dailyEnd.getMonth() + 1;
          newEndD = dailyEnd.getDate();
          break;
        case "weekly":
          const weeklyStart = new Date(y, m - 1, d + (i * 7));
          newY = weeklyStart.getFullYear();
          newM = weeklyStart.getMonth() + 1;
          newD = weeklyStart.getDate();
          const weeklyEnd = new Date(y, m - 1, d + (i * 7) + durationDays);
          newEndY = weeklyEnd.getFullYear();
          newEndM = weeklyEnd.getMonth() + 1;
          newEndD = weeklyEnd.getDate();
          break;
        case "monthly":
          const monthAdded = addMonths(y, m, i);
          newY = monthAdded.y;
          newM = monthAdded.m;
          newD = Math.min(d, daysInMonth(newY, newM));
          // For end date, maintain the same duration
          if (durationDays === 0) {
            newEndY = newY;
            newEndM = newM;
            newEndD = newD;
          } else {
            const endMonthAdded = addMonths(endParts.y, endParts.m, i);
            newEndY = endMonthAdded.y;
            newEndM = endMonthAdded.m;
            newEndD = Math.min(endParts.d, daysInMonth(newEndY, newEndM));
          }
          break;
        case "yearly":
          newY = y + i;
          newEndY = endParts.y + i;
          break;
      }

      const newEvent: LocalEvent = {
        ...baseEvent,
        id: `${baseEvent.id}_r${i}`,
        startDate: toYMD(newY, newM, newD),
        endDate: toYMD(newEndY, newEndM, newEndD),
      };
      events.push(newEvent);
    }

    return events;
  };

  const save = async () => {
    if (!canSave) return;

    const t = title.trim();
    const baseId = editingEvent?.id?.split('_r')[0] || `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    if (mode === "birthday") {
      const { m, d } = ymdParts(bdayDate);
      const start = toYMD(birthYear, m, d);

      const ev: LocalEvent = {
        id: baseId,
        title: t,
        allDay: true,
        startDate: start,
        startTime: "00:00",
        endDate: start,
        endTime: "23:59",
        color,
        reminder,
        recurrence: "yearly", // birthdays always repeat yearly
        calendarSource: "local",
        notes: undefined,
        location: undefined,
        eventType: "birthday",
      };

      // Generate recurring birthday events and save all at once
      const recurringEvents = generateRecurringEvents(ev, 50); // 50 years of birthdays
      await onSaveEvent(recurringEvents);
      onClose();
      return;
    }

    const ev: LocalEvent = {
      id: baseId,
      title: t,
      allDay,
      startDate,
      startTime: allDay ? "00:00" : startTime,
      endDate: allDay ? startDate : endDate,
      endTime: allDay ? "23:59" : endTime,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      color,
      reminder,
      recurrence,
      calendarSource: "local",
      eventType: "event",
    };

    // Generate recurring events if recurrence is set
    if (recurrence && recurrence !== "none") {
      const recurringEvents = generateRecurringEvents(ev);
      await onSaveEvent(recurringEvents);
    } else {
      await onSaveEvent(ev);
    }
    
    onClose();
  };

  const headerIcon = mode === "birthday" ? "gift-outline" : "calendar-outline";

  const titlePlaceholder = mode === "birthday" ? "Add name" : "Add title";
  const headerLabel = editingEvent ? "Edit Event" : mode === "birthday" ? "New Birthday" : "New Event";

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }} pointerEvents="box-none">
        <Pressable
          style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.4)" }]}
          onPress={onClose}
        />

        <Animated.View
          pointerEvents="box-none"
          style={{
            transform: [{ translateY: sheetY }],
            position: "absolute",
            left: s(0),
            right: s(0),
            bottom: s(0),
            maxHeight: "92%",
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: s(26),
            borderTopRightRadius: s(26),
            borderWidth: s(1),
            borderColor: theme.colors.border,
            paddingBottom: s(12) + insets.bottom,
            overflow: "hidden",
          }}
        >
          {/* header */}
          <View style={{ padding: s(14), paddingBottom: s(10) }}>
            <View style={{ alignItems: "center", paddingBottom: s(10) }}>
              <View
                style={{
                  width: s(44),
                  height: s(5),
                  borderRadius: s(999),
                  backgroundColor: theme.colors.border,
                  opacity: 0.9,
                }}
              />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: s(34),
                  height: s(34),
                  borderRadius: s(12),
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.colors.card2,
                  borderWidth: s(1),
                  borderColor: theme.colors.border,
                  marginRight: s(10),
                }}
              >
                <Ionicons name={headerIcon as any} size={s(18)} color={theme.colors.text} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(16) }}>{headerLabel}</Text>
                <Text
                  style={{ color: theme.colors.muted, fontWeight: "800", fontSize: s(12), marginTop: s(2) }}
                  numberOfLines={1}
                >
                  {defaultDate}
                </Text>
              </View>

              <Pressable
                onPress={onClose}
                hitSlop={s(10)}
                style={{
                  width: s(36),
                  height: s(36),
                  borderRadius: s(12),
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.colors.card2,
                  borderWidth: s(1),
                  borderColor: theme.colors.border,
                }}
              >
                <Ionicons name="close" size={s(18)} color={theme.colors.muted} />
              </Pressable>
            </View>

            {/* mode segmented - only show when creating new */}
            {!editingEvent && (
              <View style={{ marginTop: s(12) }}>
                <Segmented theme={theme} value={mode} onChange={setMode} />
              </View>
            )}

            {/* title */}
            <View
              style={{
                marginTop: s(12),
                borderRadius: s(16),
                backgroundColor: theme.colors.card2,
                borderWidth: s(1),
                borderColor: theme.colors.border,
                paddingHorizontal: s(12),
                paddingVertical: s(10),
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons name={mode === "birthday" ? "person-outline" : "pencil-outline"} size={s(16)} color={theme.colors.muted} />
              <View style={{ width: s(10) }} />
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={titlePlaceholder}
                placeholderTextColor={theme.colors.muted}
                style={{ flex: 1, color: theme.colors.text, fontWeight: "900", fontSize: s(14) }}
                returnKeyType="next"
              />
              {!!title && (
                <Pressable onPress={() => setTitle("")} hitSlop={s(10)} style={{ marginLeft: s(10) }}>
                  <Ionicons name="close-circle" size={s(18)} color={theme.colors.muted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* body */}
          <ScrollView contentContainerStyle={{ paddingHorizontal: s(14), paddingBottom: s(10) }} showsVerticalScrollIndicator={false}>
            {mode !== "birthday" ? (
              <>
                <RowCard
                  theme={theme}
                  icon="time-outline"
                  title="All-day"
                  right={<Switch value={allDay} onValueChange={setAllDay} />}
                />

                <RowCard
                  theme={theme}
                  icon="calendar-outline"
                  title="Start"
                  right={
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Pill
                        theme={theme}
                        text={startDate}
                        onPress={() => setDatePicker({ kind: "start" })}
                        rightIcon="chevron-down"
                      />
                      {!allDay ? (
                        <View style={{ marginLeft: s(8) }}>
                          <Pill
                            theme={theme}
                            text={formatHM12(startTime)}
                            onPress={() => setTimePicker({ kind: "start" })}
                            rightIcon="chevron-down"
                          />
                        </View>
                      ) : null}
                    </View>
                  }
                />

                <RowCard
                  theme={theme}
                  icon="calendar-outline"
                  title="End"
                  right={
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Pill
                        theme={theme}
                        text={endDate}
                        onPress={() => setDatePicker({ kind: "end" })}
                        rightIcon="chevron-down"
                      />
                      {!allDay ? (
                        <View style={{ marginLeft: s(8) }}>
                          <Pill
                            theme={theme}
                            text={formatHM12(endTime)}
                            onPress={() => setTimePicker({ kind: "end" })}
                            rightIcon="chevron-down"
                          />
                        </View>
                      ) : null}
                    </View>
                  }
                />

                <Pressable
                  onPress={() => setMoreOptionsOpen(!moreOptionsOpen)}
                  style={{
                      marginTop: s(10),
                      borderRadius: s(18),
                      borderWidth: s(1),
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.card,
                      padding: s(12),
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                          width: s(32),
                          height: s(32),
                          borderRadius: s(12),
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: theme.colors.card2,
                          borderWidth: s(1),
                        borderColor: theme.colors.border,
                          marginRight: s(10),
                      }}
                    >
                        <Ionicons name="options-outline" size={s(16)} color={theme.colors.muted} />
                    </View>
                      <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: s(13) }}>
                      More Options
                    </Text>
                  </View>
                  <Ionicons
                    name={moreOptionsOpen ? "chevron-up" : "chevron-down"}
                      size={s(20)}
                    color={theme.colors.muted}
                  />
                </Pressable>

                {moreOptionsOpen && (
                  <View
                    style={{
                        marginLeft: s(20),
                        marginTop: s(6),
                        paddingLeft: s(12),
                        borderLeftWidth: s(2),
                      borderLeftColor: theme.colors.border,
                    }}
                  >
                    <RowCard
                      theme={theme}
                      icon="repeat-outline"
                      title="Repeat"
                      right={
                        <Pill
                          theme={theme}
                          text={recurrenceLabel(recurrence)}
                          onPress={() => setRecurrencePicker(true)}
                          rightIcon="chevron-down"
                        />
                      }
                    />

                    <RowCard
                      theme={theme}
                      icon="notifications-outline"
                      title="Reminder"
                      right={
                        <Pill
                          theme={theme}
                          text={reminderLabel(reminder)}
                          onPress={() => {
                            const i = REMINDER_ORDER.indexOf(reminder);
                            setReminder(REMINDER_ORDER[(i + 1) % REMINDER_ORDER.length] ?? "10min");
                          }}
                          rightIcon="chevron-forward"
                        />
                      }
                    />
                  </View>
                )}

                <InputRow
                  theme={theme}
                  icon="location-outline"
                  placeholder="Add location"
                  value={location}
                  onChangeText={setLocation}
                />

                <ColorSection theme={theme} color={color} setColor={setColor} />
              </>
            ) : (
              <>
                <RowCard
                  theme={theme}
                  icon="calendar-outline"
                  title="Date"
                  right={
                    <Pill
                      theme={theme}
                      text={stripYear(bdayDate)}
                      onPress={() => setDatePicker({ kind: "bday" })}
                      rightIcon="chevron-down"
                    />
                  }
                />

                <RowCard
                  theme={theme}
                  icon="calendar-outline"
                  title="Birth year"
                  right={
                    <Pill
                      theme={theme}
                      text={String(birthYear)}
                      onPress={() => setYearPicker(true)}
                      rightIcon="chevron-down"
                    />
                  }
                />

                <RowCard
                  theme={theme}
                  icon="repeat-outline"
                  title="Repeat"
                  right={
                    <View
                      style={{
                        paddingHorizontal: s(12),
                        paddingVertical: s(6),
                        borderRadius: s(10),
                        backgroundColor: theme.colors.card2,
                        borderWidth: s(1),
                        borderColor: theme.colors.border,
                      }}
                    >
                      <Text style={{ color: theme.colors.muted, fontWeight: "800", fontSize: s(12) }}>
                        Every year
                      </Text>
                    </View>
                  }
                />

                <RowCard
                  theme={theme}
                  icon="notifications-outline"
                  title="Notifications"
                  right={
                    <Pill
                      theme={theme}
                      text={birthdayReminderLabel(reminder)}
                      onPress={() => {
                        // keep using same type, but rotate like google-style quick cycling
                        const i = REMINDER_ORDER.indexOf(reminder);
                        setReminder(REMINDER_ORDER[(i + 1) % REMINDER_ORDER.length] ?? "at_time");
                      }}
                      rightIcon="chevron-forward"
                    />
                  }
                />

                <ColorSection theme={theme} color={color} setColor={setColor} />
              </>
            )}
          </ScrollView>

          {/* sticky save bar */}
          <View
            style={{
              paddingHorizontal: s(14),
              paddingTop: s(10),
              borderTopWidth: s(1),
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.card,
            }}
          >
            {!!error ? (
              <Text style={{ color: theme.colors.muted, fontWeight: "800", fontSize: s(12), marginBottom: s(8) }}>{error}</Text>
            ) : (
              <View style={{ height: s(16) }} />
            )}

            <View style={{ flexDirection: "row", gap: s(10) }}>
              <Pressable
                onPress={onClose}
                style={{
                  flex: 1,
                  paddingVertical: s(12),
                  borderRadius: s(16),
                  backgroundColor: theme.colors.card2,
                  borderWidth: s(1),
                  borderColor: theme.colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(14) }}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={save}
                disabled={!canSave}
                style={{
                  flex: 1.2,
                  paddingVertical: s(12),
                  borderRadius: s(16),
                  backgroundColor: theme.colors.accent,
                  alignItems: "center",
                  opacity: canSave ? 1 : 0.5,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: s(14) }}>Save</Text>
              </Pressable>
            </View>
          </View>

          {/* Date picker overlay (mini calendar) */}
          <OverlayModal
            visible={!!datePicker}
            theme={theme}
            title="Select date"
            onClose={() => setDatePicker(null)}
            footerRightLabel="Done"
            onFooterRight={() => setDatePicker(null)}
          >
            <MiniCalendar
              theme={theme}
              value={
                datePicker?.kind === "start" ? startDate : datePicker?.kind === "end" ? endDate : bdayDate
              }
              onChange={(ymd) => {
                if (datePicker?.kind === "start") {
                  setStartDate(ymd);
                  // keep end >= start
                  if (ymdCompare(endDate, ymd) < 0) setEndDate(ymd);
                } else if (datePicker?.kind === "end") {
                  setEndDate(ymdCompare(ymd, startDate) < 0 ? startDate : ymd);
                } else if (datePicker?.kind === "bday") {
                  setBdayDate(ymd);
                }
              }}
            />
          </OverlayModal>

          {/* Time picker overlay (wheel) */}
          <OverlayModal
            visible={!!timePicker}
            theme={theme}
            title="Select time"
            onClose={() => setTimePicker(null)}
            footerRightLabel="Done"
            onFooterRight={() => setTimePicker(null)}
          >
            <TimeWheel
              theme={theme}
              value={timePicker?.kind === "start" ? startTime : endTime}
              onChange={(hm) => {
                if (timePicker?.kind === "start") {
                  setStartTime(hm);
                  // nudge end if same day and end <= start
                  if (startDate === endDate && endTime <= hm) {
                    const { h12, mm, ap } = hmTo12(hm);
                    // +1h
                    const as24 = hmFrom12(h12, mm, ap);
                    const [H] = as24.split(":").map((x) => parseInt(x, 10));
                    const newH = clamp(H + 1, 0, 23);
                    setEndTime(`${pad2(newH)}:${pad2(mm)}` as HM);
                  }
                } else {
                  setEndTime(hm);
                }
              }}
            />
          </OverlayModal>

          {/* Year picker overlay */}
          <OverlayModal
            visible={yearPicker}
            theme={theme}
            title="Select birth year"
            onClose={() => setYearPicker(false)}
            footerRightLabel="Done"
            onFooterRight={() => setYearPicker(false)}
          >
            <YearWheel theme={theme} value={birthYear} onChange={setBirthYear} />
          </OverlayModal>

          {/* Recurrence picker overlay */}
          <OverlayModal
            visible={recurrencePicker}
            theme={theme}
            title="Repeat"
            onClose={() => setRecurrencePicker(false)}
            footerRightLabel="Done"
            onFooterRight={() => setRecurrencePicker(false)}
          >
            <View style={{ paddingVertical: s(10) }}>
              {(["none", "daily", "weekly", "monthly", "yearly"] as const).map((rec) => (
                <Pressable
                  key={rec}
                  onPress={() => {
                    setRecurrence(rec);
                    setRecurrencePicker(false);
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: s(14),
                    paddingHorizontal: s(16),
                    backgroundColor: pressed ? theme.colors.card2 : "transparent",
                    borderRadius: s(12),
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  })}
                >
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontWeight: recurrence === rec ? "900" : "700",
                      fontSize: s(15),
                    }}
                  >
                    {recurrenceLabel(rec)}
                  </Text>
                  {recurrence === rec && (
                    <Ionicons name="checkmark" size={s(20)} color={theme.colors.accent} />
                  )}
                </Pressable>
              ))}
            </View>
          </OverlayModal>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** =========================
 *  UI building blocks
 *  ========================= */
function Segmented({
  theme,
  value,
  onChange,
}: {
  theme: any;
  value: Mode;
  onChange: (m: Mode) => void;
}) {
  const items: { key: Mode; label: string }[] = [
    { key: "event", label: "Event" },
    { key: "birthday", label: "Birthday" },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: theme.colors.card2,
        borderWidth: s(1),
        borderColor: theme.colors.border,
        borderRadius: s(16),
        padding: s(4),
      }}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={{
              flex: 1,
              paddingVertical: s(10),
              borderRadius: s(12),
              alignItems: "center",
              backgroundColor: active ? theme.colors.accent : "transparent",
            }}
          >
            <Text
              style={{
                color: active ? "#fff" : theme.colors.text,
                fontWeight: "900",
                fontSize: s(13),
              }}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RowCard({ theme, icon, title, right }: { theme: any; icon: any; title: string; right: React.ReactNode }) {
  return (
    <View
      style={{
        marginTop: s(10),
        borderRadius: s(18),
        borderWidth: s(1),
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card,
        padding: s(12),
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: s(32),
          height: s(32),
          borderRadius: s(12),
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.card2,
          borderWidth: s(1),
          borderColor: theme.colors.border,
          marginRight: s(10),
        }}
      >
        <Ionicons name={icon} size={s(16)} color={theme.colors.muted} />
      </View>
      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(13) }}>{title}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

function InputRow({
  theme,
  icon,
  placeholder,
  value,
  onChangeText,
}: {
  theme: any;
  icon: any;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View
      style={{
        marginTop: s(10),
        borderRadius: s(18),
        borderWidth: s(1),
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card,
        padding: s(12),
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: s(32),
          height: s(32),
          borderRadius: s(12),
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.card2,
          borderWidth: s(1),
          borderColor: theme.colors.border,
          marginRight: s(10),
        }}
      >
        <Ionicons name={icon} size={s(16)} color={theme.colors.muted} />
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        style={{ flex: 1, color: theme.colors.text, fontWeight: "800", fontSize: s(13) }}
      />

      {!!value && (
        <Pressable onPress={() => onChangeText("")} hitSlop={s(10)} style={{ marginLeft: s(10) }}>
          <Ionicons name="close" size={s(18)} color={theme.colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

function Pill({
  theme,
  text,
  onPress,
  rightIcon,
}: {
  theme: any;
  text: string;
  onPress: () => void;
  rightIcon?: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: s(8),
        paddingHorizontal: s(10),
        borderRadius: s(999),
        backgroundColor: theme.colors.card2,
        borderWidth: s(1),
        borderColor: theme.colors.border,
      }}
    >
      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(12) }}>{text}</Text>
      {rightIcon ? (
        <>
          <View style={{ width: s(6) }} />
          <Ionicons name={rightIcon} size={s(14)} color={theme.colors.muted} />
        </>
      ) : null}
    </Pressable>
  );
}

function ColorSection({
  theme,
  color,
  setColor,
}: {
  theme: any;
  color: EventColorKey;
  setColor: (k: EventColorKey) => void;
}) {
  return (
    <View
      style={{
        marginTop: s(10),
        borderRadius: s(18),
        borderWidth: s(1),
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card,
        padding: s(12),
      }}
    >
      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(13) }}>Color</Text>
      <View style={{ marginTop: s(10), flexDirection: "row", flexWrap: "wrap" }}>
        {COLORS.map((c) => {
          const active = c.key === color;
          return (
            <Pressable
              key={c.key}
              onPress={() => setColor(c.key)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: s(8),
                paddingHorizontal: s(10),
                borderRadius: s(999),
                borderWidth: s(1),
                borderColor: active ? theme.colors.text : theme.colors.border,
                backgroundColor: active ? theme.colors.card2 : theme.colors.card,
                marginRight: s(10),
                marginBottom: s(10),
              }}
            >
              <View
                style={{
                  width: s(14),
                  height: s(14),
                  borderRadius: s(7),
                  backgroundColor: eventColor(theme, c.key),
                }}
              />
              <View style={{ width: s(8) }} />
              <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: s(12) }}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function NotesSection({ theme, notes, setNotes }: { theme: any; notes: string; setNotes: (v: string) => void }) {
  return (
    <View
      style={{
        marginTop: s(10),
        borderRadius: s(18),
        borderWidth: s(1),
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card,
        padding: s(12),
      }}
    >
      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(13) }}>Notes</Text>
      <View
        style={{
          marginTop: s(10),
          borderRadius: s(14),
          backgroundColor: theme.colors.card2,
          borderWidth: s(1),
          borderColor: theme.colors.border,
          padding: s(10),
        }}
      >
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Add description"
          placeholderTextColor={theme.colors.muted}
          style={{ color: theme.colors.text, fontWeight: "800", fontSize: s(13), minHeight: s(70) }}
          multiline
        />
      </View>
    </View>
  );
}

/** =========================
 *  Overlay modal (picker container)
 *  ========================= */
function OverlayModal({
  visible,
  theme,
  title,
  onClose,
  children,
  footerRightLabel,
  onFooterRight,
}: {
  visible: boolean;
  theme: any;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footerRightLabel: string;
  onFooterRight: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.35)" }]} onPress={onClose} />

        <View style={{ position: "absolute", left: s(14), right: s(14), bottom: s(14) }}>
          <View
            style={{
              borderRadius: s(18),
              borderWidth: s(1),
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                paddingHorizontal: s(12),
                paddingVertical: s(10),
                borderBottomWidth: s(1),
                borderBottomColor: theme.colors.border,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text style={{ flex: 1, color: theme.colors.text, fontWeight: "900", fontSize: s(14) }}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={s(10)} style={{ padding: s(6) }}>
                <Ionicons name="close" size={s(18)} color={theme.colors.muted} />
              </Pressable>
            </View>

            <View style={{ padding: s(12) }}>{children}</View>

            <View
              style={{
                padding: s(12),
                borderTopWidth: s(1),
                borderTopColor: theme.colors.border,
                flexDirection: "row",
                justifyContent: "flex-end",
              }}
            >
              <Pressable
                onPress={onFooterRight}
                style={{
                  paddingVertical: s(10),
                  paddingHorizontal: s(14),
                  borderRadius: s(12),
                  backgroundColor: theme.colors.accent,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: s(13) }}>{footerRightLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** =========================
 *  Mini calendar (tap-to-select)
 *  ========================= */
function MiniCalendar({ theme, value, onChange }: { theme: any; value: YMD; onChange: (ymd: YMD) => void }) {
  const { y, m, d } = ymdParts(value);
  const [curY, setCurY] = useState(y);
  const [curM, setCurM] = useState(m);

  useEffect(() => {
    setCurY(y);
    setCurM(m);
  }, [y, m]);

  const dim = daysInMonth(curY, curM);
  const firstW = weekdayOf(curY, curM, 1);
  const weeks: Array<Array<number | null>> = [];
  let week: Array<number | null> = [];

  for (let i = 0; i < firstW; i++) week.push(null);
  for (let day = 1; day <= dim; day++) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const monthLabel = new Date(curY, curM - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={() => {
            const next = addMonths(curY, curM, -1);
            setCurY(next.y);
            setCurM(next.m);
          }}
          style={miniBtn(theme)}
        >
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <Text style={{ flex: 1, textAlign: "center", color: theme.colors.text, fontWeight: "900" }}>{monthLabel}</Text>

        <Pressable
          onPress={() => {
            const next = addMonths(curY, curM, 1);
            setCurY(next.y);
            setCurM(next.m);
          }}
          style={miniBtn(theme)}
        >
          <Ionicons name="chevron-forward" size={s(18)} color={theme.colors.text} />
        </Pressable>
      </View>

      <View style={{ marginTop: s(10), flexDirection: "row" }}>
        {weekdays.map((w, idx) => (
          <Text
            key={idx}
            style={{
              flex: 1,
              textAlign: "center",
              color: theme.colors.muted,
              fontWeight: "900",
              fontSize: s(12),
            }}
          >
            {w}
          </Text>
        ))}
      </View>

      <View style={{ marginTop: s(8) }}>
        {weeks.map((wk, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: s(6) }}>
            {wk.map((day, j) => {
              const selected = day != null && curY === y && curM === m && day === d;
              return (
                <Pressable
                  key={`${i}-${j}`}
                  onPress={() => {
                    if (day == null) return;
                    onChange(toYMD(curY, curM, day));
                  }}
                  style={{
                    flex: 1,
                    height: s(36),
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: s(999),
                    backgroundColor: selected ? theme.colors.accent : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: selected ? "#fff" : theme.colors.text,
                      fontWeight: "900",
                      opacity: day == null ? 0 : 1,
                    }}
                  >
                    {day ?? ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function miniBtn(theme: any) {
  return {
    width: s(34),
    height: s(34),
    borderRadius: s(12),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: theme.colors.card2,
    borderWidth: s(1),
    borderColor: theme.colors.border,
  };
}

/** =========================
 *  Time wheel picker (hour/minute/AMPM)
 *  ========================= */
function TimeWheel({ theme, value, onChange }: { theme: any; value: HM; onChange: (hm: HM) => void }) {
  const { h12: initH12, mm: initMM, ap: initAP } = hmTo12(value);

  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]; // google-like coarse wheel
  const [h12, setH12] = useState(initH12);
  const [mm, setMM] = useState(minutes.includes(initMM) ? initMM : 0);
  const [ap, setAP] = useState<"AM" | "PM">(initAP);

  useEffect(() => {
    const next = hmTo12(value);
    setH12(next.h12);
    setAP(next.ap);
    setMM(minutes.includes(next.mm) ? next.mm : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    onChange(hmFrom12(h12, mm, ap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h12, mm, ap]);

  return (
    <View
      style={{
        borderRadius: s(16),
        borderWidth: s(1),
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card2,
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", height: s(170) }}>
        <WheelCol theme={theme} width={1}>
          <Picker selectedValue={h12} onValueChange={(v) => setH12(v)} style={{ height: s(170) }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <Picker.Item key={h} label={`${h}`} value={h} color={theme.colors.text} />
            ))}
          </Picker>
        </WheelCol>

        <WheelCol theme={theme} width={1}>
          <Picker selectedValue={mm} onValueChange={(v) => setMM(v)} style={{ height: s(170) }}>
            {minutes.map((m) => (
              <Picker.Item key={m} label={pad2(m)} value={m} color={theme.colors.text} />
            ))}
          </Picker>
        </WheelCol>

        <WheelCol theme={theme} width={1}>
          <Picker selectedValue={ap} onValueChange={(v) => setAP(v)} style={{ height: s(170) }}>
            <Picker.Item label="AM" value="AM" color={theme.colors.text} />
            <Picker.Item label="PM" value="PM" color={theme.colors.text} />
          </Picker>
        </WheelCol>
      </View>


    </View>
  );
}

function WheelCol({ theme, children, width }: { theme: any; children: React.ReactNode; width: number }) {
  return (
    <View
      style={{
        flex: width,
        borderRightWidth: s(1),
        borderRightColor: theme.colors.border,
      }}
    >
      {children}
    </View>
  );
}

/** =========================
 *  Year wheel picker
 *  ========================= */
function YearWheel({ theme, value, onChange }: { theme: any; value: number; onChange: (year: number) => void }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 120 }, (_, i) => currentYear - i); // 120 years back from current year

  return (
    <View
      style={{
        borderRadius: s(16),
        borderWidth: s(1),
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card2,
        overflow: "hidden",
        height: s(170),
      }}
    >
      <Picker selectedValue={value} onValueChange={(v) => onChange(v)} style={{ height: s(170) }}>
        {years.map((y) => (
          <Picker.Item key={y} label={String(y)} value={y} color={theme.colors.text} />
        ))}
      </Picker>
    </View>
  );
}

/** =========================
 *  Labels
 *  ========================= */
function reminderLabel(r: LocalEvent["reminder"]) {
  switch (r) {
    case "none":
      return "None";
    case "at_time":
      return "At time of event";
    case "5min":
      return "5 min before";
    case "10min":
      return "10 min before";
    case "30min":
      return "30 min before";
    case "1h":
      return "1 hour before";
    case "1d":
      return "1 day before";
    default:
      return String(r);
  }
}

function birthdayReminderLabel(r: LocalEvent["reminder"]) {
  // You can later expand to “day of at 9:00 AM”, “1 week before at 9:00 AM”, etc.
  // For now, keep same stored reminder types and present them cleanly.
  if (r === "none") return "None";
  if (r === "1d") return "Day of (morning)";
  if (r === "1h") return "1 hour before";
  if (r === "30min") return "30 min before";
  if (r === "10min") return "10 min before";
  if (r === "5min") return "5 min before";
  return "Day of (morning)";
}

function formatHM12(hm: HM) {
  const { h12, mm, ap } = hmTo12(hm);
  return `${h12}:${pad2(mm)} ${ap}`;
}

function stripYear(ymd: YMD) {
  const { m, d } = ymdParts(ymd);
  // "Feb 11" (system locale short month)
  const dt = new Date(2000, m - 1, d);
  const s = dt.toLocaleString(undefined, { month: "short", day: "numeric" });
  return s;
}

function recurrenceLabel(r?: LocalEvent["recurrence"]) {
  switch (r) {
    case "none":
    case undefined:
      return "Does not repeat";
    case "daily":
      return "Every day";
    case "weekly":
      return "Every week";
    case "monthly":
      return "Every month";
    case "yearly":
      return "Every year";
    default:
      return "Does not repeat";
  }
}
