// src/services/appleAuth.ts  ← Android / web fallback
// Metro automatically picks appleAuth.ios.ts on iOS, so this file is ONLY
// bundled for Android and web. It never imports expo-apple-authentication,
// keeping the Android bundle free of that iOS-only native module.

export async function signInWithApple(): Promise<undefined> {
  // Apple Sign-In is not available on this platform.
  throw new Error('Apple Sign-In is only available on iOS.');
}
