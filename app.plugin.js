// app.plugin.js
const fs = require("fs");
const path = require("path");
const {
  withInfoPlist,
  withAppDelegate,
  withDangerousMod,
  withMainActivity,
} = require("@expo/config-plugins");

function getRedirectScheme(redirectUri) {
  // "flusso://spotify-auth" -> "flusso"
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
  // Ensure imports
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

  // Avoid duplicate
  if (appDelegate.includes("RNSpotifyRemoteAuth sharedInstance") && appDelegate.includes("application:openURL:options:")) {
    return appDelegate;
  }

  // Insert method before @end of AppDelegate implementation
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
  // Ensure React import for RCTLinkingManager
  if (!appDelegate.includes("import React")) {
    appDelegate = appDelegate.replace(/import UIKit\s*\n/, (m) => `${m}import React\n`);
  }

  // Avoid duplicate injection
  if (appDelegate.includes('NSClassFromString("RNSpotifyRemoteAuth")') && appDelegate.includes("RCTLinkingManager.application")) {
    return appDelegate;
  }

  const method = `
  // Spotify Auth callback - handles deep link from Spotify OAuth
  func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {

    // Try Spotify SDK handler first (dynamic call to avoid compile errors)
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

  // Insert inside AppDelegate class before the last closing brace
  const lastBrace = appDelegate.lastIndexOf("}");
  if (lastBrace === -1) return appDelegate;

  return appDelegate.slice(0, lastBrace) + method + "\n" + appDelegate.slice(lastBrace);
}

function patchSceneDelegateIfExists(iosRoot) {
  // Some projects route URLs through SceneDelegate
  const candidates = [
    path.join(iosRoot, "SceneDelegate.swift"),
  ];
  let found = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { found = p; break; }
  }
  if (!found) return;

  let src = fs.readFileSync(found, "utf8");
  if (src.includes('NSClassFromString("RNSpotifyRemoteAuth")') && src.includes("openURLContexts")) return;

  if (!src.includes("import React")) {
    src = src.replace(/import UIKit\s*\n/, (m) => `${m}import React\n`);
  }

  const handler = `
  // Spotify Auth callback (UIScene lifecycle)
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }

    if let cls: AnyObject = NSClassFromString("RNSpotifyRemoteAuth") {
      let sharedSel = NSSelectorFromString("sharedInstance")
      if cls.responds(to: sharedSel),
         let shared = cls.perform(sharedSel)?.takeUnretainedValue() as AnyObject? {

        let handleSel = NSSelectorFromString("application:openURL:options:")
        if shared.responds(to: handleSel) {
          _ = shared.perform(handleSel, with: UIApplication.shared, with: url)
        }
      }
    }
  }
`;

  const lastBrace = src.lastIndexOf("}");
  if (lastBrace === -1) return;

  src = src.slice(0, lastBrace) + handler + "\n" + src.slice(lastBrace);
  fs.writeFileSync(found, src);
}

function patchMainActivity(mainActivity) {
  // Add Intent import if missing
  if (!mainActivity.includes("import android.content.Intent")) {
    mainActivity = mainActivity.replace(
      /package .+\n/,
      (m) => `${m}\nimport android.content.Intent`
    );
  }

  // Avoid duplicate injection
  if (mainActivity.includes("onNewIntent") && mainActivity.includes("setIntent(intent)")) {
    return mainActivity;
  }

  // Add onNewIntent override for Spotify OAuth callback
  const method = `
  // Handle Spotify OAuth callback
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
  }
`;

  // Insert after onCreate method
  const insertPoint = mainActivity.indexOf("  }") + 4; // After first closing brace of onCreate
  if (insertPoint > 3) {
    mainActivity = mainActivity.slice(0, insertPoint) + method + mainActivity.slice(insertPoint);
  }

  return mainActivity;
}

module.exports = function withSpotifyRemote(config) {
  // Get redirect URI from env or use default
  const redirectUri = process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI || "flusso://spotify-auth";
  const scheme = getRedirectScheme(redirectUri) || "flusso";

  config = withInfoPlist(config, (cfg) => {
    if (scheme) cfg.modResults = addUrlSchemeToInfoPlist(cfg.modResults, scheme);
    cfg.modResults = addQueriesSchemes(cfg.modResults);
    return cfg;
  });

  config = withAppDelegate(config, (cfg) => {
    const lang = cfg.modResults.language; // "swift" or "objc"
    let contents = cfg.modResults.contents;

    contents = lang === "swift" ? patchSwift(contents) : patchObjC(contents);

    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withDangerousMod(config, [
    "ios",
    async (cfg) => {
      try {
        patchSceneDelegateIfExists(cfg.modRequest.platformProjectRoot);
      } catch {}
      return cfg;
    },
  ]);

  // Android: Patch MainActivity for Spotify deep link handling
  config = withMainActivity(config, (cfg) => {
    if (cfg.modResults.language === "java") {
      // Skip Java for now - this project uses Kotlin
      return cfg;
    }
    
    cfg.modResults.contents = patchMainActivity(cfg.modResults.contents);
    return cfg;
  });

  return config;
};
