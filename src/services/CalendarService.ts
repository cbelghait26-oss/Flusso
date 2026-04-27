import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { CalendarEvent } from '@/types/models'

export const CalendarService = {
  async getEvents(uid: string): Promise<CalendarEvent[]> {
    const q = query(
      collection(db, 'users', uid, 'events'),
      orderBy('date', 'asc')
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CalendarEvent))
  },

  async create(uid: string, data: Omit<CalendarEvent, 'id' | 'userId'>): Promise<string> {
    const ref = await addDoc(collection(db, 'users', uid, 'events'), {
      ...data,
      userId: uid,
    })
    return ref.id
  },

  async update(uid: string, eventId: string, data: Partial<CalendarEvent>): Promise<void> {
    await updateDoc(doc(db, 'users', uid, 'events', eventId), data)
  },

  async delete(uid: string, eventId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', uid, 'events', eventId))
  },
}
