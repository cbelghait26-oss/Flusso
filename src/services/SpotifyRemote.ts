// src/services/SpotifyRemote.ts
import { Platform } from "react-native";
import { remote } from "react-native-spotify-remote";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";

// ─── Config ────────────────────────────────────────────────────────────────
const CLIENT_ID =
  (Constants.expoConfig?.extra as any)?.spotifyClientId ??
  "f95c8effcc63427e8b98c6a92a9d0c17";

// ⚠️ Keep client secret server-side in production.
const CLIENT_SECRET = "3aef3477d95f4aa49e65368370eb9db7";

export const REDIRECT_URI = "flusso://spotify-auth/";

const SCOPES = ["app-remote-control", "user-read-playback-state"].join(" ");

const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

// ─── State ─────────────────────────────────────────────────────────────────
let _isConnected = false;

// ─── PKCE Helpers ──────────────────────────────────────────────────────────

function base64urlEncode(input: Uint8Array): string {
  const bytes = Array.from(input);
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateCodeVerifier(): Promise<string> {
  const random = await Crypto.getRandomBytesAsync(64);
  return base64urlEncode(random);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  return digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ─── Token exchange ─────────────────────────────────────────────────────────

async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${err}`);
  }

  const json = await res.json();
  if (!json.access_token) throw new Error("No access_token in token response");
  return json.access_token as string;
}

// ─── Main connect flow ──────────────────────────────────────────────────────

/**
 * Full authorize + connect flow:
 * 1. PKCE challenge
 * 2. Spotify OAuth via WebBrowser (captures ?code= redirect)
 * 3. Token exchange
 * 4. remote.connect()
 *
 * NOTE: remote.connect() on iOS checks canOpenURL("spotify://") internally.
 * If that check fails it means LSApplicationQueriesSchemes is missing "spotify"
 * in your built Info.plist. Rebuild the dev client after any app.plugin.js change.
 */
export async function spotifyConnectFull(): Promise<void> {
  if (!CLIENT_ID) throw new Error("Missing Spotify client ID");

  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    show_dialog: "false",
  });

  const authUrl = `${AUTH_ENDPOINT}?${params.toString()}`;
  console.log("🎵 Opening Spotify OAuth:", authUrl);

  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI, {
    showInRecents: false,
  });

  console.log("🎵 WebBrowser result:", result);

  if (result.type !== "success") {
    throw new Error(
      result.type === "dismiss"
        ? "Authorization was cancelled."
        : "Authorization failed.",
    );
  }

  const url = result.url;
  const codeMatch = url.match(/[?&]code=([^&]+)/);
  if (!codeMatch?.[1]) {
    throw new Error(`No authorization code in redirect URL: ${url}`);
  }
  const code = decodeURIComponent(codeMatch[1]);

  console.log("🎵 Got auth code, exchanging for token…");
  const accessToken = await exchangeCodeForToken(code, codeVerifier);

  console.log("🎵 Got access token, connecting App Remote…");
  await remote.connect(accessToken);
  _isConnected = true;

  console.log("✅ Spotify App Remote connected!");
}

export async function spotifyConnect(accessToken: string): Promise<void> {
  await remote.connect(accessToken);
  _isConnected = true;
}

export function spotifyRemote() {
  if (!_isConnected)
    throw new Error("Spotify not connected — call spotifyConnectFull() first");
  return remote;
}

export async function spotifyDisconnect(): Promise<void> {
  _isConnected = false;
  try {
    await remote.disconnect();
  } catch {}
}

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

export function isSpotifyInstalledHint(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}