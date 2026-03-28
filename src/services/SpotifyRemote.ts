// src/services/SpotifyRemote.ts
// Pure Web API implementation — no react-native-spotify-remote dependency.
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import { loadSpotifyTokens, saveSpotifyTokens, clearSpotifyTokens } from "../data/storage";

const CLIENT_ID =
  (Constants.expoConfig?.extra as any)?.spotifyClientId ??
  "f95c8effcc63427e8b98c6a92a9d0c17";

const CLIENT_SECRET = "3aef3477d95f4aa49e65368370eb9db7";

export const REDIRECT_URI = "flusso://spotify-auth/";

const SCOPES = [
  "app-remote-control",
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
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
    // Persist refreshed tokens so the next session resumes without re-auth
    saveSpotifyTokens({ accessToken: _accessToken, refreshToken: _refreshToken, expiry: _tokenExpiry }).catch(() => {});
    return _accessToken;
  } catch { return null; }
}

/**
 * Load persisted Spotify tokens from cloud storage and hydrate the in-memory
 * token variables. Called on app startup so users don't have to re-authorize.
 */
export async function spotifyLoadSavedTokens(): Promise<void> {
  try {
    const saved = await loadSpotifyTokens();
    if (!saved?.refreshToken) return;
    _refreshToken = saved.refreshToken;
    // Reuse the access token only if it hasn't expired
    if (saved.accessToken && saved.expiry && Date.now() < saved.expiry - 60_000) {
      _accessToken = saved.accessToken;
      _tokenExpiry = saved.expiry;
    } else {
      // Access token expired — silently refresh using the saved refresh token
      await refreshAccessToken();
    }
  } catch (e) {
  }
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

  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI, {
    showInRecents: false,
  });


  if (result.type !== "success") {
    throw new Error(
      result.type === "dismiss" ? "Authorization was cancelled." : "Authorization failed.",
    );
  }

  const url       = result.url;
  const codeMatch = url.match(/[?&]code=([^&]+)/);
  if (!codeMatch?.[1]) throw new Error(`No authorization code in redirect URL: ${url}`);

  const code = decodeURIComponent(codeMatch[1]);

  const tokenData = await exchangeCodeForToken(code, codeVerifier);

  _accessToken  = tokenData.access_token;
  _tokenExpiry  = Date.now() + tokenData.expires_in * 1000;
  _refreshToken = tokenData.refresh_token ?? null;


  // Persist tokens to cloud so future sessions restore without re-auth
  saveSpotifyTokens({ accessToken: _accessToken, refreshToken: _refreshToken, expiry: _tokenExpiry }).catch(() => {});

  const ok = await spotifyIsConnected();
  if (!ok) throw new Error("Spotify Web API unreachable — check scopes or network.");

  // Check if there is an active Spotify device/player — warn if not
  const ps = await getPlayerState();
  if (!ps) throw new Error("no_active_device");

}

// ─── Connection state ─────────────────────────────────────────────────────────

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
  return spotifyIsConnected();
}

export async function spotifyDisconnect(): Promise<void> {
  _accessToken  = null;
  _refreshToken = null;
  _tokenExpiry  = 0;
  clearSpotifyTokens().catch(() => {});
}

// ─── Core API helper ──────────────────────────────────────────────────────────

async function apiCall(
  endpoint: string,
  method: "GET" | "PUT" | "POST" | "DELETE" = "GET",
  body?: object,
): Promise<any | null> {
  const token = await getValidAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return {};
    if (!res.ok) {
      const text = await res.text();
      return null;
    }
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ─── Player state ─────────────────────────────────────────────────────────────

export type RepeatMode = "off" | "track" | "context";

export type WebPlayerState = {
  isPlaying:    boolean;
  trackName:    string;
  artistName:   string;
  albumArtUrl:  string | null;
  trackUri:     string | null;
  durationMs:   number;
  positionMs:   number;
  shuffleState: boolean;
  repeatState:  RepeatMode;
};

export async function getPlayerState(): Promise<WebPlayerState | null> {
  const data = await apiCall("/me/player");
  if (!data || !data.item) return null;
  const item   = data.item;
  const images: any[] = item.album?.images ?? [];
  const art    = images[1]?.url ?? images[0]?.url ?? null;
  return {
    isPlaying:    data.is_playing    ?? false,
    trackName:    item.name          ?? "",
    artistName:   item.artists?.[0]?.name ?? "",
    albumArtUrl:  art,
    trackUri:     item.uri           ?? null,
    durationMs:   item.duration_ms   ?? 0,
    positionMs:   data.progress_ms   ?? 0,
    shuffleState: data.shuffle_state ?? false,
    repeatState:  (data.repeat_state as RepeatMode) ?? "off",
  };
}

// ─── Playback commands ────────────────────────────────────────────────────────

export async function spotifyPlay(contextUri?: string, trackUri?: string): Promise<void> {
  const body: any = {};
  if (contextUri) body.context_uri = contextUri;
  if (trackUri)   body.uris        = [trackUri];
  await apiCall("/me/player/play", "PUT", Object.keys(body).length ? body : undefined);
}

export async function spotifyPause(): Promise<void> {
  await apiCall("/me/player/pause", "PUT");
}

export async function spotifyResume(): Promise<void> {
  const token = await getValidAccessToken();
  if (!token) return;
  const res = await fetch(`${API_BASE}/me/player/play`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (res.ok || res.status === 204) return;
  if (res.status !== 404) return; // some other transient error — ignore silently

  // 404 = no active device. Try to wake any available Spotify device automatically.
  const devData = await apiCall("/me/player/devices");
  const devices: { id: string; is_active: boolean }[] = devData?.devices ?? [];
  const device = devices[0];
  if (device?.id) {
    await apiCall("/me/player", "PUT", { device_ids: [device.id], play: true });
    return;
  }
  // No device found at all — caller must prompt the user.
  throw new Error("no_active_device");
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

// ─── Shuffle & repeat ─────────────────────────────────────────────────────────

export async function spotifySetShuffle(state: boolean): Promise<void> {
  await apiCall(`/me/player/shuffle?state=${state}`, "PUT");
}

export function nextRepeatMode(current: RepeatMode): RepeatMode {
  if (current === "off")     return "context";
  if (current === "context") return "track";
  return "off";
}

export async function spotifySetRepeat(mode: RepeatMode): Promise<void> {
  await apiCall(`/me/player/repeat?state=${mode}`, "PUT");
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export type QueueTrack = {
  uri:        string;
  name:       string;
  artistName: string;
  artUrl:     string | null;
  durationMs: number;
};

export async function spotifyGetQueue(): Promise<QueueTrack[]> {
  const data = await apiCall("/me/player/queue");
  if (!data?.queue) return [];
  return (data.queue as any[]).slice(0, 20).map((item: any) => ({
    uri:        item.uri ?? "",
    name:       item.name ?? "",
    artistName: item.artists?.[0]?.name ?? "",
    artUrl:     item.album?.images?.[2]?.url ?? item.album?.images?.[0]?.url ?? null,
    durationMs: item.duration_ms ?? 0,
  }));
}

export async function spotifyAddToQueue(trackUri: string): Promise<void> {
  await apiCall(`/me/player/queue?uri=${encodeURIComponent(trackUri)}`, "POST");
}

// ─── Playlists ────────────────────────────────────────────────────────────────

export type SpotifyPlaylist = {
  id:          string;
  uri:         string;
  name:        string;
  description: string;
  trackCount:  number;
  artUrl:      string | null;
  owner:       string;
};

export async function spotifyGetPlaylists(limit = 50): Promise<SpotifyPlaylist[]> {
  const data = await apiCall(`/me/playlists?limit=${limit}`);
  if (!data?.items) return [];
  return (data.items as any[]).map((p: any) => ({
    id:          p.id,
    uri:         p.uri,
    name:        p.name ?? "Untitled",
    description: p.description ?? "",
    trackCount:  p.tracks?.total ?? 0,
    artUrl:      p.images?.[0]?.url ?? null,
    owner:       p.owner?.display_name ?? "",
  }));
}

// ─── Playlist tracks ──────────────────────────────────────────────────────────
// No `fields` filter — the strict filter was silently returning 0 items.

export type SpotifyTrack = {
  uri:        string;
  name:       string;
  artistName: string;
  albumName:  string;
  artUrl:     string | null;
  durationMs: number;
};

export async function spotifyGetPlaylistTracks(
  playlistId: string,
  limit  = 50,
  offset = 0,
): Promise<{ tracks: SpotifyTrack[]; total: number }> {
  const data = await apiCall(`/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`);
  if (!data?.items) return { tracks: [], total: 0 };
  const tracks: SpotifyTrack[] = (data.items as any[])
    .filter((item: any) => item?.track?.uri) // remove null / local-file entries
    .map((item: any) => {
      const t = item.track;
      return {
        uri:        t.uri,
        name:       t.name       ?? "",
        artistName: t.artists?.[0]?.name ?? "",
        albumName:  t.album?.name ?? "",
        artUrl:     t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url ?? null,
        durationMs: t.duration_ms ?? 0,
      };
    });
  return { tracks, total: data.total ?? 0 };
}

// ─── Saved tracks ─────────────────────────────────────────────────────────────

export async function spotifyGetSavedTracks(
  limit  = 50,
  offset = 0,
): Promise<{ tracks: SpotifyTrack[]; total: number }> {
  const data = await apiCall(`/me/tracks?limit=${limit}&offset=${offset}`);
  if (!data?.items) return { tracks: [], total: 0 };
  const tracks: SpotifyTrack[] = (data.items as any[]).map((item: any) => {
    const t = item.track;
    return {
      uri:        t.uri,
      name:       t.name       ?? "",
      artistName: t.artists?.[0]?.name ?? "",
      albumName:  t.album?.name ?? "",
      artUrl:     t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url ?? null,
      durationMs: t.duration_ms ?? 0,
    };
  });
  return { tracks, total: data.total ?? 0 };
}