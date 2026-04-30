import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Task } from '@/types/models'

export const TaskService = {
  subscribe(uid: string, onChange: (tasks: Task[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'users', uid, 'tasks'),
      orderBy('createdAt', 'desc')
    )
    return onSnapshot(q, (snap) => {
      const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task))
      onChange(tasks)
    })
  },

  async create(uid: string, data: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ref = await addDoc(collection(db, 'users', uid, 'tasks'), {
      ...data,
      userId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },

  async update(uid: string, taskId: string, data: Partial<Task>): Promise<void> {
    await updateDoc(doc(db, 'users', uid, 'tasks', taskId), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  },

  async delete(uid: string, taskId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', uid, 'tasks', taskId))
  },

  async complete(uid: string, taskId: string, isCompleted: boolean): Promise<void> {
    await updateDoc(doc(db, 'users', uid, 'tasks', taskId), {
      isCompleted,
      updatedAt: serverTimestamp(),
    })
  },
}
