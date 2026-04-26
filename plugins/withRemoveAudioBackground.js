// plugins/withRemoveAudioBackground.js
const { withInfoPlist } = require("@expo/config-plugins");

module.exports = function withRemoveAudioBackground(config) {
  return withInfoPlist(config, (mod) => {
    const modes = mod.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) {
      mod.modResults.UIBackgroundModes = modes.filter((m) => m !== "audio");
      if (mod.modResults.UIBackgroundModes.length === 0) {
        delete mod.modResults.UIBackgroundModes;
      }
    } else {
      delete mod.modResults.UIBackgroundModes;
    }
    console.log("[withRemoveAudioBackground] UIBackgroundModes after filter:", mod.modResults.UIBackgroundModes ?? "removed");
    return mod;
  });
};
