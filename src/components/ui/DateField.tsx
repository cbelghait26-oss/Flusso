// src/components/ui/DateField.tsx
import React, { useMemo, useState } from "react";
import { Pressable, Text, View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../theme/theme";
import { s } from "react-native-size-matters";

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DateField({
  label,
  value,
  onChange,
  allowClear = true,
  minDate,
}: {
  label: string;
  value: string; // YYYY-MM-DD or ""
  onChange: (v: string) => void;
  allowClear?: boolean;
  minDate?: Date;
}) {
  const { colors, radius } = useTheme();
  const [open, setOpen] = useState(false);

  const dateObj = useMemo(() => {
    if (!value) return new Date();
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [value]);

  return (
    <View>
      <Text style={{ color: colors.muted, fontWeight: "900", fontSize: s(12), letterSpacing: s(0.3) }}>{label}</Text>

      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          {
            marginTop: s(8),
            paddingHorizontal: s(14),
            paddingVertical: s(12),
            borderRadius: radius.lg,
            backgroundColor: colors.surface2,
            borderWidth: s(1),
            borderColor: colors.border,
            opacity: pressed ? 0.9 : 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          },
        ]}
      >
        <Text style={{ color: value ? colors.text : colors.muted, fontWeight: "900" }}>
          {value || "Select date"}
        </Text>
        <Ionicons name="calendar-outline" size={s(18)} color={colors.text} />
      </Pressable>

      {allowClear && value ? (
        <Pressable onPress={() => onChange("")} style={{ marginTop: s(8), alignSelf: "flex-start" }}>
          <Text style={{ color: colors.muted, fontWeight: "900" }}>Clear</Text>
        </Pressable>
      ) : null}

      {open ? (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "calendar"}
          minimumDate={minDate}
          onChange={(event, selected) => {
            if (Platform.OS !== "ios") setOpen(false);
            if (event.type === "dismissed") return;
            if (!selected) return;
            onChange(fmt(selected));
          }}
        />
      ) : null}

      {Platform.OS === "ios" && open ? (
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            marginTop: s(10),
            alignSelf: "flex-end",
            paddingHorizontal: s(12),
            paddingVertical: s(10),
            borderRadius: s(999),
            backgroundColor: colors.overlay,
            borderWidth: s(1),
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900" }}>Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
