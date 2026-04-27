import { create } from 'zustand'
import { UserMetrics, FriendRequest, Friendship } from '@/types/models'

interface SocialState {
  friendMetrics: UserMetrics[]
  leaderboard: UserMetrics[]
  friendRequests: FriendRequest[]
  friendships: Friendship[]
  setFriendMetrics: (metrics: UserMetrics[]) => void
  setLeaderboard: (lb: UserMetrics[]) => void
  setFriendRequests: (reqs: FriendRequest[]) => void
  setFriendships: (fs: Friendship[]) => void
  reset: () => void
}

export const useSocialStore = create<SocialState>((set) => ({
  friendMetrics: [],
  leaderboard: [],
  friendRequests: [],
  friendships: [],
  setFriendMetrics: (friendMetrics) => set({ friendMetrics }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setFriendRequests: (friendRequests) => set({ friendRequests }),
  setFriendships: (friendships) => set({ friendships }),
  reset: () =>
    set({
      friendMetrics: [],
      leaderboard: [],
      friendRequests: [],
      friendships: [],
    }),
}))
