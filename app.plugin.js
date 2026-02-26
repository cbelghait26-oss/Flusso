// app.plugin.js
const {
  withInfoPlist,
  withMainActivity,
} = require("@expo/config-plugins");

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

module.exports = function withSpotifyRemote(config) {
  const redirectUri =
    process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI || "flusso://spotify-auth/";
  const scheme = getRedirectScheme(redirectUri) || "flusso";

  // iOS: register URL scheme + whitelist spotify:// for canOpenURL
  config = withInfoPlist(config, (cfg) => {
    if (scheme) cfg.modResults = addUrlSchemeToInfoPlist(cfg.modResults, scheme);
    cfg.modResults = addQueriesSchemes(cfg.modResults);
    // Disable multi-scene so deep links route through AppDelegate not SceneDelegate
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
    };
    return cfg;
  });

  // NOTE: AppDelegate patching removed.
  // We use expo-web-browser (WebBrowser.openAuthSessionAsync) for OAuth which
  // handles the redirect internally — no native openURL handler needed.
  // The flusso:// scheme registered above is enough for WebBrowser to capture
  // the redirect and return it as result.url.

  // Android: handle OAuth callback delivery
  config = withMainActivity(config, (cfg) => {
    if (cfg.modResults.language === "java") return cfg;
    cfg.modResults.contents = patchMainActivity(cfg.modResults.contents);
    return cfg;
  });

  return config;
};