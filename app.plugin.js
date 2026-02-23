// app.plugin.js
const {
  withInfoPlist,
  withAppDelegate,
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
  const has = existing.some((t) => ensureArray(t.CFBundleURLSchemes).includes(scheme));
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
  const schemes = new Set(ensureArray(infoPlist.LSApplicationQueriesSchemes));
  schemes.add("spotify");
  infoPlist.LSApplicationQueriesSchemes = Array.from(schemes);
  return infoPlist;
}

function patchObjC(appDelegate) {
  // Imports
  if (!appDelegate.includes("#import <React/RCTLinkingManager.h>")) {
    appDelegate = appDelegate.replace(
      /#import "AppDelegate\.h"\s*\n/,
      (m) => `${m}#import <React/RCTLinkingManager.h>\n`
    );
  }

  if (!appDelegate.includes("#import <RNSpotifyRemote.h>")) {
    appDelegate = appDelegate.replace(
      /#import "AppDelegate\.h"\s*\n/,
      (m) => `${m}#import <RNSpotifyRemote.h>\n`
    );
  }

  // Avoid duplicates
  if (
    appDelegate.includes("RNSpotifyRemoteAuth sharedInstance") &&
    appDelegate.includes("application:openURL:options:")
  ) {
    return appDelegate;
  }

  // Insert before @end
  const method = `
- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  BOOL handledBySpotify = [[RNSpotifyRemoteAuth sharedInstance] application:application openURL:url options:options];
  if (handledBySpotify) {
    return YES;
  }

  return [RCTLinkingManager application:application openURL:url options:options];
}
`;

  return appDelegate.replace(/@end\s*$/m, `${method}\n@end`);
}

function patchSwift(appDelegate) {
  if (!appDelegate.includes("import React")) {
    appDelegate = appDelegate.replace(/import UIKit\s*\n/, (m) => `${m}import React\n`);
  }

  // Avoid duplicates
  if (
    appDelegate.includes('NSClassFromString("RNSpotifyRemoteAuth")') &&
    appDelegate.includes("RCTLinkingManager.application")
  ) {
    return appDelegate;
  }

  const method = `
  // Spotify Auth callback - handles deep link from Spotify OAuth
  func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {

    // Try Spotify handler first (dynamic call to avoid compile errors)
    if let cls: AnyObject = NSClassFromString("RNSpotifyRemoteAuth") {
      let sharedSel = NSSelectorFromString("sharedInstance")
      if cls.responds(to: sharedSel),
         let shared = cls.perform(sharedSel)?.takeUnretainedValue() as AnyObject? {

        let handleSel = NSSelectorFromString("application:openURL:options:")
        if shared.responds(to: handleSel) {
          let res = shared.perform(handleSel, with: application, with: url)?.takeUnretainedValue()
          if let handled = res as? Bool, handled { return true }
        }
      }
    }

    // Fall back to React Native Linking for other deep links
    return RCTLinkingManager.application(application, open: url, options: options)
  }
`;

  // Insert inside AppDelegate class before last }
  const lastBrace = appDelegate.lastIndexOf("}");
  if (lastBrace === -1) return appDelegate;

  return appDelegate.slice(0, lastBrace) + method + "\n" + appDelegate.slice(lastBrace);
}

function patchMainActivity(mainActivity) {
  // Add Intent import if missing
  if (!mainActivity.includes("import android.content.Intent")) {
    mainActivity = mainActivity.replace(
      /package .+\n/,
      (m) => `${m}\nimport android.content.Intent\n`
    );
  }

  // Avoid duplicate injection
  if (mainActivity.includes("override fun onNewIntent(intent: Intent)") && mainActivity.includes("setIntent(intent)")) {
    return mainActivity;
  }

  const method = `
  // Handle Spotify OAuth callback
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
  }
`;

  // Insert after onCreate block (best-effort)
  const onCreateEnd = mainActivity.indexOf("super.onCreate(savedInstanceState)");
  if (onCreateEnd !== -1) {
    const braceAfter = mainActivity.indexOf("}", onCreateEnd);
    if (braceAfter !== -1) {
      return mainActivity.slice(0, braceAfter + 1) + method + mainActivity.slice(braceAfter + 1);
    }
  }

  // Fallback: append at end of class before final }
  const lastBrace = mainActivity.lastIndexOf("}");
  if (lastBrace === -1) return mainActivity;
  return mainActivity.slice(0, lastBrace) + method + "\n" + mainActivity.slice(lastBrace);
}

module.exports = function withSpotifyRemote(config) {
  const redirectUri = process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI || "flusso://spotify-auth";
  const scheme = getRedirectScheme(redirectUri) || "flusso";

  config = withInfoPlist(config, (cfg) => {
    if (scheme) cfg.modResults = addUrlSchemeToInfoPlist(cfg.modResults, scheme);
    cfg.modResults = addQueriesSchemes(cfg.modResults);

    // Force URL callbacks through AppDelegate (avoids SceneDelegate swallowing Spotify callback)
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
    };

    return cfg;
  });

  config = withAppDelegate(config, (cfg) => {
    const lang = cfg.modResults.language; // "swift" or "objc"
    const contents = cfg.modResults.contents;

    cfg.modResults.contents = lang === "swift" ? patchSwift(contents) : patchObjC(contents);
    return cfg;
  });

  // Android: Patch MainActivity for OAuth callback delivery
  config = withMainActivity(config, (cfg) => {
    if (cfg.modResults.language === "java") return cfg; // your project uses Kotlin
    cfg.modResults.contents = patchMainActivity(cfg.modResults.contents);
    return cfg;
  });

  return config;
};