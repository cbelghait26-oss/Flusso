// withFocusLiveActivity.js
// Expo Config Plugin — plain JavaScript so EAS Build can load it without tsc.
//
// What it does:
//   1. Adds NSSupportsLiveActivities = YES to the main app Info.plist.
//   2. Creates ios/FocusLiveActivity/ and copies the widget Swift sources.
//   3. Adds a WidgetKit extension target to the Xcode project.
//   4. Links WidgetKit.framework and SwiftUI.framework into the extension.
//   5. Embeds the .appex into the main app ("Embed Foundation Extensions").

const { withInfoPlist, withXcodeProject } = require("@expo/config-plugins");
const fs   = require("fs");
const path = require("path");

// ─────────────────────────────────────────────────────────────────────────────
const EXTENSION_NAME         = "FocusLiveActivity";
const SWIFT_VERSION          = "5.0";
const DEPLOYMENT_TARGET      = "16.1";
const WIDGET_SOURCE_FILES    = [
  "FocusActivityAttributes.swift",
  "FocusLiveActivityWidget.swift",
];

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 – Info.plist (main app)
// ─────────────────────────────────────────────────────────────────────────────

function withLiveActivityInfoPlist(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults["NSSupportsLiveActivities"] = true;
    mod.modResults["NSSupportsLiveActivitiesFrequentUpdates"] = false;
    return mod;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 – Xcode project: widget extension target
// ─────────────────────────────────────────────────────────────────────────────

function withWidgetExtensionTarget(config) {
  return withXcodeProject(config, (mod) => {
    const xcodeProject        = mod.modResults;
    const platformProjectRoot = mod.modRequest.platformProjectRoot; // …/ios
    const projectRoot         = mod.modRequest.projectRoot;

    const widgetDir = path.join(platformProjectRoot, EXTENSION_NAME);
    const sourceDir = path.join(
      projectRoot, "modules", "focus-live-activity", "widget"
    );

    // ── Create extension directory ────────────────────────────────────────────
    if (!fs.existsSync(widgetDir)) {
      fs.mkdirSync(widgetDir, { recursive: true });
    }

    // ── Copy Swift sources ───────────────────────────────────────────────────
    for (const file of WIDGET_SOURCE_FILES) {
      const src  = path.join(sourceDir, file);
      const dest = path.join(widgetDir, file);
      if (fs.existsSync(src)) fs.copyFileSync(src, dest);
    }

    // ── Write extension Info.plist ───────────────────────────────────────────
    const infoPlistPath = path.join(widgetDir, "Info.plist");
    if (!fs.existsSync(infoPlistPath)) {
      fs.writeFileSync(infoPlistPath, buildInfoPlist());
    }

    // ── Guard: don't add the target twice ─────────────────────────────────────
    // Name values in pbxproj are stored with surrounding double-quotes, e.g.
    // '"FocusLiveActivity"', so compare against both forms.
    const targets      = xcodeProject.pbxNativeTargetSection() || {};
    const alreadyAdded = Object.values(targets).some(
      (t) => t && (t.name === EXTENSION_NAME || t.name === `"${EXTENSION_NAME}"`)
    );
    if (alreadyAdded) return mod;

    // ── Bundle identifiers ───────────────────────────────────────────────────
    const appBundleId    = (config.ios && config.ios.bundleIdentifier) || "com.example.app";
    const widgetBundleId = `${appBundleId}.${EXTENSION_NAME}`;

    // ── Add extension target ─────────────────────────────────────────────────
    const target = xcodeProject.addTarget(
      EXTENSION_NAME,
      "app_extension",
      EXTENSION_NAME,
      widgetBundleId
    );

    // ── Add PBX file group ───────────────────────────────────────────────────
    // Info.plist is intentionally excluded from the group — it is referenced
    // only via the INFOPLIST_FILE build setting. Adding it here would cause
    // Xcode to process it twice and error with "duplicate output file".
    const group = xcodeProject.addPbxGroup(WIDGET_SOURCE_FILES, EXTENSION_NAME, EXTENSION_NAME);

    const mainGroupKey = xcodeProject.getFirstProject().firstProject.mainGroup;
    xcodeProject.addToPbxGroup(group.uuid, mainGroupKey);

    // ── Build phases ─────────────────────────────────────────────────────────
    // IMPORTANT: pass [] (empty) to addBuildPhase for Sources — the xcode
    // library would otherwise create a second set of PBXFileReferences for the
    // same Swift files that addPbxGroup already created, resulting in Xcode's
    // "Unexpected duplicate tasks" error (one compile task per duplicate ref).
    const sourcesPhase = xcodeProject.addBuildPhase(
      [], "PBXSourcesBuildPhase", "Sources", target.uuid
    );
    const frameworksPhase = xcodeProject.addBuildPhase(
      [], "PBXFrameworksBuildPhase", "Frameworks", target.uuid
    );
    xcodeProject.addBuildPhase(
      [], "PBXResourcesBuildPhase", "Resources", target.uuid
    );

    // Wire the group's existing file references into the Sources build phase.
    addGroupFilesToSourcesPhase(xcodeProject, sourcesPhase.uuid, group.pbxGroup);

    // ── Link WidgetKit.framework and SwiftUI.framework into the extension ────
    // Without these the extension crashes immediately on launch and Live
    // Activities will never appear on the lock screen.
    addSystemFramework(xcodeProject, frameworksPhase.uuid, "WidgetKit");
    addSystemFramework(xcodeProject, frameworksPhase.uuid, "SwiftUI");

    // ── Resolve DEVELOPMENT_TEAM ──────────────────────────────────────────────
    // Primary source: ios.appleTeamId from app.json (set before EAS injects
    // credentials, so it is always available at prebuild time).
    // Fallback: scan existing build configurations in case the team was
    // already written by another plugin or a local credentials setup.
    const configurations = xcodeProject.pbxXCBuildConfigurationSection() || {};
    let developerTeam = (config.ios && config.ios.appleTeamId) || "";
    if (!developerTeam) {
      for (const cfg of Object.values(configurations)) {
        if (
          cfg &&
          cfg.buildSettings &&
          cfg.buildSettings.DEVELOPMENT_TEAM &&
          cfg.buildSettings.PRODUCT_NAME !== `"${EXTENSION_NAME}"`
        ) {
          developerTeam = cfg.buildSettings.DEVELOPMENT_TEAM;
          break;
        }
      }
    }

    // ── Build settings per configuration ──────────────────────────────────────
    for (const cfg of Object.values(configurations)) {
      if (
        cfg &&
        cfg.buildSettings &&
        cfg.buildSettings.PRODUCT_NAME === `"${EXTENSION_NAME}"`
      ) {
        Object.assign(cfg.buildSettings, {
          SWIFT_VERSION:                SWIFT_VERSION,
          IPHONEOS_DEPLOYMENT_TARGET:   DEPLOYMENT_TARGET,
          TARGETED_DEVICE_FAMILY:       '"1,2"',
          SKIP_INSTALL:                 "YES",
          INFOPLIST_FILE:               `${EXTENSION_NAME}/Info.plist`,
          GENERATE_INFOPLIST_FILE:      "NO",
          PRODUCT_BUNDLE_IDENTIFIER:    widgetBundleId,
          CODE_SIGN_STYLE:                  "Manual",
          CODE_SIGN_IDENTITY:               '"iPhone Distribution"',
          PROVISIONING_PROFILE_SPECIFIER:   '"FocusLiveActivity AdHoc 2"',
          ...(developerTeam ? { DEVELOPMENT_TEAM: developerTeam } : {}),
        });
      }
    }

    // ── Embed the extension in the main app ──────────────────────────────────
    // Without this the .appex is never included in the main bundle and iOS
    // will never load it — Live Activities stay silent.
    embedExtensionInMainApp(xcodeProject, target, EXTENSION_NAME);

    return mod;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// addGroupFilesToSourcesPhase
// Wires PBXFileReferences that already exist in a group into a Sources build
// phase without creating duplicate references (which addBuildPhase would do
// when given file-path strings it hasn't seen before vs. refs that exist).
// ─────────────────────────────────────────────────────────────────────────────

function addGroupFilesToSourcesPhase(xcodeProject, sourcesPhaseUuid, pbxGroup) {
  const phases    = xcodeProject.hash.project.objects["PBXSourcesBuildPhase"] || {};
  const phase     = phases[sourcesPhaseUuid];
  if (!phase) return;

  const buildFiles = xcodeProject.pbxBuildFileSection() || {};

  for (const child of (pbxGroup.children || [])) {
    // Skip comment keys injected by the xcode library.
    if (!child.value || String(child.value).endsWith("_comment")) continue;

    const fileName  = child.comment || child.value;
    const bfKey     = xcodeProject.generateUuid();

    buildFiles[bfKey]               = { isa: "PBXBuildFile", fileRef: child.value, fileRef_comment: fileName };
    buildFiles[`${bfKey}_comment`]  = `${fileName} in Sources`;

    phase.files = phase.files || [];
    phase.files.push({ value: bfKey, comment: `${fileName} in Sources` });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// addSystemFramework
// Links a system framework (e.g. WidgetKit, SwiftUI) into a specific target's
// PBXFrameworksBuildPhase. Re-uses an existing PBXFileReference when one for
// the same framework already exists in the project (avoids duplicates).
// ─────────────────────────────────────────────────────────────────────────────

function addSystemFramework(xcodeProject, frameworksPhaseUuid, frameworkBaseName) {
  const frameworkFile = `${frameworkBaseName}.framework`;

  // ── Locate or create the PBXFileReference ──────────────────────────────────
  const fileRefs = xcodeProject.pbxFileReferenceSection() || {};
  let fileRefUuid = null;
  for (const [key, ref] of Object.entries(fileRefs)) {
    if (!key.endsWith("_comment") && ref && ref.name === frameworkFile) {
      fileRefUuid = key;
      break;
    }
  }

  if (!fileRefUuid) {
    fileRefUuid = xcodeProject.generateUuid();
    fileRefs[fileRefUuid] = {
      isa: "PBXFileReference",
      lastKnownFileType: "wrapper.framework",
      name: frameworkFile,
      path: `System/Library/Frameworks/${frameworkFile}`,
      sourceTree: "SDKROOT",
    };
    fileRefs[`${fileRefUuid}_comment`] = frameworkFile;

    // Add to the Frameworks group in the Xcode navigator
    const frameworksGroup = xcodeProject.pbxGroupByName("Frameworks");
    if (frameworksGroup) {
      frameworksGroup.children = frameworksGroup.children || [];
      const alreadyInGroup = frameworksGroup.children.some((c) => c.value === fileRefUuid);
      if (!alreadyInGroup) {
        frameworksGroup.children.push({ value: fileRefUuid, comment: frameworkFile });
      }
    }
  }

  // ── Create the PBXBuildFile for this target ────────────────────────────────
  const buildFileUuid = xcodeProject.generateUuid();
  const buildFiles = xcodeProject.pbxBuildFileSection() || {};
  buildFiles[buildFileUuid] = {
    isa: "PBXBuildFile",
    fileRef: fileRefUuid,
    fileRef_comment: frameworkFile,
  };
  buildFiles[`${buildFileUuid}_comment`] = `${frameworkFile} in Frameworks`;

  // ── Insert into the target's Frameworks build phase ────────────────────────
  const phases = xcodeProject.hash.project.objects["PBXFrameworksBuildPhase"] || {};
  const phase  = phases[frameworksPhaseUuid];
  if (phase) {
    phase.files = phase.files || [];
    phase.files.push({ value: buildFileUuid, comment: `${frameworkFile} in Frameworks` });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// embedExtensionInMainApp
// Adds a "Embed Foundation Extensions" PBXCopyFilesBuildPhase to the main app
// target so Xcode/EAS embeds the .appex into the app bundle at build time.
// ─────────────────────────────────────────────────────────────────────────────

function embedExtensionInMainApp(xcodeProject, extensionTarget, extensionName) {
  // ── Find the .appex product reference created by addTarget ──────────────────
  const nativeTargets   = xcodeProject.pbxNativeTargetSection() || {};
  const extNativeTarget = nativeTargets[extensionTarget.uuid];
  const appexProductRef = extNativeTarget && extNativeTarget.productReference;
  if (!appexProductRef) return;

  const buildFiles = xcodeProject.pbxBuildFileSection() || {};
  const copyPhases = xcodeProject.hash.project.objects["PBXCopyFilesBuildPhase"] || {};

  // ── Find the main application target ──────────────────────────────────────
  let mainTarget = null;
  for (const [key, t] of Object.entries(nativeTargets)) {
    if (key.endsWith("_comment") || !t) continue;
    if (t.productType === '"com.apple.product-type.application"') {
      mainTarget = t;
      break;
    }
  }
  if (!mainTarget) return;

  // ── Guard: if the appex is already referenced in ANY copy phase of the main
  //    target, skip entirely.  This makes the plugin idempotent so running
  //    expo prebuild multiple times (or having it invoked twice) doesn't result
  //    in FocusLiveActivity.appex being embedded twice, which causes Xcode's
  //    "Unexpected duplicate tasks" / "ValidateEmbeddedBinary listed twice" error.
  const mainCopyPhaseUuids = (mainTarget.buildPhases || [])
    .map((p) => (typeof p === "object" ? p.value : p))
    .filter((uuid) => copyPhases[uuid]);

  for (const phaseUuid of mainCopyPhaseUuids) {
    const phase = copyPhases[phaseUuid];
    if (!phase || !Array.isArray(phase.files)) continue;
    const alreadyEmbedded = phase.files.some((f) => {
      const bfUuid = typeof f === "object" ? f.value : f;
      const bf = buildFiles[bfUuid];
      return bf && bf.fileRef === appexProductRef;
    });
    if (alreadyEmbedded) {
      console.log(
        `[withFocusLiveActivity] ${extensionName}.appex already embedded in main target — skipping duplicate embed.`
      );
      return;
    }
  }

  // ── Build file for the embed copy phase ────────────────────────────────────
  const embedBuildFileKey = xcodeProject.generateUuid();
  buildFiles[embedBuildFileKey] = {
    isa: "PBXBuildFile",
    fileRef: appexProductRef,
    fileRef_comment: `${extensionName}.appex`,
    settings: { ATTRIBUTES: ["RemoveHeadersOnCopy"] },
  };
  buildFiles[`${embedBuildFileKey}_comment`] = `${extensionName}.appex in Embed Foundation Extensions`;

  // ── Create the PBXCopyFilesBuildPhase ──────────────────────────────────────
  // IMPORTANT: dstPath must be '""' (two quote chars) not "" (empty string).
  // The xcode library serialises a JS empty string as nothing, producing
  // `dstPath = ;` which is invalid pbxproj syntax and crashes the parser.
  const embedPhaseKey = xcodeProject.generateUuid();
  copyPhases[embedPhaseKey] = {
    isa: "PBXCopyFilesBuildPhase",
    buildActionMask: 2147483647,
    dstPath: '""',
    dstSubfolderSpec: 13,
    files: [{ value: embedBuildFileKey, comment: `${extensionName}.appex in Embed Foundation Extensions` }],
    name: '"Embed Foundation Extensions"',
    runOnlyForDeploymentPostprocessing: 0,
  };
  copyPhases[`${embedPhaseKey}_comment`] = "Embed Foundation Extensions";
  xcodeProject.hash.project.objects["PBXCopyFilesBuildPhase"] = copyPhases;

  // ── Attach the phase to the main app target ────────────────────────────────
  mainTarget.buildPhases = mainTarget.buildPhases || [];
  mainTarget.buildPhases.push({ value: embedPhaseKey, comment: "Embed Foundation Extensions" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Info.plist template for the widget extension
// ─────────────────────────────────────────────────────────────────────────────

function buildInfoPlist() {
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
// Composed export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = function withFocusLiveActivity(config) {
  config = withLiveActivityInfoPlist(config);
  config = withWidgetExtensionTarget(config);
  return config;
};
