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

  // Insert methods before @end of AppDelegate implementation
  const methods = `
// Spotify OAuth callback - fan-out to both RN Linking and Spotify SDK
- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  NSLog(@"[SPOTIFY_OAUTH] openURL called: %@", url);
  
  // Both handlers must receive the URL (fan-out pattern)
  BOOL handledByRN = [RCTLinkingManager application:application openURL:url options:options];
  BOOL handledBySpotify = [[RNSpotifyRemoteAuth sharedInstance] application:application openURL:url options:options];
  
  NSLog(@"[SPOTIFY_OAUTH] Handled by RN: %d, Spotify: %d", handledByRN, handledBySpotify);
  return handledByRN || handledBySpotify;
}

// Universal Links support for Spotify OAuth
- (BOOL)application:(UIApplication *)application
continueUserActivity:(NSUserActivity *)userActivity
 restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler
{
  if ([userActivity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) {
    NSLog(@"[SPOTIFY_OAUTH] continueUserActivity: %@", userActivity.webpageURL);
  }
  
  BOOL handledByRN = [RCTLinkingManager application:application
                                  continueUserActivity:userActivity
                                    restorationHandler:restorationHandler];
  
  BOOL handledBySpotify = NO;
  if ([[RNSpotifyRemoteAuth sharedInstance] respondsToSelector:@selector(application:continueUserActivity:restorationHandler:)]) {
    handledBySpotify = [[RNSpotifyRemoteAuth sharedInstance] application:application
                                                     continueUserActivity:userActivity
                                                       restorationHandler:restorationHandler];
  }
  
  return handledByRN || handledBySpotify;
}
`;

  return appDelegate.replace(/@end\s*$/m, `${methods}\n@end`);
}

function patchSwift(appDelegate) {
  // Ensure React import for RCTLinkingManager
  if (!appDelegate.includes("import React")) {
    appDelegate = appDelegate.replace(/import UIKit\s*\n/, (m) => `${m}import React\n`);
  }

  // Avoid duplicate injection - check for our marker comment or the method signature
  if (appDelegate.includes('[SPOTIFY_OAUTH]') || 
      appDelegate.includes('func application(_ application: UIApplication, open url: URL')) {
    return appDelegate;
  }

  let methods = `
  // Spotify OAuth callback - fan-out to both RN Linking and Spotify SDK
  func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    print("[SPOTIFY_OAUTH] openURL called: \\(url)")
    
    // Both handlers must receive the URL (fan-out pattern)
    let handledByRN = RCTLinkingManager.application(application, open: url, options: options)
    var handledBySpotify = false
    
    if let cls = NSClassFromString("RNSpotifyRemoteAuth") as AnyObject? {
      let sharedSel = NSSelectorFromString("sharedInstance")
      if cls.responds(to: sharedSel),
         let shared = cls.perform(sharedSel)?.takeUnretainedValue() as AnyObject? {
        
        let handleSel = NSSelectorFromString("application:openURL:options:")
        if shared.responds(to: handleSel) {
          let res = shared.perform(handleSel, with: application, with: url)
          handledBySpotify = (res?.takeUnretainedValue() as? Bool) ?? false
        }
      }
    }
    
    print("[SPOTIFY_OAUTH] Handled by RN: \\(handledByRN), Spotify: \\(handledBySpotify)")
    return handledByRN || handledBySpotify
  }
  
  // Universal Links support for Spotify OAuth
  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    if userActivity.activityType == NSUserActivityTypeBrowsingWeb {
      print("[SPOTIFY_OAUTH] continueUserActivity: \\(userActivity.webpageURL?.absoluteString ?? \"nil\")")
    }
    
    let handledByRN = RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
    
    var handledBySpotify = false
    if let cls = NSClassFromString("RNSpotifyRemoteAuth") as AnyObject? {
      let sharedSel = NSSelectorFromString("sharedInstance")
      if cls.responds(to: sharedSel),
         let shared = cls.perform(sharedSel)?.takeUnretainedValue() as AnyObject? {
        
        let continueSel = NSSelectorFromString("application:continueUserActivity:restorationHandler:")
        if shared.responds(to: continueSel) {
          let res = shared.perform(continueSel, with: application, with: userActivity)
          handledBySpotify = (res?.takeUnretainedValue() as? Bool) ?? false
        }
      }
    }
    
    return handledByRN || handledBySpotify
  }
`;

  // Insert inside AppDelegate class before the last closing brace
  const lastBrace = appDelegate.lastIndexOf("}");
  if (lastBrace === -1) return appDelegate;

  return appDelegate.slice(0, lastBrace) + methods + "\n" + appDelegate.slice(lastBrace);
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

  const handlers = `
  // Spotify Auth callback (UIScene lifecycle) - fan-out pattern
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    print("[SPOTIFY_OAUTH] SceneDelegate openURLContexts: \\(url)")
    
    // Fan-out to both RN and Spotify
    _ = RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
    
    if let cls = NSClassFromString("RNSpotifyRemoteAuth") as AnyObject? {
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
  
  // Universal Links in SceneDelegate
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    if userActivity.activityType == NSUserActivityTypeBrowsingWeb {
      print("[SPOTIFY_OAUTH] SceneDelegate continueUserActivity: \\(userActivity.webpageURL?.absoluteString ?? \"nil\")")
    }
    
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
    
    if let cls = NSClassFromString("RNSpotifyRemoteAuth") as AnyObject? {
      let sharedSel = NSSelectorFromString("sharedInstance")
      if cls.responds(to: sharedSel),
         let shared = cls.perform(sharedSel)?.takeUnretainedValue() as AnyObject? {
        
        let continueSel = NSSelectorFromString("application:continueUserActivity:restorationHandler:")
        if shared.responds(to: continueSel) {
          _ = shared.perform(continueSel, with: UIApplication.shared, with: userActivity)
        }
      }
    }
  }
`;

  const lastBrace = src.lastIndexOf("}");
  if (lastBrace === -1) return;

  src = src.slice(0, lastBrace) + handlers + "\n" + src.slice(lastBrace);
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
