// src/services/SpotifyRemote.ts
import { Linking, Platform } from "react-native";
import { remote } from "react-native-spotify-remote";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";

const CLIENT_ID =
  (Constants.expoConfig?.extra as any)?.spotifyClientId ??
  "f95c8effcc63427e8b98c6a92a9d0c17";

const CLIENT_SECRET = "3aef3477d95f4aa49e65368370eb9db7";

export const REDIRECT_URI = "flusso://spotify-auth/";

const SCOPES = [
  "app-remote-control",
  "user-read-playback-state",
  "user-read-currently-playing",
].join(" ");

const AUTH_ENDPOINT  = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

let _isConnected  = false;
let _accessToken:  string | null = null;
let _refreshToken: string | null = null;
let _tokenExpiry:  number        = 0;

export function getAccessToken(): string | null {
  if (_accessToken && Date.now() < _tokenExpiry - 60_000) return _accessToken;
  return null;
}

export function getAccessTokenRaw(): string | null {
  return _accessToken;
}

export function hasStoredCredentials(): boolean {
  return !!_accessToken;
}

function base64urlEncode(input: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...Array.from(input)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateCodeVerifier(): Promise<string> {
  return base64urlEncode(await Crypto.getRandomBytesAsync(64));
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  return digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const body = new URLSearchParams({
    grant_type:    "authorization_code",
    code,
    redirect_uri:  REDIRECT_URI,
    client_id:     CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method:  "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:  `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  if (!json.access_token) throw new Error("No access_token in token response");
  return json;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!_refreshToken) return null;
  try {
    const body = new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: _refreshToken,
      client_id:     CLIENT_ID,
    });
    const res = await fetch(TOKEN_ENDPOINT, {
      method:  "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:  `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      },
      body: body.toString(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    _accessToken  = json.access_token;
    _tokenExpiry  = Date.now() + json.expires_in * 1000;
    if (json.refresh_token) _refreshToken = json.refresh_token;
    console.log("🎵 Token refreshed");
    return _accessToken;
  } catch { return null; }
}

export async function getValidAccessToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token) return token;
  if (_refreshToken) return refreshAccessToken();
  return null;
}

const MAX_RETRIES    = 3;
const RETRY_DELAY_MS = 700;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(token: string): Promise<void> {
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🎵 connect attempt ${attempt}/${MAX_RETRIES}`);

      if (attempt === 1) {
        try {
          await Linking.openURL("spotify://");
          await sleep(RETRY_DELAY_MS);
        } catch {}
      } else {
        await sleep(RETRY_DELAY_MS * attempt);
      }

      await remote.connect(token);
      console.log("✅ Spotify App Remote connected!");
      return;
    } catch (e: any) {
      lastError = e;
      console.log(`🎵 attempt ${attempt} failed:`, e?.message ?? e);
    }
  }

  throw lastError;
}

export async function spotifyConnectFull(): Promise<void> {
  if (!CLIENT_ID) throw new Error("Missing Spotify client ID");

  const codeVerifier  = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    response_type:         "code",
    redirect_uri:          REDIRECT_URI,
    scope:                 SCOPES,
    code_challenge_method: "S256",
    code_challenge:        codeChallenge,
    show_dialog:           "false",
  });

  const authUrl = `${AUTH_ENDPOINT}?${params.toString()}`;
  console.log("🎵 Opening Spotify OAuth:", authUrl);

  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI, {
    showInRecents: false,
  });

  console.log("🎵 WebBrowser result:", result.type);

  if (result.type !== "success") {
    throw new Error(
      result.type === "dismiss" ? "Authorization was cancelled." : "Authorization failed.",
    );
  }

  const url       = result.url;
  const codeMatch = url.match(/[?&]code=([^&]+)/);
  if (!codeMatch?.[1]) throw new Error(`No authorization code in redirect URL: ${url}`);

  const code      = decodeURIComponent(codeMatch[1]);
  console.log("🎵 Exchanging code for token…");

  const tokenData = await exchangeCodeForToken(code, codeVerifier);

  _accessToken  = tokenData.access_token;
  _tokenExpiry  = Date.now() + tokenData.expires_in * 1000;
  _refreshToken = tokenData.refresh_token ?? null;

  console.log(`🎵 Token OK. Expires in ${tokenData.expires_in}s. Has refresh: ${!!_refreshToken}`);

  await connectWithRetry(_accessToken);
  _isConnected = true;
}

export async function spotifyConnect(accessToken: string): Promise<void> {
  await connectWithRetry(accessToken);
  _isConnected = true;
}

export function spotifyRemote() {
  if (!_isConnected) throw new Error("Spotify not connected — call spotifyConnectFull() first");
  return remote;
}

export async function spotifyDisconnect(): Promise<void> {
  _isConnected = false;
  try { await remote.disconnect(); } catch {}
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

export async function spotifyReconnect(): Promise<boolean> {
  const token = await getValidAccessToken();
  if (!token) return false;
  try {
    await connectWithRetry(token);
    _isConnected = true;
    return true;
  } catch (e) {
    console.log("🎵 Silent reconnect failed (Spotify probably not playing):", e);
    _isConnected = false;
    return false;
  }
}
