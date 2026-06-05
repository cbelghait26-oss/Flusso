import { create } from 'zustand'
import { User } from 'firebase/auth'
import { UserProfile, UserSettings } from '@/types/models'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  settings: UserSettings | null
  loading: boolean
  isPremium: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  setSettings: (settings: UserSettings | null) => void
  setLoading: (loading: boolean) => void
  setIsPremium: (isPremium: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  settings: null,
  loading: true,
  isPremium: false,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setSettings: (settings) => set({ settings }),
  setLoading: (loading) => set({ loading }),
  setIsPremium: (isPremium) => set({ isPremium }),
  reset: () =>
    set({
      user: null,
      profile: null,
      settings: null,
      loading: false,
      isPremium: false,
    }),
}))
