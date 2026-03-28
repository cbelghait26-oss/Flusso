// SmartLocationInput.tsx
// iOS-only smart location field with Apple Maps (MKLocalSearchCompleter) suggestions.
// On Android or when the native module is unavailable it degrades to a plain TextInput.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { s } from "../../ui/ts";

import type { PlaceData } from "./types";
import type { LocationSuggestion, ResolvedPlace } from "../../../modules/smart-location";
import { getSuggestions, isSmartLocationAvailable, resolvePlace } from "../../../modules/smart-location";

// ─── Public types ─────────────────────────────────────────────────────────────

export type { PlaceData };

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  theme: any;
  /** Current raw location text (controlled). */
  text: string;
  /** Structured place data if the user previously selected a suggestion. */
  place: PlaceData | null;
  /** Called on every keystroke; parent should update `text` and clear `place`. */
  onTextChange: (text: string) => void;
  /**
   * Called after the user taps a suggestion and MapKit resolves it.
   * Parent should update both `text` and `place`.
   */
  onPlaceSelected: (text: string, place: PlaceData) => void;
};

export function SmartLocationInput({
  theme,
  text,
  place,
  onTextChange,
  onPlaceSelected,
}: Props) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const isMountedRef = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the text we set via suggestion tap so we can match it when resolvePlace returns
  const pendingResolveTextRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Fetch suggestions (debounced) ────────────────────────────────────────────

  const fetchSuggestions = useCallback(async (query: string) => {
    if (Platform.OS !== "ios") return;
    const results = await getSuggestions(query);
    if (!isMountedRef.current) return;
    setLoading(false);
    setSuggestions(results);
  }, []);

  // ── Text input handler ───────────────────────────────────────────────────────

  const handleTextChange = useCallback(
    (newText: string) => {
      // Any manual edit cancels a pending suggestion resolve
      pendingResolveTextRef.current = null;
      onTextChange(newText);

      if (Platform.OS !== "ios") return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (newText.trim().length < 2) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      // Only show a spinner if the native module is actually compiled in
      if (isSmartLocationAvailable()) setLoading(true);
      debounceRef.current = setTimeout(() => fetchSuggestions(newText), 300);
    },
    [onTextChange, fetchSuggestions]
  );

  // ── Suggestion tap handler ───────────────────────────────────────────────────

  const handleSuggestionPress = useCallback(
    async (suggestion: LocationSuggestion) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSuggestions([]);
      setLoading(false);

      const displayText = suggestion.subtitle
        ? `${suggestion.title}, ${suggestion.subtitle}`
        : suggestion.title;

      // Update the text immediately (optimistic) — clears place in parent
      onTextChange(displayText);

      // Mark that we're resolving this specific text so stray callbacks are ignored
      pendingResolveTextRef.current = displayText;

      const resolved: ResolvedPlace | null = await resolvePlace(
        suggestion.title,
        suggestion.subtitle
      );

      // Only apply if the user hasn't typed something different in the meantime
      if (
        !isMountedRef.current ||
        pendingResolveTextRef.current !== displayText
      ) {
        return;
      }
      pendingResolveTextRef.current = null;

      const placeData: PlaceData = {
        name: resolved?.name ?? suggestion.title,
        address: resolved?.address,
        latitude: resolved?.latitude,
        longitude: resolved?.longitude,
      };
      onPlaceSelected(displayText, placeData);
    },
    [onTextChange, onPlaceSelected]
  );

  // ── Blur — use 150 ms delay so suggestion Pressable can fire first ────────────

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setFocused(false);
      setSuggestions([]);
      setLoading(false);
    }, 150);
  }, []);

  const showSuggestions = focused && suggestions.length > 0;
  const hasPlace = !!place;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View
      style={{
        borderRadius: s(18),
        borderWidth: s(1),
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card,
        overflow: "hidden",
      }}
    >
      {/* ── Input row ── */}
      <View
        style={{
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
          <Ionicons
            name={hasPlace ? "location" : "location-outline"}
            size={s(16)}
            color={hasPlace ? theme.colors.accent : theme.colors.muted}
          />
        </View>

        <TextInput
          value={text}
          onChangeText={handleTextChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder="Add location"
          placeholderTextColor={theme.colors.muted}
          returnKeyType="done"
          style={{
            flex: 1,
            color: theme.colors.text,
            fontWeight: "800",
            fontSize: s(13),
          }}
        />

        {loading && (
          <ActivityIndicator
            size="small"
            color={theme.colors.muted}
            style={{ marginLeft: s(8) }}
          />
        )}

        {!!text && !loading && (
          <Pressable
            onPress={() => {
              pendingResolveTextRef.current = null;
              onTextChange("");
              setSuggestions([]);
            }}
            hitSlop={s(10)}
            style={{ marginLeft: s(8) }}
          >
            <Ionicons name="close" size={s(18)} color={theme.colors.muted} />
          </Pressable>
        )}
      </View>

      {/* ── Place address badge — visible when a real address was resolved ── */}
      {hasPlace && !focused && !!place.address && (
        <View
          style={{
            marginHorizontal: s(12),
            marginTop: s(-4),
            marginBottom: s(10),
            flexDirection: "row",
            alignItems: "center",
            gap: s(4),
          }}
        >
          <Ionicons name="map-outline" size={s(11)} color={theme.colors.accent} />
          <Text
            style={{
              color: theme.colors.accent,
              fontSize: s(11),
              fontWeight: "700",
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {place.address}
          </Text>
        </View>
      )}

      {/* ── Suggestions dropdown ── */}
      {showSuggestions && (
        // ScrollView with keyboardShouldPersistTaps="handled" is required so that
        // tapping a suggestion while the keyboard is open forwards the tap instead
        // of dismissing the keyboard and swallowing the touch (default RN behavior).
        <ScrollView
          keyboardShouldPersistTaps="handled"
          scrollEnabled={false}
          style={{ borderTopWidth: s(1), borderTopColor: theme.colors.border }}
        >
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={`${suggestion.title}-${index}`}
              onPress={() => handleSuggestionPress(suggestion)}
              style={({ pressed }) => ({
                paddingVertical: s(10),
                paddingHorizontal: s(12),
                flexDirection: "row",
                alignItems: "center",
                gap: s(10),
                backgroundColor: pressed
                  ? theme.colors.card2
                  : "transparent",
                borderBottomWidth:
                  index < suggestions.length - 1 ? s(1) : 0,
                borderBottomColor: theme.colors.border,
              })}
            >
              <Ionicons
                name="location-outline"
                size={s(14)}
                color={theme.colors.muted}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontWeight: "800",
                    fontSize: s(13),
                  }}
                  numberOfLines={1}
                >
                  {suggestion.title}
                </Text>
                {!!suggestion.subtitle && (
                  <Text
                    style={{
                      color: theme.colors.muted,
                      fontSize: s(11),
                      fontWeight: "600",
                      marginTop: s(1),
                    }}
                    numberOfLines={1}
                  >
                    {suggestion.subtitle}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
