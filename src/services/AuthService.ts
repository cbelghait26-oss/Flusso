import {
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
  reauthenticateWithPopup,
  User,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { UserProfile, UserSettings } from '@/types/models'
import { generateFriendTag } from '@/lib/utils'

const googleProvider = new GoogleAuthProvider()
const appleProvider = new OAuthProvider('apple.com')
appleProvider.addScope('email')
appleProvider.addScope('name')

export const AuthService = {
  signInWithGoogle: () => signInWithPopup(auth, googleProvider),
  signInWithApple: () => signInWithPopup(auth, appleProvider),
  signInWithEmail: (email: string, password: string) =>
    signInWithEmailAndPassword(auth, email, password),
  signUpWithEmail: async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await AuthService.createUserDocIfNeeded(cred.user, displayName)
    return cred
  },
  resetPassword: (email: string) => sendPasswordResetEmail(auth, email),
  signOut: () => signOut(auth),
  deleteAccount: async (user: User) => {
    await deleteUser(user)
  },

  async createUserDocIfNeeded(user: User, displayName?: string): Promise<void> {
    const profileRef = doc(db, 'users', user.uid)
    const existing = await getDoc(profileRef)
    if (!existing.exists()) {
      const tag = generateFriendTag()
      const profile: UserProfile = {
        uid: user.uid,
        displayName: displayName ?? user.displayName ?? 'Flusso User',
        friendTag: tag,
        photoURL: user.photoURL,
        streak: 0,
        totalFocusMinutes: 0,
      }
      await setDoc(profileRef, { ...profile, createdAt: serverTimestamp() })
      // Create tag mapping
      await setDoc(doc(db, 'friendTags', tag), { uid: user.uid })
    }
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(db, 'users', uid))
    return snap.exists() ? (snap.data() as UserProfile) : null
  },

  async getUserSettings(uid: string): Promise<UserSettings | null> {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'settings'))
    return snap.exists() ? (snap.data() as UserSettings) : null
  },

  async saveUserSettings(uid: string, settings: Partial<UserSettings>): Promise<void> {
    await setDoc(doc(db, 'users', uid, 'private', 'settings'), settings, { merge: true })
  },
}
