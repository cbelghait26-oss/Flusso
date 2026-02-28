// app.plugin.js
const {
  withInfoPlist,
  withMainActivity,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function getRedirectScheme(redirectUri) {
  if (!redirectUri || typeof redirectUri !== "string") return null;
  const idx = redirectUri.indexOf("://");
  if (idx === -1) return null;
  return redirectUri.slice(0, idx);
}

function ensureArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function addUrlSchemeToInfoPlist(infoPlist, scheme) {
  const existing = ensureArray(infoPlist.CFBundleURLTypes);
  const has = existing.some((t) =>
    ensureArray(t.CFBundleURLSchemes).includes(scheme)
  );
  if (!has) {
    existing.push({
      CFBundleURLName: scheme,
      CFBundleURLSchemes: [scheme],
    });
  }
  infoPlist.CFBundleURLTypes = existing;
  return infoPlist;
}

function addQueriesSchemes(infoPlist) {
  const existing = ensureArray(infoPlist.LSApplicationQueriesSchemes);
  const required = ["spotify", "spotify-action"];
  infoPlist.LSApplicationQueriesSchemes = Array.from(
    new Set([...existing, ...required])
  );
  return infoPlist;
}

function patchMainActivity(mainActivity) {
  if (!mainActivity.includes("import android.content.Intent")) {
    mainActivity = mainActivity.replace(
      /package .+\n/,
      (m) => `${m}\nimport android.content.Intent\n`
    );
  }

  if (
    mainActivity.includes("override fun onNewIntent(intent: Intent)") &&
    mainActivity.includes("setIntent(intent)")
  ) {
    return mainActivity;
  }

  const method = `
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
  }
`;

  const onCreateEnd = mainActivity.indexOf("super.onCreate(savedInstanceState)");
  if (onCreateEnd !== -1) {
    const braceAfter = mainActivity.indexOf("}", onCreateEnd);
    if (braceAfter !== -1) {
      return (
        mainActivity.slice(0, braceAfter + 1) +
        method +
        mainActivity.slice(braceAfter + 1)
      );
    }
  }

  const lastBrace = mainActivity.lastIndexOf("}");
  if (lastBrace === -1) return mainActivity;
  return mainActivity.slice(0, lastBrace) + method + "\n" + mainActivity.slice(lastBrace);
}

function withSpotifyNativeFix(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const filePath = path.join(
        cfg.modRequest.projectRoot,
        "node_modules",
        "react-native-spotify-remote",
        "ios",
        "RNSpotifyRemoteAuth.m"
      );

      if (!fs.existsSync(filePath)) {
        console.warn("⚠️ RNSpotifyRemoteAuth.m not found, skipping patch");
        return cfg;
      }

      let contents = fs.readFileSync(filePath, "utf8");

      // Fix 1: isSpotifyInstalled always returns YES
      contents = contents.replace(
        /-(BOOL)isSpotifyInstalled\s*\{[\s\S]*?return _sessionManager != nil && _sessionManager\.spotifyAppInstalled;/,
        "-(BOOL)isSpotifyInstalled{\n    return YES;"
      );

      // Fix 2: SPTConfiguration fallback
      contents = contents.replace(
        /-(SPTConfiguration\*) configuration\{\s*\n\s*return _apiConfiguration;/,
        `-(SPTConfiguration*) configuration{\n    if(_apiConfiguration == nil){ _apiConfiguration = [SPTConfiguration configurationWithClientID:@"f95c8effcc63427e8b98c6a92a9d0c17" redirectURL:[NSURL URLWithString:@"flusso://spotify-auth/"]]; }\n    return _apiConfiguration;`
      );

      fs.writeFileSync(filePath, contents, "utf8");
      console.log("✅ RNSpotifyRemoteAuth.m patched by config plugin");
      return cfg;
    },
  ]);
}

module.exports = function withSpotifyRemote(config) {
  const redirectUri =
    process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI || "flusso://spotify-auth/";
  const scheme = getRedirectScheme(redirectUri) || "flusso";

  // iOS: register URL scheme + whitelist spotify:// for canOpenURL
  config = withInfoPlist(config, (cfg) => {
    if (scheme) cfg.modResults = addUrlSchemeToInfoPlist(cfg.modResults, scheme);
    cfg.modResults = addQueriesSchemes(cfg.modResults);
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
    };
    return cfg;
  });

  // Patch RNSpotifyRemoteAuth.m directly via config plugin
  config = withSpotifyNativeFix(config);

  // Android: handle OAuth callback delivery
  config = withMainActivity(config, (cfg) => {
    if (cfg.modResults.language === "java") return cfg;
    cfg.modResults.contents = patchMainActivity(cfg.modResults.contents);
    return cfg;
  });

  return config;
};