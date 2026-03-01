// src/services/SpotifyRemote.ts
// Pure Web API implementation — no react-native-spotify-remote dependency.
import { Linking } from "react-native";
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
  "user-modify-playback-state",   // required for play/pause/skip via Web API
].join(" ");

const AUTH_ENDPOINT  = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const API_BASE       = "https://api.spotify.com/v1";

let _accessToken:  string | null = null;
let _refreshToken: string | null = null;
let _tokenExpiry:  number        = 0;

// ─── Token helpers ────────────────────────────────────────────────────────────

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

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

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

// ─── Token exchange ───────────────────────────────────────────────────────────

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

// ─── OAuth flow ───────────────────────────────────────────────────────────────

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

  // Verify we can reach the Web API (no native SDK needed)
  const ok = await spotifyIsConnected();
  if (!ok) throw new Error("Spotify Web API unreachable — check scopes or network.");

  console.log("✅ Spotify Web API ready");
}

// ─── Connection state (Web API: always "connected" if we have a valid token) ──

export async function spotifyIsConnected(): Promise<boolean> {
  const token = await getValidAccessToken();
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function spotifyReconnect(): Promise<boolean> {
  // With Web API there's nothing to "reconnect" — just verify token is valid.
  return spotifyIsConnected();
}

export async function spotifyDisconnect(): Promise<void> {
  // Clear in-memory tokens so the user has to re-auth next time.
  _accessToken  = null;
  _refreshToken = null;
  _tokenExpiry  = 0;
}

// ─── Web API playback controls ────────────────────────────────────────────────

async function apiCall(
  endpoint: string,
  method: "GET" | "PUT" | "POST" = "GET",
  body?: object,
): Promise<any | null> {
  const token = await getValidAccessToken();
  if (!token) {
    console.log("🎵 apiCall: no token");
    return null;
  }
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    // 204 = success with no body
    if (res.status === 204) return {};
    if (!res.ok) {
      const text = await res.text();
      console.log(`🎵 API ${method} ${endpoint} → ${res.status}:`, text);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.log("🎵 apiCall error:", e);
    return null;
  }
}

// ─── Player state ─────────────────────────────────────────────────────────────

export type WebPlayerState = {
  isPlaying:   boolean;
  trackName:   string;
  artistName:  string;
  albumArtUrl: string | null;
  trackUri:    string | null;
  durationMs:  number;
  positionMs:  number;
};

export async function getPlayerState(): Promise<WebPlayerState | null> {
  const data = await apiCall("/me/player/currently-playing");
  if (!data || !data.item) return null;
  const item   = data.item;
  const images: any[] = item.album?.images ?? [];
  const art    = images[1]?.url ?? images[0]?.url ?? null;
  return {
    isPlaying:   data.is_playing ?? false,
    trackName:   item.name ?? "",
    artistName:  item.artists?.[0]?.name ?? "",
    albumArtUrl: art,
    trackUri:    item.uri ?? null,
    durationMs:  item.duration_ms ?? 0,
    positionMs:  data.progress_ms ?? 0,
  };
}

// ─── Playback commands ────────────────────────────────────────────────────────

export async function spotifyPlay(contextUri?: string, trackUri?: string): Promise<void> {
  const body: any = {};
  if (contextUri)  body.context_uri = contextUri;
  if (trackUri)    body.uris        = [trackUri];
  await apiCall("/me/player/play", "PUT", Object.keys(body).length ? body : undefined);
}

export async function spotifyPause(): Promise<void> {
  await apiCall("/me/player/pause", "PUT");
}

export async function spotifyResume(): Promise<void> {
  await apiCall("/me/player/play", "PUT");
}

export async function spotifySkipNext(): Promise<void> {
  await apiCall("/me/player/next", "POST");
}

export async function spotifySkipPrevious(): Promise<void> {
  await apiCall("/me/player/previous", "POST");
}

export async function spotifySeek(positionMs: number): Promise<void> {
  await apiCall(`/me/player/seek?position_ms=${Math.round(positionMs)}`, "PUT");
}