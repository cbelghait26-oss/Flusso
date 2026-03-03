// src/services/passwordReset.ts
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "./firebase";

export async function requestPasswordReset(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();

  // Optional basic validation
  if (!email.includes("@")) {
    throw new Error("INVALID_EMAIL");
  }

  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (e: any) {
    throw e;
  }
}
