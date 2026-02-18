import React from "react";
import { Animated, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { s } from "react-native-size-matters";

export function TopAppBar(props: {
  theme: any;

  title: string;
  subtitle?: string;

  canGoBack: boolean;
  onBack: () => void;
  onOpenDrawer: () => void;

  onToday: () => void;

  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  query: string;
  setQuery: (v: string) => void;

  searchH: Animated.AnimatedInterpolation<string | number>;
  searchOpacity: Animated.AnimatedInterpolation<string | number>;
}) {
  const {
    theme,
    title,
    subtitle,
    canGoBack,
    onBack,
    onOpenDrawer,
    onToday,
    searchOpen,
    setSearchOpen,
    query,
    setQuery,
    searchH,
    searchOpacity,
  } = props;

  return (
    <View style={{ paddingHorizontal: s(14), paddingTop: s(4), paddingBottom: s(10) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}>
        <Pressable
          onPress={canGoBack ? onBack : onOpenDrawer}
          style={{
            width: s(38),
            height: s(38),
            borderRadius: s(14),
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.card2,
            borderWidth: s(1),
            borderColor: theme.colors.border,
          }}
          hitSlop={s(10)}
        >
          <Ionicons name={canGoBack ? "chevron-back" : "menu"} size={s(20)} color={theme.colors.text} />
        </Pressable>

        <Pressable
          onPress={onToday}
          style={{
            flex: 1,
            paddingVertical: s(8),
            paddingHorizontal: s(12),
            borderRadius: s(16),
            backgroundColor: theme.colors.card,
            borderWidth: s(1),
            borderColor: theme.colors.border,
          }}
        >
          <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: s(15) }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: theme.colors.muted, fontWeight: "800", fontSize: s(12), marginTop: s(2) }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          onPress={() => {
            const next = !searchOpen;
            setSearchOpen(next);
            if (!next) setQuery("");
          }}
          style={{
            width: s(38),
            height: s(38),
            borderRadius: s(14),
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.card2,
            borderWidth: s(1),
            borderColor: theme.colors.border,
          }}
          hitSlop={s(10)}
        >
          <Ionicons name="search" size={s(18)} color={theme.colors.text} />
        </Pressable>

        <Pressable
          onPress={onOpenDrawer}
          style={{
            width: s(38),
            height: s(38),
            borderRadius: s(14),
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.card2,
            borderWidth: s(1),
            borderColor: theme.colors.border,
          }}
          hitSlop={s(10)}
        >
          <Ionicons name="options-outline" size={s(18)} color={theme.colors.text} />
        </Pressable>
      </View>

      <Animated.View style={{ height: searchH, opacity: searchOpacity, overflow: "hidden", marginTop: s(10) }}>
        <View
          style={{
            height: s(44),
            flexDirection: "row",
            alignItems: "center",
            gap: s(10),
            paddingHorizontal: s(12),
            borderRadius: s(16),
            backgroundColor: theme.colors.card2,
            borderWidth: s(1),
            borderColor: theme.colors.border,
          }}
        >
          <Ionicons name="search" size={s(16)} color={theme.colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search events, tasks, objectives"
            placeholderTextColor={theme.colors.muted}
            style={{ flex: 1, color: theme.colors.text, fontWeight: "800", fontSize: s(13) }}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!query && (
            <Pressable onPress={() => setQuery("")} hitSlop={s(10)}>
              <Ionicons name="close" size={s(18)} color={theme.colors.muted} />
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
