import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { DailyMetric } from '@/types/models'

interface FocusSessionRecord {
  startTime: { toDate: () => Date }
  duration: number
}

export const AnalyticsService = {
  async getDailyMetrics(uid: string): Promise<DailyMetric[]> {
    const q = query(
      collection(db, 'userMetrics', uid, 'daily'),
      orderBy('dayKey', 'asc')
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => d.data() as DailyMetric)
  },

  async getFocusSessions(uid: string): Promise<FocusSessionRecord[]> {
    const q = query(
      collection(db, 'users', uid, 'focusSessions'),
      orderBy('startTime', 'asc')
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => d.data() as FocusSessionRecord)
  },
}
