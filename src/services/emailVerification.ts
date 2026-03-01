// src/services/emailVerification.ts
import {
  sendEmailVerification,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  getIdToken,
  type User,
} from "firebase/auth";

/**
 * Send (or re-send) a verification email to the current user.
 */
export async function sendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

/**
 * Reload the Firebase user object and return the latest emailVerified flag.
 * Also force-refreshes the ID token so Firestore rules pick up the change
 * immediately after the user clicks the link.
 */
export async function reloadAndCheckVerified(user: User): Promise<boolean> {
  await user.reload();
  if (user.emailVerified) {
    await getIdToken(user, true); // force token refresh
  }
  return user.emailVerified;
}

/**
 * Change a user's email address.
 * Requires re-authentication with the current password because Firebase
 * treats email as a sensitive field.
 *
 * Steps:
 *  1. Re-authenticate with current credential.
 *  2. Update email.
 *  3. Send verification to the NEW address.
 *
 * Throws with a descriptive `message` property on failure so callers can
 * display user-friendly error messages.
 */
export async function changeEmailWithReauth(
  user: User,
  currentPassword: string,
  newEmail: string
): Promise<void> {
  if (!user.email) throw new Error("No email associated with this account.");

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updateEmail(user, newEmail);
  await sendEmailVerification(user);
}
