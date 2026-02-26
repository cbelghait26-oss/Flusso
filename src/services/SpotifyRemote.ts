// src/services/SpotifyRemote.ts
import { Platform } from "react-native";
import { auth, remote, ApiScope, ApiConfig } from "react-native-spotify-remote";
import Constants from "expo-constants";

// ─── Config ────────────────────────────────────────────────────────────────
const CLIENT_ID =
  (Constants.expoConfig?.extra as any)?.spotifyClientId ??
  "f95c8effcc63427e8b98c6a92a9d0c17";

// Must match EXACTLY what is registered in the Spotify Developer Dashboard
const REDIRECT_URI = "flusso://spotify-auth/";

// Scopes needed for App Remote
const SCOPES: ApiScope[] = [
  ApiScope.AppRemoteControlScope,
  ApiScope.UserFollowReadScope,
];

// Shared native ApiConfig
const API_CONFIG: ApiConfig = {
  clientID: CLIENT_ID,
  redirectURL: REDIRECT_URI,
  tokenRefreshURL: "",   // not needed — native auth returns the token directly
  tokenSwapURL: "",      // not needed — native auth returns the token directly
  scopes: SCOPES,
};

// ─── State ─────────────────────────────────────────────────────────────────
let _isConnected = false;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Authorize with Spotify using the native App Remote SDK.
 * This opens the Spotify app (or a web fallback) and returns an access token.
 * No PKCE, no backend, no expo-auth-session involved.
 */
export async function spotifyAuthorize(): Promise<string> {
  const session = await auth.authorize(API_CONFIG);
  // session.accessToken is available immediately — no code exchange needed
  if (!session?.accessToken) {
    throw new Error("Spotify authorization returned no access token");
  }
  return session.accessToken;
}

/**
 * Authorize + connect to the Spotify App Remote in one step.
 * Call this from your UI connect button.
 */
export async function spotifyConnectFull(): Promise<void> {
  const accessToken = await spotifyAuthorize();
  await remote.connect(accessToken);
  _isConnected = true;
}

/**
 * Connect to App Remote with an already-obtained access token.
 * Use this if you cached a token and want to reconnect without re-auth.
 */
export async function spotifyConnect(accessToken: string): Promise<void> {
  await remote.connect(accessToken);
  _isConnected = true;
}

/**
 * Returns the remote instance. Throws if not connected.
 */
export function spotifyRemote() {
  if (!_isConnected) throw new Error("Spotify not connected — call spotifyConnectFull() first");
  return remote;
}

/**
 * Disconnect from App Remote and clear local state.
 */
export async function spotifyDisconnect(): Promise<void> {
  _isConnected = false;
  try {
    await remote.disconnect();
  } catch {
    // Ignore — already disconnected
  }
}

/**
 * Returns true if the App Remote SDK reports an active connection.
 * Use this to restore UI state after a background/foreground cycle.
 */
export async function spotifyIsConnected(): Promise<boolean> {
  try {
    const ok = await remote.isConnectedAsync();
    _isConnected = !!ok;
    return _isConnected;
  } catch {
    _isConnected = false;
    return false;
  }
}

/** App Remote only works on physical iOS/Android devices with Spotify installed. */
export function isSpotifyInstalledHint(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}