// plugins/withFixDuplicateTasks.js
//
// Xcode's new build system flags "Unexpected duplicate tasks" when two script
// phases produce outputs that overlap — most commonly when a phase declares NO
// output files at all, because Xcode then assumes it could write anywhere.
//
// The fix is NOT to remove the phases but to give each offending phase a
// declared output file so the build system can distinguish them.
//
// Known offenders in this project:
//   • "[Expo Dev Launcher] Strip Local Network Keys for Release"
//     in target `Flusso` of the main project  → fixed via withXcodeProject
//   • "[CP-User] [Hermes] Replace Hermes for the right configuration, if needed"
//     in target `hermes-engine` of the Pods project → fixed via Podfile post_install
//
// ios/ is generated at build time, so everything goes through @expo/config-plugins.

const { withXcodeProject, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

// ─── constants ───────────────────────────────────────────────────────────────
const MAIN_PHASE_NAME =
  "[Expo Dev Launcher] Strip Local Network Keys for Release";
const MAIN_OUTPUT_PATH =
  "$(DERIVED_FILE_DIR)/ExpoDevLauncherStripNetworkKeys.txt";

const PODS_TARGET_NAME = "hermes-engine";
const PODS_PHASE_NAME =
  "[CP-User] [Hermes] Replace Hermes for the right configuration, if needed";
const PODS_OUTPUT_PATH = "$(DERIVED_FILE_DIR)/HermesReplacement.txt";

// ─── 1.  Main project: add output path via withXcodeProject ──────────────────
function withAddOutputToMainProjectPhase(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;

    // The xcode npm package stores PBXShellScriptBuildPhase objects here.
    // Name values include the surrounding pbxproj double-quotes, e.g.
    //   '"[Expo Dev Launcher] Strip Local Network Keys for Release"'
    const scriptPhases =
      project.hash.project.objects["PBXShellScriptBuildPhase"] || {};

    let patched = false;

    for (const [, phase] of Object.entries(scriptPhases)) {
      if (typeof phase !== "object" || !phase || !phase.name) continue;

      // Strip surrounding pbxproj quotes before comparing
      const rawName = phase.name.replace(/^"|"$/g, "");
      if (rawName !== MAIN_PHASE_NAME) continue;

      // outputPaths is an array whose string entries also carry surrounding
      // pbxproj double-quotes, e.g. '"$(DERIVED_FILE_DIR)/foo.txt"'
      if (!Array.isArray(phase.outputPaths)) {
        phase.outputPaths = [];
      }

      const quotedPath = `"${MAIN_OUTPUT_PATH}"`;
      if (!phase.outputPaths.includes(quotedPath)) {
        phase.outputPaths.push(quotedPath);
        console.log(
          `[withFixDuplicateTasks] Added output path to main-project phase: "${rawName}"`
        );
        patched = true;
      }
    }

    if (!patched) {
      console.warn(
        `[withFixDuplicateTasks] WARNING: phase "${MAIN_PHASE_NAME}" not found in main project – skipping.`
      );
    }

    return mod;
  });
}

// ─── 2.  Pods project: add output path via Podfile post_install hook ─────────
//
// pod install runs after expo prebuild so the Pods pbxproj doesn't exist yet;
// we inject a Ruby post_install snippet that uses the xcodeproj API.
function withAddOutputToPodsPhase(config) {
  return withDangerousMod(config, [
    "ios",
    (mod) => {
      const podfilePath = path.join(
        mod.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfile = fs.readFileSync(podfilePath, "utf-8");

      // Guard: don't inject twice (e.g. if prebuild is run without --clean)
      if (podfile.includes("# [withFixDuplicateTasks]")) {
        return mod;
      }

      const rubySnippet = [
        "",
        "  # [withFixDuplicateTasks] Add a declared output path to the Hermes script",
        "  # phase so Xcode's build system doesn't flag it as a duplicate task.",
        `  hermes_target = installer.pods_project.targets.find { |t| t.name == "${PODS_TARGET_NAME}" }`,
        "  if hermes_target",
        "    hermes_phase = hermes_target.build_phases.find do |phase|",
        "      phase.is_a?(Xcodeproj::Project::Object::PBXShellScriptBuildPhase) &&",
        `      phase.name == "${PODS_PHASE_NAME}"`,
        "    end",
        "    if hermes_phase",
        `      unless hermes_phase.output_paths.include?("${PODS_OUTPUT_PATH}")`,
        `        hermes_phase.output_paths = hermes_phase.output_paths + ["${PODS_OUTPUT_PATH}"]`,
        "      end",
        "    end",
        "  end",
      ].join("\n");

      if (podfile.includes("post_install do |installer|")) {
        // Append inside the existing block rather than creating a second one
        podfile = podfile.replace(
          "post_install do |installer|",
          "post_install do |installer|\n" + rubySnippet
        );
      } else {
        podfile +=
          "\npost_install do |installer|\n" + rubySnippet + "\nend\n";
      }

      fs.writeFileSync(podfilePath, podfile);
      return mod;
    },
  ]);
}

// ─── Compose ─────────────────────────────────────────────────────────────────
module.exports = function withFixDuplicateTasks(config) {
  config = withAddOutputToMainProjectPhase(config);
  config = withAddOutputToPodsPhase(config);
  return config;
};
