// plugins/withFixDuplicateTasks.js
//
// Xcode 14+ build system flags "Unexpected duplicate tasks" when the same
// shell script build phase name appears more than once inside a single target,
// or when two phases share the same implicit output path.
//
// Known offenders in this project:
//   • "[CP-User] [Hermes] Replace Hermes for the right configuration, if needed"
//     in target `hermes-engine` (Pods project – fixed via post_install hook)
//   • "[Expo Dev Launcher] Strip Local Network Keys for Release"
//     in target `Flusso` (main project – fixed via withXcodeProject)
//
// The ios/ directory is generated at build time so we cannot patch it directly;
// everything is wired through @expo/config-plugins so it survives `expo prebuild`.

const { withXcodeProject, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

// ─── 1. Deduplicate script phases in the main .xcodeproj ────────────────────
function withDeduplicateMainProjectScripts(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;

    // xcode npm package stores script phases here
    const scriptPhases =
      project.hash.project.objects["PBXShellScriptBuildPhase"] || {};

    const nativeTargets = project.pbxNativeTargetSection() || {};

    for (const [, target] of Object.entries(nativeTargets)) {
      if (
        typeof target !== "object" ||
        !target ||
        !Array.isArray(target.buildPhases)
      ) {
        continue;
      }

      const seenNames = new Set();

      target.buildPhases = target.buildPhases.filter((phaseRef) => {
        const uuid =
          typeof phaseRef === "object" ? phaseRef.value : phaseRef;

        const phase = scriptPhases[uuid];
        if (!phase || typeof phase !== "object") {
          // Not a script phase (or a comment entry) – always keep
          return true;
        }

        // Phase names in pbxproj are stored with surrounding double-quotes,
        // e.g. '"[Expo Dev Launcher] Strip Local Network Keys for Release"'
        const rawName = phase.name || "";
        const name = rawName.replace(/^"|"$/g, "");

        if (seenNames.has(name)) {
          console.log(
            `[withFixDuplicateTasks] Removed duplicate script phase in main project: "${name}"`
          );
          return false;
        }

        seenNames.add(name);
        return true;
      });
    }

    return mod;
  });
}

// ─── 2. Deduplicate script phases in the Pods project (post_install hook) ───
//
// The Pods project is created by `pod install` after prebuild, so we can't
// touch its pbxproj directly.  A Podfile post_install hook runs before Xcode
// sees the project and lets us remove the extra phases via xcodeproj Ruby API.
function withDeduplicatePodsScripts(config) {
  return withDangerousMod(config, [
    "ios",
    (mod) => {
      const podfilePath = path.join(
        mod.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfile = fs.readFileSync(podfilePath, "utf-8");

      // Ruby snippet – inserted at the top of the existing post_install block
      // (or in a new one if none exists yet).
      const rubySnippet = [
        "  # [withFixDuplicateTasks] Deduplicate shell script phases to fix",
        "  # Xcode 'Unexpected duplicate tasks' build error.",
        "  installer.pods_project.targets.each do |target|",
        "    seen_phase_names = {}",
        "    duplicate_phases  = []",
        "    target.build_phases.each do |phase|",
        "      next unless phase.is_a?(Xcodeproj::Project::Object::PBXShellScriptBuildPhase)",
        "      key = phase.name.to_s",
        "      if seen_phase_names.key?(key)",
        "        duplicate_phases << phase",
        "      else",
        "        seen_phase_names[key] = true",
        "      end",
        "    end",
        "    duplicate_phases.each { |p| target.build_phases.delete(p) }",
        "  end",
      ].join("\n");

      if (podfile.includes("post_install do |installer|")) {
        // Inject at the very start of the existing block so it runs first
        podfile = podfile.replace(
          "post_install do |installer|",
          "post_install do |installer|\n" + rubySnippet
        );
      } else {
        // No existing post_install – append one
        podfile += "\npost_install do |installer|\n" + rubySnippet + "\nend\n";
      }

      fs.writeFileSync(podfilePath, podfile);
      return mod;
    },
  ]);
}

// ─── Compose ─────────────────────────────────────────────────────────────────
module.exports = function withFixDuplicateTasks(config) {
  config = withDeduplicateMainProjectScripts(config);
  config = withDeduplicatePodsScripts(config);
  return config;
};
