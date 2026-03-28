// withFocusLiveActivity.ts
// Expo Config Plugin — called during `expo prebuild` (or EAS Build).
//
// What it does:
//   1. Adds NSSupportsLiveActivities = YES to the main app Info.plist.
//   2. Creates an ios/FocusLiveActivity/ directory and copies widget sources.
//   3. Adds a "com.apple.widgetkit-extension" Widget Extension target to the
//      Xcode project with correct build settings and file references.
//
// Usage in app.json:
//   "plugins": [["./modules/focus-live-activity/plugin/withFocusLiveActivity"]]

import {
  ConfigPlugin,
  withInfoPlist,
  withXcodeProject,
  IOSConfig,
} from "@expo/config-plugins";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const EXTENSION_NAME = "FocusLiveActivity";
const SWIFT_VERSION = "5.0";
const DEPLOYMENT_TARGET = "16.1";

// Source files that belong to the widget extension target.
const WIDGET_SOURCE_FILES = [
  "FocusActivityAttributes.swift",
  "FocusLiveActivityWidget.swift",
];

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 – Info.plist
// ─────────────────────────────────────────────────────────────────────────────

const withLiveActivityInfoPlist: ConfigPlugin = (config) =>
  withInfoPlist(config, (mod) => {
    // Declare Live Activity support in the main target's Info.plist.
    mod.modResults["NSSupportsLiveActivities"] = true;
    // Opt out of frequent updates (we update only on state changes).
    mod.modResults["NSSupportsLiveActivitiesFrequentUpdates"] = false;
    return mod;
  });

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 – Xcode project
// ─────────────────────────────────────────────────────────────────────────────

const withWidgetExtensionTarget: ConfigPlugin = (config) =>
  withXcodeProject(config, (mod) => {
    const xcodeProject = mod.modResults;
    const platformProjectRoot = mod.modRequest.platformProjectRoot; // …/ios
    const projectRoot = mod.modRequest.projectRoot;

    const widgetDir = path.join(platformProjectRoot, EXTENSION_NAME);
    const sourceDir = path.join(
      projectRoot,
      "modules",
      "focus-live-activity",
      "widget"
    );

    // ── Create extension directory ──────────────────────────────────────────
    if (!fs.existsSync(widgetDir)) {
      fs.mkdirSync(widgetDir, { recursive: true });
    }

    // ── Copy Swift sources ───────────────────────────────────────────────────
    for (const file of WIDGET_SOURCE_FILES) {
      const src = path.join(sourceDir, file);
      const dest = path.join(widgetDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }

    // ── Write extension Info.plist ───────────────────────────────────────────
    const infoPlistPath = path.join(widgetDir, "Info.plist");
    if (!fs.existsSync(infoPlistPath)) {
      fs.writeFileSync(infoPlistPath, buildInfoPlist());
    }

    // ── Guard: don't add the target twice ───────────────────────────────────
    const targets = xcodeProject.pbxNativeTargetSection() ?? {};
    const alreadyAdded = Object.values(targets).some(
      (t: any) => t?.name === EXTENSION_NAME
    );
    if (alreadyAdded) return mod;

    // ── Resolve bundle identifier ────────────────────────────────────────────
    const appBundleId =
      config.ios?.bundleIdentifier ?? "com.example.app";
    const widgetBundleId = `${appBundleId}.${EXTENSION_NAME}`;

    // ── Add target ──────────────────────────────────────────────────────────
    const target = xcodeProject.addTarget(
      EXTENSION_NAME,
      "app_extension",
      EXTENSION_NAME,
      widgetBundleId
    );

    // ── Add file group ───────────────────────────────────────────────────────
    const allFiles = [...WIDGET_SOURCE_FILES, "Info.plist"];
    const group = xcodeProject.addPbxGroup(
      allFiles,
      EXTENSION_NAME,
      EXTENSION_NAME
    );

    // Attach group to Xcode's root main group.
    const mainGroupKey =
      xcodeProject.getFirstProject().firstProject.mainGroup;
    xcodeProject.addToPbxGroup(group.uuid, mainGroupKey);

    // ── Build phases ─────────────────────────────────────────────────────────
    xcodeProject.addBuildPhase(
      WIDGET_SOURCE_FILES,
      "PBXSourcesBuildPhase",
      "Sources",
      target.uuid
    );
    xcodeProject.addBuildPhase(
      [],
      "PBXFrameworksBuildPhase",
      "Frameworks",
      target.uuid
    );
    xcodeProject.addBuildPhase(
      ["Info.plist"],
      "PBXResourcesBuildPhase",
      "Resources",
      target.uuid
    );

    // ── Build settings ───────────────────────────────────────────────────────
    const configurations = xcodeProject.pbxXCBuildConfigurationSection() ?? {};
    for (const [, cfg] of Object.entries(configurations) as [string, any][]) {
      if (
        cfg?.buildSettings &&
        cfg.buildSettings.PRODUCT_NAME === `"${EXTENSION_NAME}"`
      ) {
        Object.assign(cfg.buildSettings, {
          SWIFT_VERSION: SWIFT_VERSION,
          IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
          TARGETED_DEVICE_FAMILY: '"1,2"',
          SKIP_INSTALL: "YES",
          INFOPLIST_FILE: `${EXTENSION_NAME}/Info.plist`,
          CODE_SIGN_ENTITLEMENTS: `${EXTENSION_NAME}/${EXTENSION_NAME}.entitlements`,
        });
      }
    }

    return mod;
  });

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildInfoPlist(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>${EXTENSION_NAME}</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
</dict>
</plist>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composed plugin export
// ─────────────────────────────────────────────────────────────────────────────

const withFocusLiveActivity: ConfigPlugin = (config) => {
  config = withLiveActivityInfoPlist(config);
  config = withWidgetExtensionTarget(config);
  return config;
};

export default withFocusLiveActivity;
