// src/services/appleAuth.ios.ts
// Metro automatically selects this file on iOS instead of appleAuth.ts,
// so expo-apple-authentication (iOS-only native module) is NEVER bundled
// for Android or web.
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, signInWithCredential, linkWithCredential, updateProfile } from 'firebase/auth';
import { auth } from './firebase';

/** Generate a random nonce string used for replay-attack protection. */
async function generateNonce(length = 32): Promise<string> {
  const charset =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }
  return result;
}

/**
 * Sign in (or link) with Apple via Firebase Auth (modular v9).
 *
 * Flow:
 *  1. Generate raw nonce → SHA-256 hash it.
 *  2. Pass hashed nonce to Apple's native sheet.
 *  3. Build Firebase OAuthProvider credential with the raw nonce.
 *  4. If a Firebase user is already signed-in, link the credential;
 *     otherwise sign in fresh.
 *
 * Returns the Firebase UserCredential, or undefined if the user cancelled.
 * Throws on any other error.
 */
export async function signInWithApple() {
  const rawNonce = await generateNonce();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let appleCredential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e: any) {
    // User pressed Cancel — treat as a no-op
    if (e?.code === 'ERR_REQUEST_CANCELED') return undefined;
    console.error('[appleAuth] Apple sheet error:', e);
    throw e;
  }

  if (!appleCredential.identityToken) {
    throw new Error('Apple Sign-In failed: missing identityToken.');
  }

  const provider = new OAuthProvider('apple.com');
  const { fullName } = appleCredential;
  const displayName =
    fullName?.givenName && fullName?.familyName
      ? `${fullName.givenName} ${fullName.familyName}`.trim()
      : fullName?.givenName ?? null;

  const currentUser = auth.currentUser;

  // Helper to build a fresh credential — OAuthCredential is single-use, so
  // we must reconstruct it rather than reusing the same object after a failure.
  const buildCredential = () =>
    provider.credential({ idToken: appleCredential.identityToken!, rawNonce });

  let userCredential;
  if (currentUser) {
    // Existing Firebase session → try to link Apple credential.
    // Falls back to a fresh sign-in if the credential is already linked.
    try {
      userCredential = await linkWithCredential(currentUser, buildCredential());
    } catch (linkErr: any) {
      if (
        linkErr?.code === 'auth/provider-already-linked' ||
        linkErr?.code === 'auth/credential-already-in-use'
      ) {
        // Build a NEW credential — the previous one was consumed by the failed link attempt.
        userCredential = await signInWithCredential(auth, buildCredential());
      } else {
        throw linkErr;
      }
    }
  } else {
    userCredential = await signInWithCredential(auth, buildCredential());
  }

  // Update profile display name if supplied (Apple only sends it once)
  if (displayName && !userCredential.user.displayName) {
    await updateProfile(userCredential.user, { displayName });
  }

  return userCredential;
}
