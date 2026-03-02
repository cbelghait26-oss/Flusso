// src/services/emailVerification.ts
import {
  sendEmailVerification,
  verifyBeforeUpdateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  getIdToken,
  type User,
} from "firebase/auth";

/**
 * Send (or re-send) a verification email to the current user.
 */
export async function sendVerificationEmail(user: User): Promise<void> {
  console.log('[emailVerification] sending to:', user.email);
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
 * Request an email address change using the safe Firebase flow:
 *  1. Re-authenticate with current password.
 *  2. Call verifyBeforeUpdateEmail() — Firebase sends a link to the NEW address.
 *  3. The email only updates in Firebase after the user clicks that link.
 *
 * The caller should NOT update local email state until the user confirms
 * via user.reload() showing the new email.
 */
export async function requestEmailChange(
  user: User,
  currentPassword: string,
  newEmail: string
): Promise<void> {
  if (!user.email) throw new Error("No email associated with this account.");

  const trimmed = newEmail.trim().toLowerCase();
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  console.log('[emailVerification] verifyBeforeUpdateEmail — sending link to:', trimmed);
  await verifyBeforeUpdateEmail(user, trimmed);
}

/**
 * After the user clicks the confirmation link in their new-email inbox,
 * reload + force-refresh the token so Firebase reflects the updated email.
 * Returns the new email from the reloaded user (or null if unchanged).
 */
export async function confirmEmailChange(user: User): Promise<string | null> {
  await user.reload();
  await getIdToken(user, true);
  return user.email;
}
