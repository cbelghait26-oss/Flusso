// CreateSheet.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { s } from "../../ui/ts";

import type { EventColorKey, HM, LocalEvent, PlaceData, YMD } from "./types";
import { isValidHM, ymdCompare } from "./date";
import { SmartLocationInput } from "./SmartLocationInput";
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
  { key: "pink", label: "Pink" },
];

type Mode = "event" | "birthday";

const EVENT_REMINDER_OPTIONS: LocalEvent["reminder"][] = ["none", "at_time", "5min", "10min", "30min", "1h", "2h", "1d", "2d", "3d", "5d"];
const BIRTHDAY_REMINDER_OPTIONS: LocalEvent["reminder"][] = ["none", "at_time", "1d", "3d", "1w"];

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
  onDeleteEvent?: (ev: LocalEvent) => Promise<void> | void;
  editingEvent?: LocalEvent | null;
  /** Optional list of friends to show a share-with picker. Only rendered for event mode. */
  friends?: { uid: string; displayName: string; friendTag: string }[];
  /** Called after the event is saved, with the list of selected friend UIDs, the title, and the start date. */
  onShare?: (inviteeUids: string[], title: string, date: YMD) => void;
  /** Current user's UID — used for shared event permission checks. */
  myUid?: string;
  /** If editing a shared event, pass its Firestore data here. */
  sharedEventData?: { creator_id: string; participants: { uid: string; displayName: string }[]; hideParticipants?: boolean } | null;
  /** Creator kicks a participant from the shared event. */
  onKickParticipant?: (uid: string) => void;
  /** Creator toggles participant visibility for others. */
  onToggleHideParticipants?: (hide: boolean) => void;
  /** Guest leaves (quit) the shared event. */
  onLeaveSharedEvent?: () => void;
  /** UIDs of users the current user is already friends with (for quick-add in guest view). */
  friendUids?: Set<string>;
  /** Called when a guest taps the quick-add button next to a participant they’re not friends with. */
  onAddFriend?: (uid: string) => void;
}) {
  const {
    theme, visible, insets, defaultDate, onClose, onSaveEvent, onDeleteEvent,
    editingEvent, friends, onShare,
    myUid, sharedEventData, onKickParticipant, onToggleHideParticipants, onLeaveSharedEvent,
    friendUids, onAddFriend,
  } = props;

  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= 768;

  const sheetY = useRef(new Animated.Value(s(999))).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const notesRef = useRef<TextInput>(null);
  const notesY = useRef(0);

  useEffect(() => {
    Animated.timing(sheetY, {
      toValue: visible ? s(0) : s(999),
      duration: visible ? 190 : 140,
      useNativeDriver: true,
    }).start();
  }, [visible, sheetY]);

  const [mode, setMode] = useState<Mode>("event");
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<EventColorKey>("blue");
  const [reminder, setReminder] = useState<LocalEvent["reminder"]>("10min");
  const [recurrence, setRecurrence] = useState<LocalEvent["recurrence"]>("none");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState<YMD>(defaultDate);
  const [endDate, setEndDate] = useState<YMD>(defaultDate);
  const [startTime, setStartTime] = useState<HM>("09:00");
  const [endTime, setEndTime] = useState<HM>("10:00");
  const [location, setLocation] = useState("");
  const [locationPlace, setLocationPlace] = useState<PlaceData | null>(null);
  const [notes, setNotes] = useState("");
  const [bdayDate, setBdayDate] = useState<YMD>(defaultDate);
  const [birthYear, setBirthYear] = useState<number>(2000);

  const [invitees, setInvitees] = useState<Set<string>>(new Set());
  const [friendSearch, setFriendSearch] = useState("");
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);

  const [datePicker, setDatePicker] = useState<null | { kind: "start" | "end" | "bday" }>(null);
  const [timePicker, setTimePicker] = useState<null | { kind: "start" | "end" }>(null);
  const [yearPicker, setYearPicker] = useState(false);
  const [recurrencePicker, setRecurrencePicker] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [colorExpanded, setColorExpanded] = useState(false);

  useEffect(() => {
    if (!visible) return;

    if (editingEvent) {
      if (editingEvent.eventType === "birthday") {
        setMode("birthday");
        setTitle(editingEvent.title);
        setColor("birthday");
        setReminder(editingEvent.reminder || "10min");
        setRecurrence("yearly");
        const { y, m, d } = ymdParts(editingEvent.startDate);
        const currentYear = new Date().getFullYear();
        setBdayDate(toYMD(currentYear, m, d));
        setBirthYear(editingEvent.birthYear ?? y);
      } else {
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
        setLocationPlace(editingEvent.locationPlace ?? null);
        setNotes(editingEvent.notes || "");
      }
    } else {
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
      setLocationPlace(null);
      setNotes("");
      setBdayDate(defaultDate);
      setBirthYear(2000);
    }

    setDatePicker(null);
    setTimePicker(null);
    setYearPicker(false);
    setRecurrencePicker(false);
    setMoreOptionsOpen(false);
    setReminderOpen(false);
    setColorExpanded(false);
    setInvitees(new Set());
    setFriendSearch("");
    setFriendPickerOpen(false);
  }, [visible, defaultDate, editingEvent]);

  useEffect(() => {
    if (mode === "birthday") {
      setRecurrence("yearly");
      setColor("birthday");
    } else if (color === "birthday") {
      setColor("blue");
    }
  }, [mode, color]);

  const error = useMemo(() => {
    if (mode === "birthday") {
      if (!title.trim()) return "Add a name";
      return "";
    }
    if (!title.trim()) return "Add a title";
    if (!allDay) {
      if (!isValidHM(startTime) || !isValidHM(endTime)) return "Time format: HH:MM";
      if (endTime <= startTime) return "End time must be after start";
    }
    return "";
  }, [mode, title, allDay, startTime, endTime]);

  const canSave = !error;

  const generateRecurringEvents = (baseEvent: LocalEvent, count: number = 10): LocalEvent[] => {
    const events: LocalEvent[] = [baseEvent];
    const rec = baseEvent.recurrence;
    if (!rec || rec === "none") return events;

    const { y, m, d } = ymdParts(baseEvent.startDate);
    const endParts = ymdParts(baseEvent.endDate);
    const startMs = new Date(y, m - 1, d).getTime();
    const endMs = new Date(endParts.y, endParts.m - 1, endParts.d).getTime();
    const durationDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));

    for (let i = 1; i < count; i++) {
      let newY = y, newM = m, newD = d;
      let newEndY = endParts.y, newEndM = endParts.m, newEndD = endParts.d;

      switch (rec) {
        case "daily":
          const dailyStart = new Date(y, m - 1, d + i);
          newY = dailyStart.getFullYear(); newM = dailyStart.getMonth() + 1; newD = dailyStart.getDate();
          const dailyEnd = new Date(y, m - 1, d + i + durationDays);
          newEndY = dailyEnd.getFullYear(); newEndM = dailyEnd.getMonth() + 1; newEndD = dailyEnd.getDate();
          break;
        case "weekly":
          const weeklyStart = new Date(y, m - 1, d + (i * 7));
          newY = weeklyStart.getFullYear(); newM = weeklyStart.getMonth() + 1; newD = weeklyStart.getDate();
          const weeklyEnd = new Date(y, m - 1, d + (i * 7) + durationDays);
          newEndY = weeklyEnd.getFullYear(); newEndM = weeklyEnd.getMonth() + 1; newEndD = weeklyEnd.getDate();
          break;
        case "monthly":
          const monthAdded = addMonths(y, m, i);
          newY = monthAdded.y; newM = monthAdded.m; newD = Math.min(d, daysInMonth(newY, newM));
          if (durationDays === 0) { newEndY = newY; newEndM = newM; newEndD = newD; }
          else {
            const endMonthAdded = addMonths(endParts.y, endParts.m, i);
            newEndY = endMonthAdded.y; newEndM = endMonthAdded.m;
            newEndD = Math.min(endParts.d, daysInMonth(newEndY, newEndM));
          }
          break;
        case "yearly":
          newY = y + i; newEndY = endParts.y + i;
          break;
      }

      events.push({
        ...baseEvent,
        id: `${baseEvent.id}_r${i}`,
        startDate: toYMD(newY, newM, newD),
        endDate: toYMD(newEndY, newEndM, newEndD),
      });
    }

    return events;
  };

  const save = async () => {
    if (!canSave) return;

    const t = title.trim();
    const baseId = editingEvent?.id?.split("_r")[0] || `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    if (mode === "birthday") {
      const { m, d } = ymdParts(bdayDate);
      const start = toYMD(birthYear, m, d);
      const ev: LocalEvent = {
        id: baseId, title: t, allDay: true,
        startDate: start, startTime: "00:00", endDate: start, endTime: "23:59",
        color: "birthday", reminder, recurrence: "yearly",
        calendarSource: "local", notes: undefined, location: undefined,
        eventType: "birthday", birthYear,
      };
      await onSaveEvent(generateRecurringEvents(ev, 50));
      onClose();
      return;
    }

    const ev: LocalEvent = {
      id: baseId, title: t, allDay,
      startDate, startTime: allDay ? "00:00" : startTime,
      endDate: startDate,
      endTime: allDay ? "23:59" : endTime,
      location: location.trim() || undefined,
      locationPlace: location.trim() ? (locationPlace ?? undefined) : undefined,
      notes: notes.trim() || undefined,
      color, reminder, recurrence,
      calendarSource: "local", eventType: "event",
    };

    if (recurrence && recurrence !== "none") {
      await onSaveEvent(generateRecurringEvents(ev));
    } else {
      await onSaveEvent(ev);
    }
    if (onShare && invitees.size > 0) onShare([...invitees], t, startDate);
    onClose();
  };

  // Delete handler — shows confirmation alert before deleting
  const handleDelete = () => {
    if (!editingEvent || !onDeleteEvent) return;

    const isRecurring =
      editingEvent.recurrence && editingEvent.recurrence !== "none" ||
      editingEvent.eventType === "birthday";

    const message = isRecurring
      ? "This will delete all occurrences of this event."
      : "This event will be permanently deleted.";

    Alert.alert("Delete event?", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDeleteEvent(editingEvent),
      },
    ]);
  };

  const headerIcon = mode === "birthday" ? "gift-outline" : "calendar-outline";
  const titlePlaceholder = mode === "birthday" ? "Add name" : "Add title";
  const headerLabel = editingEvent ? "Edit Event" : mode === "birthday" ? "New Birthday" : "New Event";

  // Shared event permissions
  const isSharedEvent = !!sharedEventData;
  const isCreatorOfShared = isSharedEvent && sharedEventData!.creator_id === myUid;
  const isGuestOfShared = isSharedEvent && !isCreatorOfShared;

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
            left: s(0), right: s(0), bottom: s(0),
            maxHeight: "92%",
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: s(26), borderTopRightRadius: s(26),
            borderWidth: s(1), borderColor: theme.colors.border,
            paddingBottom: s(12) + insets.bottom,
            overflow: "hidden",
          }}
        >
          {/* header */}
          <View style={{ padding: s(14), paddingBottom: s(10) }}>
            <View style={{ alignItems: "center", paddingBottom: s(10) }}>
              <View style={{ width: s(44), height: s(5), borderRadius: s(999), backgroundColor: theme.colors.border, opacity: 0.9 }} />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{
                width: s(34), height: s(34), borderRadius: s(12),
                alignItems: "center", justifyContent: "center",
                backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border, marginRight: s(10),
              }}>
                <Ionicons name={headerIcon as any} size={s(18)} color={theme.colors.text} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(16) }}>{headerLabel}</Text>
                <Text style={{ color: theme.colors.muted, fontWeight: "800", fontSize: s(12), marginTop: s(2) }} numberOfLines={1}>
                  {defaultDate}
                </Text>
              </View>

              <Pressable
                onPress={onClose}
                hitSlop={s(10)}
                style={{
                  width: s(36), height: s(36), borderRadius: s(12),
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border,
                }}
              >
                <Ionicons name="close" size={s(18)} color={theme.colors.muted} />
              </Pressable>
            </View>

            {!editingEvent && (
              <View style={{ marginTop: s(12) }}>
                <Segmented theme={theme} value={mode} onChange={setMode} />
              </View>
            )}

            <View style={{
              marginTop: s(12), borderRadius: s(16),
              backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border,
              paddingHorizontal: s(12), paddingVertical: s(10),
              flexDirection: "row", alignItems: "center",
            }}>
              <Ionicons name={mode === "birthday" ? "person-outline" : "pencil-outline"} size={s(16)} color={theme.colors.muted} />
              <View style={{ width: s(10) }} />
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={titlePlaceholder}
                placeholderTextColor={theme.colors.muted}
                style={{ flex: 1, color: theme.colors.text, fontWeight: "900", fontSize: s(14) }}
                returnKeyType="next"
                onSubmitEditing={() => {
                  notesRef.current?.focus();
                  scrollViewRef.current?.scrollTo({ y: notesY.current - s(12), animated: true });
                }}
              />
              {!!title && (
                <Pressable onPress={() => setTitle("")} hitSlop={s(10)} style={{ marginLeft: s(10) }}>
                  <Ionicons name="close-circle" size={s(18)} color={theme.colors.muted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* body */}
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={{ paddingHorizontal: s(14), paddingBottom: s(10) }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            {mode !== "birthday" ? (
              <>
                {/* ── Guest-only shared event view ── */}
                {isGuestOfShared ? (
                  <View style={{ gap: s(7), paddingTop: s(4) }}>
                    {/* Date */}
                    <RowCard theme={theme} icon="calendar-outline" title="Date"
                      right={<Pill theme={theme} text={startDate} />}
                    />
                    {/* Time */}
                    {!allDay && (
                      <RowCard theme={theme} icon="time-outline" title="Time"
                        right={
                          <Text style={{ color: theme.colors.text, fontWeight: "700", fontSize: s(13) }}>
                            {formatHM12(startTime)} → {formatHM12(endTime)}
                          </Text>
                        }
                      />
                    )}
                    {/* Location */}
                    <RowCard theme={theme} icon="location-outline" title="Location"
                      right={location
                        ? <Text style={{ color: theme.colors.text, fontWeight: "700", fontSize: s(13) }}>{location}</Text>
                        : <Text style={{ color: theme.colors.muted, fontSize: s(13) }}>None</Text>}
                    />
                    {/* Participant list (visible unless hidden by creator) */}
                    {!sharedEventData!.hideParticipants && sharedEventData!.participants.length > 0 && (
                      <View style={{ borderRadius: s(18), borderWidth: s(1), borderColor: theme.colors.border, backgroundColor: theme.colors.card, padding: s(12) }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: s(8) }}>
                          <View style={{ width: s(32), height: s(32), borderRadius: s(12), alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border, marginRight: s(10) }}>
                            <Ionicons name="people-outline" size={s(16)} color={theme.colors.muted} />
                          </View>
                          <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: s(13) }}>Participants</Text>
                        </View>
                        {sharedEventData!.participants.map((p) => {
                          const isHost = p.uid === sharedEventData!.creator_id;
                          const isSelf = p.uid === myUid;
                          const alreadyFriend = isHost || isSelf || (friendUids?.has(p.uid) ?? false);
                          return (
                            <View key={p.uid} style={{ flexDirection: "row", alignItems: "center", paddingVertical: s(6), gap: s(10) }}>
                              <View style={{ width: s(30), height: s(30), borderRadius: s(15), backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(12) }}>{p.displayName.charAt(0).toUpperCase()}</Text>
                              </View>
                              <Text style={{ flex: 1, color: theme.colors.text, fontWeight: "700", fontSize: s(13) }}>{p.displayName}</Text>
                              {isHost ? (
                                <View style={{ paddingHorizontal: s(8), paddingVertical: s(2), borderRadius: s(999), backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border }}>
                                  <Text style={{ color: theme.colors.muted, fontSize: s(11), fontWeight: "800" }}>Host</Text>
                                </View>
                              ) : !alreadyFriend ? (
                                <Pressable
                                  onPress={() => onAddFriend?.(p.uid)}
                                  hitSlop={s(8)}
                                  style={({ pressed }) => ({
                                    flexDirection: "row", alignItems: "center", gap: s(4),
                                    paddingHorizontal: s(8), paddingVertical: s(4),
                                    borderRadius: s(999), borderWidth: s(1),
                                    borderColor: theme.colors.accent,
                                    backgroundColor: theme.colors.card2,
                                    opacity: pressed ? 0.7 : 1,
                                  })}
                                >
                                  <Ionicons name="person-add-outline" size={s(12)} color={theme.colors.accent} />
                                  <Text style={{ color: theme.colors.accent, fontSize: s(11), fontWeight: "800" }}>Add</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ gap: s(7), paddingTop: s(4) }}>
                    {/* ── Compact Datetime Card ── */}
                    <View style={{ borderRadius: s(18), borderWidth: s(1), borderColor: theme.colors.border, backgroundColor: theme.colors.card, overflow: "hidden" }}>
                      {/* Start → End row */}
                      <View style={{ flexDirection: "row", alignItems: "center", padding: s(12), gap: s(8) }}>
                        <View style={{ width: s(32), height: s(32), borderRadius: s(12), alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border }}>
                          <Ionicons name="time-outline" size={s(16)} color={theme.colors.muted} />
                        </View>
                        {isTablet ? (
                          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: s(6) }}>
                            <Pill theme={theme} text={startDate} onPress={() => setDatePicker({ kind: "start" })} rightIcon="chevron-down" />
                            {!allDay && (
                              <>
                                <Pill theme={theme} text={formatHM12(startTime)} onPress={() => setTimePicker({ kind: "start" })} rightIcon="chevron-down" />
                                <Ionicons name="arrow-forward" size={s(12)} color={theme.colors.muted} />
                                <Pill theme={theme} text={formatHM12(endTime)} onPress={() => setTimePicker({ kind: "end" })} rightIcon="chevron-down" />
                              </>
                            )}
                          </View>
                        ) : (
                          <View style={{ flex: 1, gap: s(6) }}>
                            <Pill theme={theme} text={startDate} onPress={() => setDatePicker({ kind: "start" })} rightIcon="chevron-down" />
                            {!allDay && (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}>
                                <Pill theme={theme} text={formatHM12(startTime)} onPress={() => setTimePicker({ kind: "start" })} rightIcon="chevron-down" />
                                <Ionicons name="arrow-forward" size={s(12)} color={theme.colors.muted} />
                                <Pill theme={theme} text={formatHM12(endTime)} onPress={() => setTimePicker({ kind: "end" })} rightIcon="chevron-down" />
                              </View>
                            )}
                          </View>
                        )}
                      </View>

                      {/* All-day toggle */}
                      <View style={{ height: s(1), backgroundColor: theme.colors.border, marginHorizontal: s(12) }} />
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: s(12), paddingVertical: s(10) }}>
                        <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: s(13) }}>All day</Text>
                        <Switch value={allDay} onValueChange={setAllDay} />
                      </View>

                      {/* More options (Repeat + Reminder) */}
                      <View style={{ height: s(1), backgroundColor: theme.colors.border, marginHorizontal: s(12) }} />
                      <Pressable
                        onPress={() => { if (moreOptionsOpen) setReminderOpen(false); setMoreOptionsOpen(!moreOptionsOpen); }}
                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: s(12), paddingVertical: s(10) }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
                          <Ionicons name="options-outline" size={s(15)} color={theme.colors.muted} />
                          <Text style={{ color: theme.colors.muted, fontWeight: "700", fontSize: s(13) }}>More options</Text>
                        </View>
                        <Ionicons name={moreOptionsOpen ? "chevron-up" : "chevron-down"} size={s(16)} color={theme.colors.muted} />
                      </Pressable>
                      {moreOptionsOpen && (
                        <View style={{ borderTopWidth: s(1), borderTopColor: theme.colors.border, paddingHorizontal: s(12), paddingBottom: s(8) }}>
                          <RowCard theme={theme} icon="repeat-outline" title="Repeat"
                            right={<Pill theme={theme} text={recurrenceLabel(recurrence)} onPress={() => setRecurrencePicker(true)} rightIcon="chevron-down" />}
                          />
                          <Pressable
                            onPress={() => setReminderOpen((v) => !v)}
                            style={{ marginTop: s(10), borderRadius: s(18), borderWidth: s(1), borderColor: theme.colors.border, backgroundColor: theme.colors.card, padding: s(12), flexDirection: "row", alignItems: "center" }}
                          >
                            <View style={{ width: s(32), height: s(32), borderRadius: s(12), alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border, marginRight: s(10) }}>
                              <Ionicons name="notifications-outline" size={s(16)} color={theme.colors.muted} />
                            </View>
                            <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(13) }}>Reminder</Text>
                            <View style={{ flex: 1 }} />
                            <Text style={{ color: theme.colors.muted, fontWeight: "700", fontSize: s(12), marginRight: s(6) }}>{reminderLabel(reminder)}</Text>
                            <Ionicons name={reminderOpen ? "chevron-up" : "chevron-down"} size={s(14)} color={theme.colors.muted} />
                          </Pressable>
                          {reminderOpen && (
                            <View style={{ marginTop: s(6), flexDirection: "row", flexWrap: "wrap", gap: s(6) }}>
                              {EVENT_REMINDER_OPTIONS.map((opt) => (
                                <Pressable
                                  key={opt}
                                  onPress={() => { setReminder(opt); setReminderOpen(false); }}
                                  style={({ pressed }) => ({ paddingVertical: s(7), paddingHorizontal: s(10), borderRadius: s(999), borderWidth: s(1), borderColor: reminder === opt ? theme.colors.accent : theme.colors.border, backgroundColor: reminder === opt ? theme.colors.accent + "22" : theme.colors.card2, opacity: pressed ? 0.7 : 1 })}
                                >
                                  <Text style={{ color: reminder === opt ? theme.colors.accent : theme.colors.text, fontWeight: "800", fontSize: s(12) }}>{reminderLabel(opt)}</Text>
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    {/* ── Location ── */}
                    <SmartLocationInput
                      theme={theme}
                      text={location}
                      place={locationPlace}
                      onTextChange={(txt) => {
                        setLocation(txt);
                        setLocationPlace(null);
                      }}
                      onPlaceSelected={(txt, p) => {
                        setLocation(txt);
                        setLocationPlace(p);
                      }}
                    />

                    {/* ── Add people ── */}
                    {friends && friends.length > 0 && (
                      <View style={{ borderRadius: s(18), borderWidth: s(1), borderColor: theme.colors.border, backgroundColor: theme.colors.card, padding: s(12) }}>
                        <Pressable
                          onPress={() => { setFriendPickerOpen((v) => !v); setFriendSearch(""); }}
                          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: s(10), opacity: pressed ? 0.75 : 1 })}
                        >
                          <View style={{ width: s(32), height: s(32), borderRadius: s(12), alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border }}>
                            <Ionicons name="people-outline" size={s(16)} color={invitees.size > 0 ? theme.colors.accent : theme.colors.muted} />
                          </View>
                          {invitees.size === 0 ? (
                            <Text style={{ flex: 1, color: theme.colors.muted, fontWeight: "700", fontSize: s(13) }}>Add people</Text>
                          ) : (
                            <Text style={{ flex: 1, color: theme.colors.accent, fontWeight: "800", fontSize: s(13) }} numberOfLines={1}>
                              {[...invitees].map((uid) => friends.find((f) => f.uid === uid)?.displayName ?? uid).join(", ")}
                            </Text>
                          )}
                          <Ionicons name={friendPickerOpen ? "chevron-up" : "chevron-down"} size={s(14)} color={theme.colors.muted} />
                        </Pressable>

                        {friendPickerOpen && (
                          <View style={{ marginTop: s(8) }}>
                            <View style={{ flexDirection: "row", alignItems: "center", borderRadius: s(10), borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 ?? "rgba(255,255,255,0.06)", paddingHorizontal: s(10), marginBottom: s(4), gap: s(8) }}>
                              <Ionicons name="search" size={s(14)} color={theme.colors.muted} />
                              <TextInput
                                value={friendSearch}
                                onChangeText={setFriendSearch}
                                placeholder="Search friends…"
                                placeholderTextColor={theme.colors.muted}
                                autoCorrect={false}
                                autoCapitalize="none"
                                style={{ flex: 1, color: theme.colors.text, fontWeight: "700", fontSize: s(13), paddingVertical: s(7) }}
                              />
                              {!!friendSearch && (
                                <Pressable onPress={() => setFriendSearch("")} hitSlop={s(8)}>
                                  <Ionicons name="close-circle" size={s(14)} color={theme.colors.muted} />
                                </Pressable>
                              )}
                            </View>
                            {friends
                              .filter((f) => {
                                const q = friendSearch.toLowerCase();
                                return !q || f.displayName.toLowerCase().includes(q) || f.friendTag.toLowerCase().includes(q);
                              })
                              .slice(0, 3)
                              .map((f) => {
                                const isSel = invitees.has(f.uid);
                                return (
                                  <Pressable
                                    key={f.uid}
                                    onPress={() => { setInvitees((prev) => { const n = new Set(prev); isSel ? n.delete(f.uid) : n.add(f.uid); return n; }); setFriendSearch(""); }}
                                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", paddingVertical: s(8), gap: s(10), opacity: pressed ? 0.7 : 1 })}
                                  >
                                    <View style={{ width: s(30), height: s(30), borderRadius: s(15), backgroundColor: isSel ? theme.colors.accent : (theme.colors.surface2 ?? "rgba(255,255,255,0.06)"), alignItems: "center", justifyContent: "center", borderWidth: isSel ? 0 : StyleSheet.hairlineWidth, borderColor: theme.colors.border }}>
                                      <Text style={{ color: isSel ? "#fff" : theme.colors.text, fontWeight: "900", fontSize: s(12) }}>{f.displayName.charAt(0).toUpperCase()}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <Text style={{ fontSize: s(13), fontWeight: "800", color: theme.colors.text }} numberOfLines={1}>{f.displayName}</Text>
                                      <Text style={{ fontSize: s(10), color: theme.colors.muted }}>#{f.friendTag}</Text>
                                    </View>
                                    {isSel && <Ionicons name="checkmark-circle" size={s(16)} color={theme.colors.accent} />}
                                  </Pressable>
                                );
                              })}
                            {friendSearch.length > 0 && friends.filter((f) => { const q = friendSearch.toLowerCase(); return f.displayName.toLowerCase().includes(q) || f.friendTag.toLowerCase().includes(q); }).length === 0 && (
                              <Text style={{ color: theme.colors.muted, fontSize: s(12), fontWeight: "700", paddingVertical: s(6) }}>No friends match "{friendSearch}"</Text>
                            )}
                          </View>
                        )}
                      </View>
                    )}

                    {/* ── Participant management (creator of shared event) ── */}
                    {isCreatorOfShared && sharedEventData!.participants.length > 0 && (
                      <View style={{ borderRadius: s(18), borderWidth: s(1), borderColor: theme.colors.border, backgroundColor: theme.colors.card, padding: s(12) }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: s(8) }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}>
                            <View style={{ width: s(32), height: s(32), borderRadius: s(12), alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border }}>
                              <Ionicons name="people-outline" size={s(16)} color={theme.colors.muted} />
                            </View>
                            <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: s(13) }}>Participants</Text>
                          </View>
                          <Pressable
                            onPress={() => onToggleHideParticipants?.(!sharedEventData!.hideParticipants)}
                            style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
                          >
                            <Text style={{ color: theme.colors.muted, fontSize: s(12), fontWeight: "700" }}>
                              {sharedEventData!.hideParticipants ? "Hidden from guests" : "Visible to guests"}
                            </Text>
                            <Ionicons
                              name={sharedEventData!.hideParticipants ? "eye-off-outline" : "eye-outline"}
                              size={s(16)}
                              color={theme.colors.muted}
                            />
                          </Pressable>
                        </View>
                        {sharedEventData!.participants.map((p) => (
                          <View key={p.uid} style={{ flexDirection: "row", alignItems: "center", paddingVertical: s(6), gap: s(10) }}>
                            <View style={{ width: s(30), height: s(30), borderRadius: s(15), backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(12) }}>{p.displayName.charAt(0).toUpperCase()}</Text>
                            </View>
                            <Text style={{ flex: 1, color: theme.colors.text, fontWeight: "700", fontSize: s(13) }}>{p.displayName}</Text>
                            {p.uid === sharedEventData!.creator_id ? (
                              <View style={{ paddingHorizontal: s(8), paddingVertical: s(2), borderRadius: s(999), backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border }}>
                                <Text style={{ color: theme.colors.muted, fontSize: s(11), fontWeight: "800" }}>Host</Text>
                              </View>
                            ) : (
                              <Pressable
                                onPress={() => {
                                  Alert.alert("Remove participant?", `Remove ${p.displayName} from this event?`, [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Remove", style: "destructive", onPress: () => onKickParticipant?.(p.uid) },
                                  ]);
                                }}
                                hitSlop={s(8)}
                                style={{ padding: s(4) }}
                              >
                                <Ionicons name="remove-circle-outline" size={s(20)} color="#FF3B30" />
                              </Pressable>
                            )}
                          </View>
                        ))}
                      </View>
                    )}

                    {/* ── Color ── */}
                    <ColorSection theme={theme} color={color} setColor={setColor} expanded={colorExpanded} onToggleExpanded={() => setColorExpanded((v) => !v)} />

                    {/* ── Description ── */}
                    <View
                      onLayout={(e) => { notesY.current = e.nativeEvent.layout.y; }}
                      style={{ borderRadius: s(18), borderWidth: s(1), borderColor: theme.colors.border, backgroundColor: theme.colors.card, paddingHorizontal: s(12), paddingVertical: s(11), flexDirection: "row", alignItems: "flex-start" }}
                    >
                      <View style={{ width: s(32), height: s(32), borderRadius: s(12), alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border, marginRight: s(10), marginTop: s(1) }}>
                        <Ionicons name="document-text-outline" size={s(16)} color={theme.colors.muted} />
                      </View>
                      <TextInput
                        ref={notesRef}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Add description"
                        placeholderTextColor={theme.colors.muted}
                        multiline
                        returnKeyType="default"
                        onFocus={() => {
                          setTimeout(() => {
                            scrollViewRef.current?.scrollTo({ y: notesY.current - s(12), animated: true });
                          }, 50);
                        }}
                        style={{ flex: 1, color: theme.colors.text, fontWeight: "700", fontSize: s(13), minHeight: s(38), textAlignVertical: "top", paddingTop: s(7) }}
                      />
                    </View>
                  </View>
                )}
              </>
            ) : (
              <>
                <RowCard theme={theme} icon="calendar-outline" title="Date"
                  right={<Pill theme={theme} text={stripYear(bdayDate)} onPress={() => setDatePicker({ kind: "bday" })} rightIcon="chevron-down" />}
                />
                <RowCard theme={theme} icon="calendar-outline" title="Birth year"
                  right={<Pill theme={theme} text={String(birthYear)} onPress={() => setYearPicker(true)} rightIcon="chevron-down" />}
                />
                <Pressable
                  onPress={() => setReminderOpen((v) => !v)}
                  style={{ marginTop: s(10), borderRadius: s(18), borderWidth: s(1), borderColor: theme.colors.border, backgroundColor: theme.colors.card, padding: s(12), flexDirection: "row", alignItems: "center" }}
                >
                  <View style={{ width: s(32), height: s(32), borderRadius: s(12), alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border, marginRight: s(10) }}>
                    <Ionicons name="notifications-outline" size={s(16)} color={theme.colors.muted} />
                  </View>
                  <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(13) }}>Reminder</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={{ color: theme.colors.muted, fontWeight: "700", fontSize: s(12), marginRight: s(6) }}>{birthdayReminderLabel(reminder)}</Text>
                  <Ionicons name={reminderOpen ? "chevron-up" : "chevron-down"} size={s(14)} color={theme.colors.muted} />
                </Pressable>
                {reminderOpen && (
                  <View style={{ marginTop: s(6), flexDirection: "row", flexWrap: "wrap", gap: s(6) }}>
                    {BIRTHDAY_REMINDER_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt}
                        onPress={() => { setReminder(opt); setReminderOpen(false); }}
                        style={({ pressed }) => ({ paddingVertical: s(7), paddingHorizontal: s(10), borderRadius: s(999), borderWidth: s(1), borderColor: reminder === opt ? theme.colors.accent : theme.colors.border, backgroundColor: reminder === opt ? theme.colors.accent + "22" : theme.colors.card2, opacity: pressed ? 0.7 : 1 })}
                      >
                        <Text style={{ color: reminder === opt ? theme.colors.accent : theme.colors.text, fontWeight: "800", fontSize: s(12) }}>{birthdayReminderLabel(opt)}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* sticky footer — shows Delete button when editing, Leave for shared guests */}
          <View style={{
            paddingHorizontal: s(14), paddingTop: s(10),
            borderTopWidth: s(1), borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.card,
          }}>
            {!!error && !isGuestOfShared ? (
              <Text style={{ color: theme.colors.muted, fontWeight: "800", fontSize: s(12), marginBottom: s(8) }}>{error}</Text>
            ) : (
              <View style={{ height: isGuestOfShared ? s(0) : s(16) }} />
            )}

            {/* Guest of shared event: Leave event button */}
            {isGuestOfShared && (
              <Pressable
                onPress={() => {
                  Alert.alert("Leave event?", "You will be removed from this event.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Leave", style: "destructive", onPress: onLeaveSharedEvent },
                  ]);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: s(6),
                  paddingVertical: s(11),
                  borderRadius: s(16),
                  borderWidth: s(1),
                  borderColor: "#FF3B3033",
                  backgroundColor: "#FF3B3012",
                  marginBottom: s(10),
                }}
              >
                <Ionicons name="exit-outline" size={s(16)} color="#FF3B30" />
                <Text style={{ color: "#FF3B30", fontWeight: "900", fontSize: s(14) }}>
                  Leave event
                </Text>
              </Pressable>
            )}

            {/* Delete row — only shown when editing an existing non-shared event, or creator of shared */}
            {!!editingEvent && !!onDeleteEvent && !isGuestOfShared && (
              <Pressable
                onPress={handleDelete}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: s(6),
                  paddingVertical: s(11),
                  borderRadius: s(16),
                  borderWidth: s(1),
                  borderColor: "#FF3B3033",
                  backgroundColor: "#FF3B3012",
                  marginBottom: s(10),
                }}
              >
                <Ionicons name="trash-outline" size={s(16)} color="#FF3B30" />
                <Text style={{ color: "#FF3B30", fontWeight: "900", fontSize: s(14) }}>
                  Delete event
                </Text>
              </Pressable>
            )}

            <View style={{ flexDirection: "row", gap: s(10) }}>
              <Pressable
                onPress={onClose}
                style={{
                  flex: 1, paddingVertical: s(12), borderRadius: s(16),
                  backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(14) }}>
                  {isGuestOfShared ? "Close" : "Cancel"}
                </Text>
              </Pressable>

              {!isGuestOfShared && (
                <Pressable
                  onPress={save}
                  disabled={!canSave}
                  style={{
                    flex: 1.2, paddingVertical: s(12), borderRadius: s(16),
                    backgroundColor: theme.colors.accent, alignItems: "center",
                    opacity: canSave ? 1 : 0.5,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: s(14) }}>Save</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Date picker overlay */}
          <OverlayModal visible={!!datePicker} theme={theme} title="Select date"
            onClose={() => setDatePicker(null)} footerRightLabel="Done" onFooterRight={() => setDatePicker(null)}
          >
            <MiniCalendar
              theme={theme}
              value={datePicker?.kind === "start" ? startDate : datePicker?.kind === "end" ? endDate : bdayDate}
              onChange={(ymd) => {
                if (datePicker?.kind === "start") {
                  setStartDate(ymd);
                  setEndDate(ymd);
                } else if (datePicker?.kind === "bday") {
                  setBdayDate(ymd);
                }
              }}
            />
          </OverlayModal>

          {/* Time picker overlay */}
          <OverlayModal visible={!!timePicker} theme={theme} title="Select time"
            onClose={() => setTimePicker(null)} footerRightLabel="Done" onFooterRight={() => setTimePicker(null)}
          >
            <TimeWheel
              theme={theme}
              value={timePicker?.kind === "start" ? startTime : endTime}
              onChange={(hm) => {
                if (timePicker?.kind === "start") {
                  setStartTime(hm);
                  if (startDate === endDate && endTime <= hm) {
                    const { h12, mm, ap } = hmTo12(hm);
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
          <OverlayModal visible={yearPicker} theme={theme} title="Select birth year"
            onClose={() => setYearPicker(false)} footerRightLabel="Done" onFooterRight={() => setYearPicker(false)}
          >
            <YearWheel theme={theme} value={birthYear} onChange={setBirthYear} />
          </OverlayModal>

          {/* Recurrence picker overlay */}
          <OverlayModal visible={recurrencePicker} theme={theme} title="Repeat"
            onClose={() => setRecurrencePicker(false)} footerRightLabel="Done" onFooterRight={() => setRecurrencePicker(false)}
          >
            <View style={{ paddingVertical: s(10) }}>
              {(["none", "daily", "weekly", "monthly", "yearly"] as const).map((rec) => (
                <Pressable
                  key={rec}
                  onPress={() => { setRecurrence(rec); setRecurrencePicker(false); }}
                  style={({ pressed }) => ({
                    paddingVertical: s(14), paddingHorizontal: s(16),
                    backgroundColor: pressed ? theme.colors.card2 : "transparent",
                    borderRadius: s(12), flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  })}
                >
                  <Text style={{ color: theme.colors.text, fontWeight: recurrence === rec ? "900" : "700", fontSize: s(15) }}>
                    {recurrenceLabel(rec)}
                  </Text>
                  {recurrence === rec && <Ionicons name="checkmark" size={s(20)} color={theme.colors.accent} />}
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
function Segmented({ theme, value, onChange }: { theme: any; value: Mode; onChange: (m: Mode) => void }) {
  const items: { key: Mode; label: string }[] = [
    { key: "event", label: "Event" },
    { key: "birthday", label: "Birthday" },
  ];
  return (
    <View style={{ flexDirection: "row", backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border, borderRadius: s(16), padding: s(4) }}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)}
            style={{ flex: 1, paddingVertical: s(10), borderRadius: s(12), alignItems: "center", backgroundColor: active ? theme.colors.accent : "transparent" }}
          >
            <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "900", fontSize: s(13) }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RowCard({ theme, icon, title, right }: { theme: any; icon: any; title: string; right: React.ReactNode }) {
  return (
    <View style={{ marginTop: s(10), borderRadius: s(18), borderWidth: s(1), borderColor: theme.colors.border, backgroundColor: theme.colors.card, padding: s(12), flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: s(32), height: s(32), borderRadius: s(12), alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border, marginRight: s(10) }}>
        <Ionicons name={icon} size={s(16)} color={theme.colors.muted} />
      </View>
      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(13) }}>{title}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

function InputRow({ theme, icon, placeholder, value, onChangeText }: { theme: any; icon: any; placeholder: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View style={{ marginTop: s(10), borderRadius: s(18), borderWidth: s(1), borderColor: theme.colors.border, backgroundColor: theme.colors.card, padding: s(12), flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: s(32), height: s(32), borderRadius: s(12), alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border, marginRight: s(10) }}>
        <Ionicons name={icon} size={s(16)} color={theme.colors.muted} />
      </View>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.colors.muted} style={{ flex: 1, color: theme.colors.text, fontWeight: "800", fontSize: s(13) }} />
      {!!value && (
        <Pressable onPress={() => onChangeText("")} hitSlop={s(10)} style={{ marginLeft: s(10) }}>
          <Ionicons name="close" size={s(18)} color={theme.colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

function Pill({ theme, text, onPress, rightIcon, compact }: { theme: any; text: string; onPress?: () => void; rightIcon?: any; compact?: boolean }) {
  return (
    <Pressable onPress={onPress ?? (() => {})} style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", paddingVertical: compact ? s(4) : s(7), paddingHorizontal: compact ? s(8) : s(11), borderRadius: s(999), backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border }}>
      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: compact ? s(11) : s(13) }}>{text}</Text>
      {rightIcon ? (<><View style={{ width: compact ? s(4) : s(6) }} /><Ionicons name={rightIcon} size={compact ? s(12) : s(14)} color={theme.colors.muted} /></>) : null}
    </Pressable>
  );
}

function ColorSection({ theme, color, setColor, style, expanded, onToggleExpanded }: { theme: any; color: EventColorKey; setColor: (k: EventColorKey) => void; style?: object; expanded: boolean; onToggleExpanded: () => void }) {
  const activeColor = COLORS.find((c) => c.key === color);
  return (
    <View style={[{ borderRadius: s(18), borderWidth: s(1), borderColor: theme.colors.border, backgroundColor: theme.colors.card, padding: s(12) }, style]}>
      <Pressable onPress={onToggleExpanded} style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: s(32), height: s(32), borderRadius: s(12), alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border, marginRight: s(10) }}>
          <View style={{ width: s(14), height: s(14), borderRadius: s(7), backgroundColor: eventColor(theme, color) }} />
        </View>
        <Text style={{ flex: 1, color: theme.colors.text, fontWeight: "900", fontSize: s(13) }}>
          {activeColor?.label ?? "Color"}
        </Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={s(14)} color={theme.colors.muted} />
      </Pressable>
      {expanded && (
        <View style={{ marginTop: s(10), flexDirection: "row", flexWrap: "wrap" }}>
          {COLORS.map((c) => {
            const active = c.key === color;
            return (
              <Pressable key={c.key} onPress={() => { setColor(c.key); onToggleExpanded(); }}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: s(8), paddingHorizontal: s(10), borderRadius: s(999), borderWidth: s(1), borderColor: active ? theme.colors.text : theme.colors.border, backgroundColor: active ? theme.colors.card2 : theme.colors.card, marginRight: s(10), marginBottom: s(10) }}
              >
                <View style={{ width: s(14), height: s(14), borderRadius: s(7), backgroundColor: eventColor(theme, c.key) }} />
                <View style={{ width: s(8) }} />
                <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: s(12) }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function OverlayModal({ visible, theme, title, onClose, children, footerRightLabel, onFooterRight }: { visible: boolean; theme: any; title: string; onClose: () => void; children: React.ReactNode; footerRightLabel: string; onFooterRight: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.35)" }]} onPress={onClose} />
        <View style={{ position: "absolute", left: s(14), right: s(14), bottom: s(14) }}>
          <View style={{ borderRadius: s(18), borderWidth: s(1), borderColor: theme.colors.border, backgroundColor: theme.colors.card, overflow: "hidden" }}>
            <View style={{ paddingHorizontal: s(12), paddingVertical: s(10), borderBottomWidth: s(1), borderBottomColor: theme.colors.border, flexDirection: "row", alignItems: "center" }}>
              <Text style={{ flex: 1, color: theme.colors.text, fontWeight: "900", fontSize: s(14) }}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={s(10)} style={{ padding: s(6) }}>
                <Ionicons name="close" size={s(18)} color={theme.colors.muted} />
              </Pressable>
            </View>
            <View style={{ padding: s(12) }}>{children}</View>
            <View style={{ padding: s(12), borderTopWidth: s(1), borderTopColor: theme.colors.border, flexDirection: "row", justifyContent: "flex-end" }}>
              <Pressable onPress={onFooterRight} style={{ paddingVertical: s(10), paddingHorizontal: s(14), borderRadius: s(12), backgroundColor: theme.colors.accent }}>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: s(13) }}>{footerRightLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MiniCalendar({ theme, value, onChange }: { theme: any; value: YMD; onChange: (ymd: YMD) => void }) {
  const { y, m, d } = ymdParts(value);
  const [curY, setCurY] = useState(y);
  const [curM, setCurM] = useState(m);

  useEffect(() => { setCurY(y); setCurM(m); }, [y, m]);

  const dim = daysInMonth(curY, curM);
  const firstW = weekdayOf(curY, curM, 1);
  const weeks: Array<Array<number | null>> = [];
  let week: Array<number | null> = [];

  for (let i = 0; i < firstW; i++) week.push(null);
  for (let day = 1; day <= dim; day++) {
    week.push(day);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }

  const monthLabel = new Date(curY, curM - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable onPress={() => { const n = addMonths(curY, curM, -1); setCurY(n.y); setCurM(n.m); }} style={miniBtn(theme)}>
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", color: theme.colors.text, fontWeight: "900" }}>{monthLabel}</Text>
        <Pressable onPress={() => { const n = addMonths(curY, curM, 1); setCurY(n.y); setCurM(n.m); }} style={miniBtn(theme)}>
          <Ionicons name="chevron-forward" size={s(18)} color={theme.colors.text} />
        </Pressable>
      </View>
      <View style={{ marginTop: s(10), flexDirection: "row" }}>
        {weekdays.map((w, idx) => (
          <Text key={idx} style={{ flex: 1, textAlign: "center", color: theme.colors.muted, fontWeight: "900", fontSize: s(12) }}>{w}</Text>
        ))}
      </View>
      <View style={{ marginTop: s(8) }}>
        {weeks.map((wk, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: s(6) }}>
            {wk.map((day, j) => {
              const selected = day != null && curY === y && curM === m && day === d;
              return (
                <Pressable key={`${i}-${j}`} onPress={() => { if (day == null) return; onChange(toYMD(curY, curM, day)); }}
                  style={{ flex: 1, height: s(36), alignItems: "center", justifyContent: "center", borderRadius: s(999), backgroundColor: selected ? theme.colors.accent : "transparent" }}
                >
                  <Text style={{ color: selected ? "#fff" : theme.colors.text, fontWeight: "900", opacity: day == null ? 0 : 1 }}>{day ?? ""}</Text>
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
  return { width: s(34), height: s(34), borderRadius: s(12), alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: theme.colors.card2, borderWidth: s(1), borderColor: theme.colors.border };
}

function TimeWheel({ theme, value, onChange }: { theme: any; value: HM; onChange: (hm: HM) => void }) {
  const { h12: initH12, mm: initMM, ap: initAP } = hmTo12(value);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const [h12, setH12] = useState(initH12);
  const [mm, setMM] = useState(minutes.includes(initMM) ? initMM : 0);
  const [ap, setAP] = useState<"AM" | "PM">(initAP);

  useEffect(() => {
    const next = hmTo12(value);
    setH12(next.h12); setAP(next.ap);
    setMM(minutes.includes(next.mm) ? next.mm : 0);
  }, [value]);

  useEffect(() => { onChange(hmFrom12(h12, mm, ap)); }, [h12, mm, ap]);

  return (
    <View style={{ borderRadius: s(16), borderWidth: s(1), borderColor: theme.colors.border, backgroundColor: theme.colors.card2, overflow: "hidden" }}>
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
            {minutes.map((m) => (<Picker.Item key={m} label={pad2(m)} value={m} color={theme.colors.text} />))}
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
    <View style={{ flex: width, borderRightWidth: s(1), borderRightColor: theme.colors.border }}>{children}</View>
  );
}

function YearWheel({ theme, value, onChange }: { theme: any; value: number; onChange: (year: number) => void }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 120 }, (_, i) => currentYear - i);
  return (
    <View style={{ borderRadius: s(16), borderWidth: s(1), borderColor: theme.colors.border, backgroundColor: theme.colors.card2, overflow: "hidden", height: s(170) }}>
      <Picker selectedValue={value} onValueChange={(v) => onChange(v)} style={{ height: s(170) }}>
        {years.map((y) => (<Picker.Item key={y} label={String(y)} value={y} color={theme.colors.text} />))}
      </Picker>
    </View>
  );
}

function reminderLabel(r: LocalEvent["reminder"]) {
  switch (r) {
    case "none": return "None";
    case "at_time": return "At time";
    case "5min": return "5 min";
    case "10min": return "10 min";
    case "30min": return "30 min";
    case "1h": return "1 hour";
    case "2h": return "2 hours";
    case "1d": return "1 day";
    case "2d": return "2 days";
    case "3d": return "3 days";
    case "5d": return "5 days";
    case "1w": return "1 week";
    default: return String(r);
  }
}

function birthdayReminderLabel(r: LocalEvent["reminder"]) {
  switch (r) {
    case "none": return "None";
    case "at_time": return "Day of";
    case "1d": return "1 day before";
    case "3d": return "3 days before";
    case "1w": return "1 week before";
    default: return "Day of";
  }
}

function formatHM12(hm: HM) {
  const { h12, mm, ap } = hmTo12(hm);
  return `${h12}:${pad2(mm)} ${ap}`;
}

function stripYear(ymd: YMD) {
  const { m, d } = ymdParts(ymd);
  return new Date(2000, m - 1, d).toLocaleString(undefined, { month: "short", day: "numeric" });
}

function recurrenceLabel(r?: LocalEvent["recurrence"]) {
  switch (r) {
    case "none": case undefined: return "Does not repeat";
    case "daily": return "Every day";
    case "weekly": return "Every week";
    case "monthly": return "Every month";
    case "yearly": return "Every year";
    default: return "Does not repeat";
  }
}