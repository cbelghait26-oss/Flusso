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
  // IMPORTANT: merge into whatever is already present — never replace
  const existing = ensureArray(infoPlist.LSApplicationQueriesSchemes);
  const required = ["spotify", "spotify-action"];
  const merged = Array.from(new Set([...existing, ...required]));
  infoPlist.LSApplicationQueriesSchemes = merged;
  return infoPlist;
}

function patchObjC(appDelegate) {
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

  if (
    appDelegate.includes("RNSpotifyRemoteAuth sharedInstance") &&
    appDelegate.includes("application:openURL:options:")
  ) {
    return appDelegate;
  }

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

  if (
    appDelegate.includes('NSClassFromString("RNSpotifyRemoteAuth")') &&
    appDelegate.includes("RCTLinkingManager.application")
  ) {
    return appDelegate;
  }

  const method = `
  func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
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
    return RCTLinkingManager.application(application, open: url, options: options)
  }
`;

  const lastBrace = appDelegate.lastIndexOf("}");
  if (lastBrace === -1) return appDelegate;
  return appDelegate.slice(0, lastBrace) + method + "\n" + appDelegate.slice(lastBrace);
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

  config = withInfoPlist(config, (cfg) => {
    // 1. Register flusso:// as a URL scheme so the app can receive deep links
    if (scheme) cfg.modResults = addUrlSchemeToInfoPlist(cfg.modResults, scheme);

    // 2. Whitelist spotify:// so canOpenURL() works — MERGE, never replace
    cfg.modResults = addQueriesSchemes(cfg.modResults);

    // 3. Disable multi-scene so AppDelegate receives openURL (not SceneDelegate)
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
    };

    return cfg;
  });

  config = withAppDelegate(config, (cfg) => {
    const lang = cfg.modResults.language;
    const contents = cfg.modResults.contents;
    cfg.modResults.contents =
      lang === "swift" ? patchSwift(contents) : patchObjC(contents);
    return cfg;
  });

  config = withMainActivity(config, (cfg) => {
    if (cfg.modResults.language === "java") return cfg;
    cfg.modResults.contents = patchMainActivity(cfg.modResults.contents);
    return cfg;
  });

  return config;
};