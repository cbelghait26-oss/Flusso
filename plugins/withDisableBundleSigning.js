// plugins/withDisableBundleSigning.js
//
// Xcode 14+ requires that every target it builds can be signed. Pods
// sometimes generate resource bundle targets (product type
// "com.apple.product-type.bundle") that have no signing configuration,
// causing the build to fail with a generic "resource bundle signing" error.
//
// This plugin scans for those bundle targets and sets
// CODE_SIGNING_ALLOWED = NO on their build configurations, which tells
// Xcode not to attempt signing them. All other targets (main app,
// extensions, frameworks) are left untouched.

const { withXcodeProject } = require("@expo/config-plugins");

module.exports = function withDisableBundleSigning(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;

    // ── Collect UUIDs of all build configurations belonging to bundle targets
    const bundleConfigUUIDs = new Set();

    const nativeTargets = project.pbxNativeTargetSection() || {};
    for (const targetObj of Object.values(nativeTargets)) {
      if (
        typeof targetObj !== "object" ||
        !targetObj ||
        targetObj.productType !== '"com.apple.product-type.bundle"'
      ) {
        continue;
      }

      // Each target has a buildConfigurationList key pointing to a
      // XCConfigurationList, which in turn references individual
      // XCBuildConfiguration UUIDs.
      const listUUID = targetObj.buildConfigurationList;
      if (!listUUID) continue;

      const configLists =
        project.pbxXCConfigurationList() ||
        project.hash.project.objects["XCConfigurationList"] ||
        {};

      const list = configLists[listUUID] || configLists[listUUID + "_comment"];
      if (!list || !list.buildConfigurations) continue;

      for (const entry of list.buildConfigurations) {
        const uuid = typeof entry === "object" ? entry.value : entry;
        if (uuid) bundleConfigUUIDs.add(uuid);
      }
    }

    // ── Apply CODE_SIGNING_ALLOWED = NO only to those configurations
    const allConfigs = project.pbxXCBuildConfigurationSection() || {};
    let patched = 0;

    for (const [uuid, cfg] of Object.entries(allConfigs)) {
      if (
        bundleConfigUUIDs.has(uuid) &&
        typeof cfg === "object" &&
        cfg &&
        cfg.buildSettings
      ) {
        cfg.buildSettings.CODE_SIGNING_ALLOWED = "NO";
        patched++;
      }
    }

    console.log(
      `withDisableBundleSigning: disabled signing on ${patched} resource bundle configuration(s).`
    );

    return mod;
  });
};
