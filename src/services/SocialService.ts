import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { UserMetrics, FriendRequest, Friendship } from '@/types/models'

export const SocialService = {
  subscribeLeaderboard(
    uids: string[],
    onChange: (metrics: UserMetrics[]) => void
  ): Unsubscribe {
    if (uids.length === 0) return () => {}
    // Firestore 'in' queries limited to 30 — paginate if needed
    const q = query(
      collection(db, 'userMetrics'),
      where('uid', 'in', uids.slice(0, 30))
    )
    return onSnapshot(q, (snap) => {
      const metrics = snap.docs.map((d) => d.data() as UserMetrics)
      onChange(metrics)
    })
  },

  async sendFriendRequest(fromUid: string, toTag: string): Promise<void> {
    await addDoc(collection(db, 'friendRequests'), {
      fromUid,
      toTag,
      status: 'pending',
      createdAt: serverTimestamp(),
    })
  },

  subscribeIncomingRequests(
    userTag: string,
    onChange: (reqs: FriendRequest[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'friendRequests'),
      where('toTag', '==', userTag),
      where('status', '==', 'pending')
    )
    return onSnapshot(q, (snap) => {
      onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest)))
    })
  },

  async acceptFriendRequest(requestId: string, fromUid: string, toUid: string): Promise<void> {
    await updateDoc(doc(db, 'friendRequests', requestId), { status: 'accepted' })
    await addDoc(collection(db, 'friendships'), {
      uids: [fromUid, toUid],
      createdAt: serverTimestamp(),
    })
  },

  async declineFriendRequest(requestId: string): Promise<void> {
    await updateDoc(doc(db, 'friendRequests', requestId), { status: 'declined' })
  },

  async getFriendships(uid: string): Promise<Friendship[]> {
    const q = query(
      collection(db, 'friendships'),
      where('uids', 'array-contains', uid)
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Friendship))
  },

  async getUserMetrics(uid: string): Promise<UserMetrics | null> {
    const snap = await getDoc(doc(db, 'userMetrics', uid))
    return snap.exists() ? (snap.data() as UserMetrics) : null
  },
}
