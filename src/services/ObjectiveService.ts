import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Objective } from '@/types/models'

export const ObjectiveService = {
  subscribe(uid: string, onChange: (objectives: Objective[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'users', uid, 'objectives'),
      orderBy('createdAt', 'desc')
    )
    return onSnapshot(q, (snap) => {
      const objectives = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Objective))
      onChange(objectives)
    })
  },

  async create(uid: string, data: Omit<Objective, 'id' | 'userId' | 'createdAt'>): Promise<string> {
    const ref = await addDoc(collection(db, 'users', uid, 'objectives'), {
      ...data,
      userId: uid,
      createdAt: serverTimestamp(),
    })
    return ref.id
  },

  async update(uid: string, objectiveId: string, data: Partial<Objective>): Promise<void> {
    await updateDoc(doc(db, 'users', uid, 'objectives', objectiveId), data)
  },

  async delete(uid: string, objectiveId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', uid, 'objectives', objectiveId))
  },
}
