import { Platform } from "react-native";
import {
  auth,
  remote,
  ApiScope,
  ApiConfig,
} from "react-native-spotify-remote";
import Constants from "expo-constants";

const CLIENT_ID =
  (Constants.expoConfig?.extra as any)?.spotifyClientId ??
  (Constants.manifest2?.extra as any)?.spotifyClientId ??
  "f95c8effcc63427e8b98c6a92a9d0c17";

const REDIRECT_URI = "flusso://spotify-auth";

const SCOPES: ApiScope[] = [
  ApiScope.AppRemoteControlScope,
  ApiScope.UserFollowReadScope,
];

let isConnected = false;

export async function spotifyAuthorize() {
  if (!CLIENT_ID) throw new Error("Missing spotifyClientId in app.json extra");
  
  const config: ApiConfig = {
    clientID: CLIENT_ID,
    redirectURL: REDIRECT_URI,
    tokenRefreshURL: "",
    tokenSwapURL: "",
    scopes: SCOPES,
  };
  
  return await auth.authorize(config);
}

export async function spotifyConnect(accessToken: string) {
  if (!CLIENT_ID) throw new Error("Missing spotifyClientId in app.json extra");

  const config: ApiConfig = {
    clientID: CLIENT_ID,
    redirectURL: REDIRECT_URI,
    tokenRefreshURL: "",
    tokenSwapURL: "",
    scopes: SCOPES,
  };

  await remote.connect(accessToken);
  isConnected = true;
  return true;
}

export function spotifyRemote() {
  if (!isConnected) throw new Error("Spotify not connected");
  return remote;
}

export async function spotifyDisconnect() {
  isConnected = false;
  try {
    await remote.disconnect();
  } catch {}
}

export function isSpotifyInstalledHint() {
  // App Remote requires Spotify installed; iOS/Android will fail connect otherwise.
  return Platform.OS === "ios" || Platform.OS === "android";
}
