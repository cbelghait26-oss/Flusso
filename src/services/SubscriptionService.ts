/**
 * SubscriptionService.ts
 *
 * Single source of truth for all RevenueCat / subscription state in Flusso.
 *
 * Responsibilities:
 *  - SDK initialisation (call initRevenueCat() once at app startup)
 *  - Login / logout tied to the Flusso Firebase UID so entitlements are
 *    shared across devices, iOS and web
 *  - Fetching offerings / packages
 *  - Checking the "Flusso Pro" entitlement
 *  - Purchasing a selected package
 *  - Restoring purchases
 *  - Presenting the RevenueCat native Paywall UI
 *  - Presenting the RevenueCat Customer Center
 *
 * All subscription state is derived from live CustomerInfo / entitlement
 * checks — never from local booleans.
 */

import Purchases, {
  type PurchasesPackage,
  type CustomerInfo,
  type PurchasesOffering,
  LOG_LEVEL,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { Platform } from "react-native";

// ── Public SDK keys ──────────────────────────────────────────────────────────
const RC_IOS_KEY     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY     ?? "";
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

// ── Identifiers ──────────────────────────────────────────────────────────────
// Exported so paywall screen, route guard, and settings can reference them
// without duplicating strings.
export const RC_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "Flusso Pro";
export const RC_OFFERING_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID ?? "default";

// ── Product identifiers configured in RevenueCat / App Store Connect ─────────
export const PRODUCT_IDS = {
  monthly:       "monthly",
  yearly:        "yearly",
  lifetime:      "lifetime",
  flussoMonthly: "flusso_monthly",
  flussoYearly:  "flusso_yearly",
} as const;

// ── Internal state ────────────────────────────────────────────────────────────
let _initialized = false;

// ── Auto-initialise at module load ───────────────────────────────────────────
// Running configure() here (synchronously, before any component mounts) ensures
// getOfferings() / getCustomerInfo() never hit the "no singleton" error regardless
// of when screens mount relative to App's useEffect.
(function autoInit() {
  if (Purchases.isConfigured) {
    _initialized = true;
    return;
  }

  // Fallback to literal key if the env var didn't get embedded by Metro
  // (can happen if Metro started before .env was written).
  const iosKey     = RC_IOS_KEY     || "appl_PBQnvThPlTmWTQRMFWaMryBrIks";
  const androidKey = RC_ANDROID_KEY || "";
  const apiKey = Platform.OS === "ios" ? iosKey : androidKey;

  if (__DEV__) {
    console.log(
      `[SubscriptionService] autoInit — platform: ${Platform.OS}, ` +
      `key: ${apiKey ? apiKey.slice(0, 12) + "…" : "(empty)"}`
    );
  }

  if (!apiKey) {
    if (__DEV__) console.warn("[SubscriptionService] No RC API key — SDK not configured.");
    return;
  }

  try {
    Purchases.configure({ apiKey });
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    _initialized = true;
    if (__DEV__) console.log("[SubscriptionService] RC configured successfully.");
  } catch (e) {
    if (__DEV__) console.warn("[SubscriptionService] Purchases.configure threw:", e);
  }
})();

// ── Initialisation ────────────────────────────────────────────────────────────

/**
 * Configure the RevenueCat SDK.
 * The SDK is auto-configured at module-load time, so this is now a no-op
 * kept for backwards compatibility with existing call sites.
 */
export function initRevenueCat(): void {
  // Auto-init already ran at module load. Nothing to do.
  if (__DEV__ && !_initialized) {
    console.warn("[SubscriptionService] initRevenueCat called but RC is not configured. Check your API key in .env.");
  }
}

// ── Identity ──────────────────────────────────────────────────────────────────

/**
 * Map the RevenueCat user to the Flusso Firebase UID.
 * Call immediately after Firebase sign-in so that entitlements are shared
 * across all of the user's devices and the web app.
 */
export async function loginRevenueCat(uid: string): Promise<void> {
  if (!_initialized) return;
  try {
    await Purchases.logIn(uid);
  } catch (err) {
    if (__DEV__) console.warn("[SubscriptionService] logIn failed:", err);
  }
}

/**
 * Reset RevenueCat to an anonymous user state.
 * Call when the Flusso user signs out.
 */
export async function logoutRevenueCat(): Promise<void> {
  if (!_initialized) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    if (__DEV__) console.warn("[SubscriptionService] logOut failed:", err);
  }
}

// ── Offerings ─────────────────────────────────────────────────────────────────

/**
 * Fetch the current offering from RevenueCat.
 * Falls back to the offering whose identifier matches RC_OFFERING_ID if no
 * current offering is configured in the dashboard.
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!_initialized) {
    if (__DEV__) console.warn("[SubscriptionService] getOfferings: SDK not initialized");
    return null;
  }
  try {
    const offerings = await Purchases.getOfferings();
    if (__DEV__) {
      console.log(
        "[SubscriptionService] getOfferings raw → current:",
        offerings.current?.identifier ?? "(none)",
        "| all keys:",
        Object.keys(offerings.all)
      );
    }
    const result = offerings.current ?? offerings.all[RC_OFFERING_ID] ?? null;
    if (!result && __DEV__) {
      console.warn(
        "[SubscriptionService] getOfferings: No offering found.\n" +
        "→ RC dashboard likely has no Current Offering configured yet.\n" +
        `→ Looked for: current offering OR identifier '${RC_OFFERING_ID}'"`
      );
    }
    return result;
  } catch (err) {
    if (__DEV__) console.warn("[SubscriptionService] getOfferings failed:", err);
    return null;
  }
}

// ── Customer info & entitlement ───────────────────────────────────────────────

/**
 * Fetch the latest CustomerInfo from RevenueCat.
 * Returns null on error or when the SDK is not initialised.
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!_initialized) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    if (__DEV__) console.warn("[SubscriptionService] getCustomerInfo failed:", err);
    return null;
  }
}

/**
 * Returns true if the "Flusso Pro" entitlement is active.
 * This is the single gate used by the route guard and anywhere else
 * access control is needed — never rely on a local boolean instead.
 */
export async function isPremiumActive(): Promise<boolean> {
  const info = await getCustomerInfo();
  if (!info) return false;
  return RC_ENTITLEMENT_ID in info.entitlements.active;
}

// ── Purchasing ────────────────────────────────────────────────────────────────

/**
 * Purchase a package returned from getOfferings().
 * Throws on user cancellation or StoreKit error — calling screens handle UI.
 */
export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

// ── Restore ───────────────────────────────────────────────────────────────────

/**
 * Restore previously purchased subscriptions (required by App Store guidelines).
 * Returns updated CustomerInfo, or null on error.
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!_initialized) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (err) {
    if (__DEV__) console.warn("[SubscriptionService] restorePurchases failed:", err);
    return null;
  }
}

// ── RevenueCat Native Paywall UI ──────────────────────────────────────────────

/**
 * Present the RevenueCat-configured native paywall as a modal sheet.
 * Returns true if the user completed a purchase or restored a purchase
 * that grants the entitlement — false for cancel / error.
 *
 * Use this for upsell moments (e.g. feature gate prompts). The main paywall
 * route uses <PaywallView> inline for the hard-blocking case.
 */
export async function presentNativePaywall(): Promise<boolean> {
  if (!_initialized) return false;
  try {
    const result = await RevenueCatUI.presentPaywall();
    return (
      result === PAYWALL_RESULT.PURCHASED ||
      result === PAYWALL_RESULT.RESTORED
    );
  } catch (err) {
    if (__DEV__) console.warn("[SubscriptionService] presentPaywall failed:", err);
    return false;
  }
}

/**
 * Present the RevenueCat-configured native paywall for a specific offering.
 * Returns true if the user ends up with an active entitlement.
 */
export async function presentNativePaywallForOffering(
  offering: PurchasesOffering
): Promise<boolean> {
  if (!_initialized) return false;
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: RC_ENTITLEMENT_ID,
      offering,
    });
    return (
      result === PAYWALL_RESULT.PURCHASED ||
      result === PAYWALL_RESULT.RESTORED ||
      result === PAYWALL_RESULT.NOT_PRESENTED  // already has entitlement
    );
  } catch (err) {
    if (__DEV__) console.warn("[SubscriptionService] presentPaywallForOffering failed:", err);
    return false;
  }
}

// ── Customer Center ───────────────────────────────────────────────────────────

/**
 * Present the RevenueCat Customer Center modal.
 * Lets users manage their subscription, request refunds, contact support,
 * and see billing history — all without leaving the app.
 */
export async function presentCustomerCenter(): Promise<void> {
  if (!_initialized) return;
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch (err) {
    if (__DEV__) console.warn("[SubscriptionService] presentCustomerCenter failed:", err);
  }
}

// ── Navigation helper ─────────────────────────────────────────────────────────

/**
 * Returns the correct screen to navigate to after sign-in or setup:
 * "MainTabs" if "Flusso Pro" is active, "Paywall" otherwise.
 * Always use this instead of hard-coding "MainTabs".
 */
export async function resolveAppDestination(): Promise<"MainTabs" | "Paywall"> {
  return (await isPremiumActive()) ? "MainTabs" : "Paywall";
}

