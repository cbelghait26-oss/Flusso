// screens/PaywallScreen.tsx
import React, { Component, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PurchasesPackage } from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";

import { auth } from "../src/services/firebase";
import {
  logoutRevenueCat,
  getOfferings,
  purchasePackage as rcPurchasePackage,
  restorePurchases,
  isPremiumActive,
} from "../src/services/SubscriptionService";
import { s } from "../src/ui/ts";
import { isTabletDimensions, CONTENT_MAX_WIDTH } from "../src/ui/responsive";
import type { RootStackParamList } from "../src/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Paywall">;

// ── Error boundary for RC native Paywall ─────────────────────────────────────
// Falls back gracefully in Expo Go or environments without the native module.
class RcPaywallErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { this.props.onError(); }
  render() {
    if (this.state.hasError) return null;
    return this.props.children as ReactNode;
  }
}

const TEAL        = "#2EC4B6";
const TEAL_GLOW   = "rgba(46,196,182,0.18)";
const TEAL_BORDER = "rgba(46,196,182,0.60)";
const GOLD        = "#FFB800";

const BENEFITS: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; sub: string }[] = [
  { icon: "flash",           title: "Deep Focus, on demand",       sub: "Unlimited sessions + ambient audio"         },
  { icon: "trophy",          title: "Goals that actually stick",    sub: "Objectives, tasks & progress tracking"      },
  { icon: "calendar",        title: "Your life in one place",       sub: "Events, birthdays & smart reminders"        },
  { icon: "musical-notes",   title: "Spotify, built right in",      sub: "Your playlist, synced to your flow"         },
  { icon: "people",          title: "Accountability network",       sub: "Friends, shared goals & social streaks"     },
];

export default function PaywallScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isTablet = isTabletDimensions(width, height);

  // On tablet: centred single column. On phone: full-width.
  const colWidth = isTablet ? Math.min(CONTENT_MAX_WIDTH, width - 64) : width;
  const hPad     = isTablet ? 0 : s(22);

  // Start with the custom-built fallback UI.
  // The RC native Paywall requires react-native-purchases-ui to be compiled
  // into the native dev build (pod install + rebuild). Until that build exists,
  // the RevenueCatUI.Paywall component throws "native module not found".
  // Flip this back to `false` once you have shipped a build that includes the
  // native module to get the RC-dashboard-driven paywall instead.
  const [useFallback, setUseFallback] = useState(true);

  const [annualPkg,  setAnnualPkg]  = useState<PurchasesPackage | null>(null);
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | null>(null);
  const [selected,   setSelected]   = useState<"annual" | "monthly">("annual");
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring,  setRestoring]  = useState(false);

  // Entrance animation
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    if (!useFallback) return;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [useFallback]);

  // Load offerings — only needed when falling back to the custom UI.
  // Retries up to 5 times (500 ms apart) to handle the race where RC hasn't
  // finished initialising when the paywall first mounts.
  useEffect(() => {
    if (!useFallback) return;
    let cancelled = false;
    let attempts = 0;

    const tryLoad = async () => {
      attempts++;
      try {
        const offering = await getOfferings();
        if (cancelled) return;

        if (!offering) {
          // RC not ready yet — retry up to 5 times with 600 ms gap
          if (attempts < 5) {
            setTimeout(tryLoad, 600);
          } else {
            if (!cancelled) setLoadingOfferings(false);
          }
          return;
        }

        for (const pkg of offering.availablePackages) {
          const type = pkg.packageType;
          const id   = pkg.identifier.toLowerCase();
          // Match by RC package type OR common custom identifiers
          if (type === "ANNUAL"  || id.includes("annual") || id.includes("yearly") || id.includes("year")) {
            setAnnualPkg(pkg);
          } else if (type === "MONTHLY" || id.includes("monthly") || id.includes("month")) {
            setMonthlyPkg(pkg);
          }
        }

        if (!cancelled) setLoadingOfferings(false);
      } catch (err) {
        if (!cancelled) setLoadingOfferings(false);
      }
    };

    tryLoad();

    return () => { cancelled = true; };
  }, [useFallback]);

  // ── Derived pricing strings ───────────────────────────────────────────────
  const savingsPct = (() => {
    if (!annualPkg || !monthlyPkg) return null;
    const m = monthlyPkg.product.price;
    const a = annualPkg.product.price;
    if (!m || m <= 0) return null;
    const pct = Math.round(((m * 12 - a) / (m * 12)) * 100);
    return pct > 0 ? pct : null;
  })();

  const annualPerWeek = (() => {
    if (!annualPkg) return null;
    const perWeek = annualPkg.product.price / 52;
    return `${annualPkg.product.currencyCode} ${perWeek.toFixed(2)}/week`;
  })();

  // ── Purchase ──────────────────────────────────────────────────────────────
  const handlePurchase = async () => {
    const pkg = selected === "annual" ? annualPkg : monthlyPkg;
    if (!pkg) {
      Alert.alert("Not available", "Packages could not be loaded. Please try again.");
      return;
    }
    setPurchasing(true);
    try {
      await rcPurchasePackage(pkg);
      goToApp();
    } catch (e: any) {
      if (e?.userCancelled) return;
      Alert.alert("Purchase failed", e?.message ?? "An error occurred. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await restorePurchases();
      const active = await isPremiumActive();
      if (active) {
        goToApp();
      } else {
        Alert.alert(
          "No active subscription",
          "We couldn't find a Flusso Premium subscription linked to your Apple ID."
        );
      }
    } catch {
      Alert.alert("Restore failed", "Could not restore purchases. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  // ── CTA label ─────────────────────────────────────────────────────────────
  const ctaLabel = selected === "annual"
    ? "Start My 14-Day Free Trial"
    : "Try Free for 14 Days";

  const ctaSubLabel = selected === "annual"
    ? `Then ${annualPkg?.product.priceString ?? "—"}/year — cancel anytime`
    : `Then ${monthlyPkg?.product.priceString ?? "—"}/month — cancel anytime`;

  const goToApp = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "MainTabs" }] })
    );
  }, [navigation]);

  const handleSignOut = useCallback(async () => {
    try {
      await logoutRevenueCat();
      await auth.signOut();
    } catch {}
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "SignIn" }] })
    );
  }, [navigation]);

  // ── Primary render: RevenueCat-managed native Paywall ────────────────────
  // The template + copy are fully controlled from the RC Dashboard.
  // displayCloseButton: false → hard paywall; users must subscribe to proceed.
  // RcPaywallErrorBoundary catches native-module errors and flips useFallback.
  if (!useFallback) {
    return (
      <RcPaywallErrorBoundary onError={() => setUseFallback(true)}>
        <View style={{ flex: 1, backgroundColor: "#000612" }}>
          <RevenueCatUI.Paywall
            options={{ displayCloseButton: false }}
            onPurchaseCompleted={() => goToApp()}
            onRestoreCompleted={() => goToApp()}
            onPurchaseCancelled={() => {}}
            onPurchaseError={({ error }) =>
              Alert.alert(
                "Purchase failed",
                error.message ?? "An unexpected error occurred. Please try again."
              )
            }
            onDismiss={() => {}}
          />
          {/* Sign-out escape hatch — top-left, sits above the RC paywall */}
          <TouchableOpacity
            style={[rcSignOutBtn.btn, { top: insets.top + s(10) }]}
            onPress={handleSignOut}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={s(16)} color="rgba(244,246,242,0.55)" />
            <Text style={rcSignOutBtn.label}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </RcPaywallErrorBoundary>
    );
  }

  // ── Fallback: custom-built Paywall UI ─────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Background */}
      <LinearGradient
        colors={["#000612", "#010E22", "#000A18"]}
        style={StyleSheet.absoluteFill}
      />
      {/* Teal atmospheric glow */}
      <LinearGradient
        colors={["rgba(46,196,182,0.13)", "transparent", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.45 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + s(28), paddingBottom: insets.bottom + s(32) },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Centred content column ─────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.column,
            { width: colWidth, paddingHorizontal: hPad },
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >

          {/* ── "Most popular" pill ──────────────────────────────────────── */}
          <View style={styles.popularPill}>
            <Ionicons name="flame" size={s(12)} color={GOLD} />
            <Text style={styles.popularText}>MOST POPULAR  ·  14-DAY FREE TRIAL</Text>
          </View>

          {/* ── Hero headline ─────────────────────────────────────────────── */}
          <Text style={styles.heroLine1}>Unlock everything.</Text>
          <Text style={styles.heroLine2}>Start your 14-day free trial.</Text>

          {/* ── Social proof ─────────────────────────────────────────────── */}
          <View style={styles.socialProof}>
            {["⭐","⭐","⭐","⭐","⭐"].map((s, i) => (
              <Text key={i} style={styles.star}>{s}</Text>
            ))}
            <Text style={styles.socialText}>  Loved by focused people everywhere</Text>
          </View>

          {/* ── Benefits ─────────────────────────────────────────────────── */}
          <View style={styles.benefitsCard}>
            {BENEFITS.map((b, i) => (
              <View
                key={i}
                style={[styles.benefitRow, i < BENEFITS.length - 1 && styles.benefitDivider]}
              >
                <View style={styles.benefitIconWrap}>
                  <Ionicons name={b.icon} size={s(18)} color={TEAL} />
                </View>
                <View style={styles.benefitTextWrap}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitSub}>{b.sub}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={s(18)} color={TEAL} style={{ opacity: 0.7 }} />
              </View>
            ))}
          </View>

          {/* ── Plan cards ────────────────────────────────────────────────── */}
          <Text style={styles.choosePlanLabel}>CHOOSE YOUR PLAN</Text>
          <View style={styles.plansRow}>

            {/* Annual ── recommended */}
            <Pressable
              style={[styles.planCard, selected === "annual" && styles.planCardSelected]}
              onPress={() => setSelected("annual")}
            >
              {/* Best value badge */}
              <View style={[styles.planBadge, { backgroundColor: TEAL }]}>
                <Text style={styles.planBadgeText}>
                  {savingsPct != null ? `SAVE ${savingsPct}%` : "BEST VALUE"}
                </Text>
              </View>

              <View style={styles.planRadio}>
                <View style={[styles.planRadioInner, selected === "annual" && styles.planRadioFilled]} />
              </View>

              <Text style={styles.planPeriodLabel}>Yearly</Text>

              {loadingOfferings ? (
                <ActivityIndicator size="small" color={TEAL} style={{ marginVertical: s(6) }} />
              ) : (
                <>
                  <Text style={styles.planPriceMain}>
                    {annualPkg?.product.priceString ?? "—"}
                  </Text>
                  {annualPerWeek != null && (
                    <Text style={styles.planPriceBreakdown}>
                      Only {annualPerWeek}
                    </Text>
                  )}
                </>
              )}
            </Pressable>

            {/* Monthly */}
            <Pressable
              style={[styles.planCard, selected === "monthly" && styles.planCardSelected]}
              onPress={() => setSelected("monthly")}
            >
              <View style={styles.planRadio}>
                <View style={[styles.planRadioInner, selected === "monthly" && styles.planRadioFilled]} />
              </View>

              <Text style={styles.planPeriodLabel}>Monthly</Text>

              {loadingOfferings ? (
                <ActivityIndicator size="small" color={TEAL} style={{ marginVertical: s(6) }} />
              ) : (
                <Text style={styles.planPriceMain}>
                  {monthlyPkg?.product.priceString ?? "—"}<Text style={styles.planPerMo}>/mo</Text>
                </Text>
              )}

              {savingsPct != null && !loadingOfferings && (
                <Text style={styles.planMonthlyFull}>Full price</Text>
              )}
            </Pressable>

          </View>

          {/* ── Primary CTA ───────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.ctaBtn, (purchasing || loadingOfferings) && styles.ctaBtnDisabled]}
            onPress={handlePurchase}
            activeOpacity={0.88}
            disabled={purchasing || loadingOfferings}
          >
            <LinearGradient
              colors={["#2FD9CA", "#1EB8AB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              {purchasing ? (
                <ActivityIndicator color="#001A18" size="small" />
              ) : (
                <>
                  <Text style={styles.ctaLabel}>{ctaLabel}</Text>
                  <Ionicons name="arrow-forward" size={s(18)} color="#001A18" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.ctaSub}>{ctaSubLabel}</Text>

          {/* ── Trust row ─────────────────────────────────────────────────── */}
          <View style={styles.trustRow}>
            <TrustPill icon="lock-closed-outline" label="Secure payment" />
            <TrustPill icon="refresh-outline"     label="Cancel anytime" />
            <TrustPill icon="shield-checkmark-outline" label="No hidden fees" />
          </View>

          {/* ── Restore + legal ───────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={restoring}
            activeOpacity={0.7}
          >
            {restoring
              ? <ActivityIndicator color={TEAL} size="small" />
              : <Text style={styles.restoreText}>Restore purchases</Text>
            }
          </TouchableOpacity>

          <View style={styles.legalRow}>
            <Text style={styles.legalLink}
              onPress={() => Linking.openURL("https://flussoapp.com/terms-and-conditions")}>
              Terms
            </Text>
            <Text style={styles.legalDot}>·</Text>
            <Text style={styles.legalLink}
              onPress={() => Linking.openURL("https://flussoapp.com/privacy")}>
              Privacy Policy
            </Text>
          </View>

          {/* ── Sign-out button ───────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={s(13)} color="rgba(244,246,242,0.35)" />
            <Text style={styles.signOutText}>Sign out &amp; go back</Text>
          </TouchableOpacity>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── Small helper component ────────────────────────────────────────────────────
function TrustPill({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
}) {
  return (
    <View style={trustStyles.pill}>
      <Ionicons name={icon} size={s(11)} color="rgba(244,246,242,0.45)" />
      <Text style={trustStyles.label}>{label}</Text>
    </View>
  );
}

const trustStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(4),
  },
  label: {
    fontSize: s(10),
    color: "rgba(244,246,242,0.40)",
    fontWeight: "600",
  },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000612",
  },

  scroll: {
    alignItems: "center",   // centres the column; column itself carries the width
  },

  // Content column — carries explicit width so tablet centres correctly
  column: {
    // width + paddingHorizontal are set inline from colWidth / hPad
  },

  // ── Popular pill ────────────────────────────────────────────────────────
  popularPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(255,184,0,0.12)",
    borderWidth: s(1),
    borderColor: "rgba(255,184,0,0.35)",
    borderRadius: s(20),
    paddingHorizontal: s(12),
    paddingVertical: s(5),
    gap: s(5),
    marginBottom: s(22),
  },
  popularText: {
    fontSize: s(10),
    fontWeight: "800",
    color: GOLD,
    letterSpacing: 0.8,
  },

  // ── Hero ────────────────────────────────────────────────────────────────
  heroLine1: {
    fontSize: s(34),
    fontWeight: "900",
    color: "#F4F6F2",
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: s(40),
  },
  heroLine2: {
    fontSize: s(17),
    fontWeight: "600",
    color: TEAL,
    textAlign: "center",
    letterSpacing: -0.1,
    marginTop: s(4),
    marginBottom: s(16),
  },

  // ── Social proof ────────────────────────────────────────────────────────
  socialProof: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: s(28),
  },
  star: {
    fontSize: s(12),
  },
  socialText: {
    fontSize: s(12),
    color: "rgba(244,246,242,0.45)",
    fontWeight: "500",
  },

  // ── Benefits card ───────────────────────────────────────────────────────
  benefitsCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderRadius: s(18),
    borderWidth: s(1),
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
    marginBottom: s(28),
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(16),
    paddingVertical: s(14),
    gap: s(13),
  },
  benefitDivider: {
    borderBottomWidth: s(1),
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  benefitIconWrap: {
    width: s(36),
    height: s(36),
    borderRadius: s(10),
    backgroundColor: TEAL_GLOW,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: s(14),
    fontWeight: "700",
    color: "#F4F6F2",
    marginBottom: s(2),
  },
  benefitSub: {
    fontSize: s(12),
    color: "rgba(244,246,242,0.50)",
    fontWeight: "400",
  },

  // ── Plan chooser ─────────────────────────────────────────────────────────
  choosePlanLabel: {
    fontSize: s(11),
    fontWeight: "800",
    color: "rgba(244,246,242,0.35)",
    letterSpacing: 1.2,
    marginBottom: s(12),
    alignSelf: "flex-start",
  },
  plansRow: {
    flexDirection: "row",
    width: "100%",
    gap: s(12),
    marginBottom: s(20),
  },
  planCard: {
    flex: 1,
    borderRadius: s(16),
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: s(1.5),
    borderColor: "rgba(255,255,255,0.10)",
    paddingTop: s(28),
    paddingBottom: s(16),
    paddingHorizontal: s(14),
    alignItems: "center",
    minHeight: s(130),
    position: "relative",
  },
  planCardSelected: {
    backgroundColor: "rgba(46,196,182,0.09)",
    borderColor: TEAL_BORDER,
  },

  // Badge at top of card
  planBadge: {
    position: "absolute",
    top: -s(1),
    left: -s(1),
    right: -s(1),
    borderTopLeftRadius: s(15),
    borderTopRightRadius: s(15),
    paddingVertical: s(4),
    alignItems: "center",
  },
  planBadgeText: {
    fontSize: s(10),
    fontWeight: "800",
    color: "#001A18",
    letterSpacing: 0.6,
  },

  // Radio button
  planRadio: {
    width: s(18),
    height: s(18),
    borderRadius: s(9),
    borderWidth: s(2),
    borderColor: TEAL_BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: s(8),
    alignSelf: "center",
  },
  planRadioInner: {
    width: s(9),
    height: s(9),
    borderRadius: s(5),
    backgroundColor: "transparent",
  },
  planRadioFilled: {
    backgroundColor: TEAL,
  },

  planPeriodLabel: {
    fontSize: s(12),
    fontWeight: "700",
    color: "rgba(244,246,242,0.65)",
    letterSpacing: 0.3,
    marginBottom: s(4),
    textAlign: "center",
  },
  planPriceMain: {
    fontSize: s(22),
    fontWeight: "900",
    color: "#F4F6F2",
    textAlign: "center",
  },
  planPerMo: {
    fontSize: s(13),
    fontWeight: "500",
    color: "rgba(244,246,242,0.55)",
  },
  planPriceBreakdown: {
    fontSize: s(11),
    color: TEAL,
    fontWeight: "700",
    marginTop: s(3),
    textAlign: "center",
  },
  planMonthlyFull: {
    fontSize: s(10),
    color: "rgba(244,246,242,0.30)",
    marginTop: s(4),
    fontWeight: "500",
  },

  // ── CTA ─────────────────────────────────────────────────────────────────
  ctaBtn: {
    width: "100%",
    borderRadius: s(16),
    overflow: "hidden",
    marginBottom: s(10),
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: s(4) },
    shadowOpacity: 0.35,
    shadowRadius: s(12),
    elevation: 8,
  },
  ctaBtnDisabled: {
    opacity: 0.50,
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(8),
    height: s(56),
    paddingHorizontal: s(24),
  },
  ctaLabel: {
    fontSize: s(16),
    fontWeight: "900",
    color: "#001A18",
    letterSpacing: 0.1,
  },
  ctaSub: {
    fontSize: s(12),
    color: "rgba(244,246,242,0.40)",
    textAlign: "center",
    marginBottom: s(20),
    fontWeight: "500",
  },

  // ── Trust row ────────────────────────────────────────────────────────────
  trustRow: {
    flexDirection: "row",
    alignSelf: "center",
    gap: s(16),
    marginBottom: s(20),
  },

  // ── Fine print ───────────────────────────────────────────────────────────
  finePrint: {
    fontSize: s(10),
    color: "rgba(244,246,242,0.25)",
    textAlign: "center",
    lineHeight: s(15),
    marginBottom: s(20),
    fontWeight: "400",
  },

  // ── Restore ──────────────────────────────────────────────────────────────
  restoreBtn: {
    alignSelf: "center",
    paddingVertical: s(10),
    paddingHorizontal: s(20),
    marginBottom: s(12),
    minHeight: s(36),
    alignItems: "center",
    justifyContent: "center",
  },
  restoreText: {
    fontSize: s(13),
    color: "rgba(244,246,242,0.38)",
    fontWeight: "600",
  },

  // ── Legal ────────────────────────────────────────────────────────────────
  legalRow: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: s(8),
  },
  legalLink: {
    fontSize: s(11),
    color: "rgba(244,246,242,0.28)",
    fontWeight: "500",
  },
  legalDot: {
    fontSize: s(11),
    color: "rgba(244,246,242,0.18)",
  },

  // ── Sign-out ─────────────────────────────────────────────────────────────
  signOutBtn: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: s(5),
    paddingVertical: s(12),
    paddingHorizontal: s(16),
    marginTop: s(8),
    marginBottom: s(4),
  },
  signOutText: {
    fontSize: s(12),
    color: "rgba(244,246,242,0.30)",
    fontWeight: "500",
  },
});

// ── RC native paywall overlay sign-out button ─────────────────────────────────
const rcSignOutBtn = StyleSheet.create({
  btn: {
    position: "absolute",
    left: s(16),
    flexDirection: "row",
    alignItems: "center",
    gap: s(5),
    paddingVertical: s(6),
    paddingHorizontal: s(10),
    backgroundColor: "rgba(0,6,18,0.55)",
    borderRadius: s(20),
  },
  label: {
    fontSize: s(12),
    color: "rgba(244,246,242,0.55)",
    fontWeight: "600",
  },
});
