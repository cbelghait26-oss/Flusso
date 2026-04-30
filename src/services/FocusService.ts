import {
  collection,
  doc,
  addDoc,
  setDoc,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { FocusSession } from '@/types/models'
import { getDayKey } from '@/lib/utils'

export const FocusService = {
  async saveFocusSession(uid: string, data: Omit<FocusSession, 'id' | 'userId'>): Promise<string> {
    const ref = await addDoc(collection(db, 'users', uid, 'focusSessions'), {
      ...data,
      userId: uid,
    })

    const durationMinutes = Math.floor(data.duration / 60)
    const dayKey = getDayKey(data.startTime.toDate())

    // Update daily metrics
    await setDoc(
      doc(db, 'userMetrics', uid, 'daily', dayKey),
      {
        dayKey,
        minutesFocused: increment(durationMinutes),
        isStreakDay: true,
      },
      { merge: true }
    )

    // Update userMetrics totals
    await setDoc(
      doc(db, 'userMetrics', uid),
      {
        uid,
        totalFocusMinutes: increment(durationMinutes),
        lastActive: serverTimestamp(),
        currentlyFocusing: false,
      },
      { merge: true }
    )

    // Update user profile
    await setDoc(
      doc(db, 'users', uid),
      { totalFocusMinutes: increment(durationMinutes) },
      { merge: true }
    )

    return ref.id
  },

  async setCurrentlyFocusing(uid: string, isFocusing: boolean): Promise<void> {
    await setDoc(
      doc(db, 'userMetrics', uid),
      {
        currentlyFocusing: isFocusing,
        lastActive: serverTimestamp(),
      },
      { merge: true }
    )
  },
}
