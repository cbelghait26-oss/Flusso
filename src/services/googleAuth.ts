// src/services/googleAuth.ts
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "./firebase";
import Constants from "expo-constants";

let configured = false;

function ensureConfigured() {
  if (configured) return;

  const webClientId =
    Constants.expoConfig?.extra?.googleWebClientId;

  if (!webClientId) {
    throw new Error("Missing googleWebClientId in app.json extra.");
  }

  GoogleSignin.configure({ webClientId });
  configured = true;
}


export async function signInWithGoogleFirebase() {
  ensureConfigured();

  // iOS doesn't need Play Services, but this keeps code cross-platform safe
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch {}

  const res = await GoogleSignin.signIn();

  const idToken =
    (res as any).idToken ??
    (res as any).data?.idToken ??
    (res as any).user?.idToken;

  if (!idToken) throw new Error("Google Sign-In failed: missing idToken.");

  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}
