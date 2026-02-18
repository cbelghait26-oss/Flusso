// src/navigation/AppTabs.tsx
import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  Animated,
} from "react-native";
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../../screens/Dashboard/HomeScreen";
import TasksObjectivesScreen from "../../screens/TasksObjectivesScreen";
import FocusZoneScreen from "../../screens/FocusZoneScreen";
import CalendarScreenV2 from "../../screens/CalendarScreen";
import SettingsScreen from "../../screens/SettingsScreen";
import { s } from "react-native-size-matters";
import { useTheme } from "../components/theme/theme";

type TabsParamList = {
  HomeTab: { setupData?: any } | undefined;
  TasksTab: undefined;
  FocusTab: undefined;
  CalendarTab: undefined;
  SettingsTab: undefined;
};

const Tab = createBottomTabNavigator<TabsParamList>();

// Shared ref to communicate between tab bar and touch detector
let resetTabBarTimerFn: (() => void) | null = null;

function getTabLabel(routeName: keyof TabsParamList) {
  switch (routeName) {
    case "HomeTab":
      return "Home";
    case "TasksTab":
      return "Tasks";
    case "FocusTab":
      return "Focus";
    case "CalendarTab":
      return "Calendar";
    case "SettingsTab":
      return "Account";
    default:
      return "";
  }
}

function getTabIcon(routeName: keyof TabsParamList) {
  switch (routeName) {
    case "HomeTab":
      return "home-outline";
    case "TasksTab":
      return "checkbox-outline";
    case "CalendarTab":
      return "calendar-outline";
    case "SettingsTab":
      return "person-circle-outline";
    default:
      return "ellipse-outline";
  }
}

/**
 * Custom tab bar: active tab is a clear "pill" (icon + label),
 * inactive tabs are icon-only, center Focus is a floating circular button.
 * This is the "card/view" you asked for to track where you are.
 */
function FlussoTabBar({ state, descriptors, navigation, resetTimerFn }: BottomTabBarProps & { resetTimerFn: () => void }) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: colors.shadow,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const name = route.name as keyof TabsParamList;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          // Center focus button (special)
          if (name === "FocusTab") {
            return (
              <View
                key={route.key}
                style={styles.focusSlot}
                pointerEvents="box-none"
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={
                    descriptors[route.key]?.options?.tabBarAccessibilityLabel
                  }
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={({ pressed }) => [
                    styles.focusBtn,
                    {
                      backgroundColor: colors.accent,
                      shadowColor: colors.shadow,
                      borderColor: colors.border,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <Image
                    source={require("../../assets/icon.png")}
                    style={styles.focusIcon}
                    resizeMode="contain"
                  />
                </Pressable>
              </View>
            );
          }

          // Normal tabs
          const label = getTabLabel(name);
          const iconName = getTabIcon(name) as any;

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              style={({ pressed }) => [
                styles.item,
                pressed && { opacity: 0.85 },
              ]}
            >
              {isFocused ? (
                <View
                  style={[
                    styles.activePill,
                    {
                      backgroundColor: colors.overlay,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name={iconName} size={18} color={colors.text} />
                  <Text style={[styles.activeLabel, { color: colors.text }]}>
                    {label}
                  </Text>
                </View>
              ) : (
                <View style={styles.inactiveIconWrap}>
                  <Ionicons name={iconName} size={22} color={colors.muted} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AnimatedTabBarWrapper(props: BottomTabBarProps) {
  const [isVisible, setIsVisible] = useState(true);
  const translateY = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetHideTimer = () => {
    // Clear existing timer
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    // Show tab bar if hidden
    if (!isVisible) {
      setIsVisible(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    }

    // Set new timer to hide after 5 seconds
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      Animated.timing(translateY, {
        toValue: 150,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 5000);
  };

  // Always update the global reference when this function changes
  useEffect(() => {
    resetTabBarTimerFn = resetHideTimer;
  }, [resetHideTimer]);

  useEffect(() => {
    resetHideTimer();

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [props.state.index]);

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <FlussoTabBar {...props} resetTimerFn={resetHideTimer} />
    </Animated.View>
  );
}

export default function AppTabs({ route }: any) {
  const { colors } = useTheme();

  const handleTouch = () => {
    if (resetTabBarTimerFn) {
      resetTabBarTimerFn();
    }
  };

  // Pass the setup data to all tab screens via screenOptions
  return (
    <View 
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        handleTouch();
        return false; // Don't capture the touch, let it pass through
      }}
      onMoveShouldSetResponderCapture={() => {
        handleTouch();
        return false;
      }}
    >
      <Tab.Navigator
        id="MainTabs"
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}
        tabBar={(props) => <AnimatedTabBarWrapper {...props} />}
      >
        <Tab.Screen 
          name="HomeTab" 
          component={HomeScreen}
          initialParams={{ setupData: route?.params?.setup }}
        />
        <Tab.Screen name="TasksTab" component={TasksObjectivesScreen} />
        <Tab.Screen name="FocusTab" component={FocusZoneScreen} />
        <Tab.Screen name="CalendarTab" component={CalendarScreenV2} />
        <Tab.Screen name="SettingsTab" component={SettingsScreen} />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: s(12),
    alignItems: "center",
  },

  // Tab bar "card"
  bar: {
    width: "92%",
    height: s(72),
    borderRadius: s(24),
    borderWidth: 1,
    paddingHorizontal: s(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    // shadow
    ...Platform.select({
      ios: {
        shadowOpacity: 0.18,
        shadowRadius: s(18),
        shadowOffset: { width: 0, height: s(10) },
      },
      android: {
        elevation: s(8),
      },
    }),
  },

  item: {
    flex: 1,
    height: s(64),
    alignItems: "center",
    justifyContent: "center",
  },

  inactiveIconWrap: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    alignItems: "center",
    justifyContent: "center",
  },

  // Active tab “card/view” indicator
  activePill: {
    flexDirection: "column",
    alignItems: "center",
    gap: s(4),
    paddingHorizontal: s(10),
    paddingVertical: s(6),
    borderRadius: s(12),
    borderWidth: 1,
  },
  activeLabel: {
    fontSize: 9,
    fontWeight: "800",
  },

  // Center focus slot + floating button
  focusSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  focusBtn: {
    width: s(58),
    height: s(58),
    borderRadius: s(29),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: s(22), // lifts above the bar
    borderWidth: 1,

    ...Platform.select({
      ios: {
        shadowOpacity: 0.22,
        shadowRadius: s(16),
        shadowOffset: { width: 0, height: s(10) },
      },
      android: {
        elevation: s(10),
      },
    }),
  },
  focusIcon: {
    width: s(60),
    height: s(60),
    justifyContent: "center",
    alignItems: "center",
  },
});
