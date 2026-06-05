import { create } from 'zustand'

interface SettingsState {
  dailyFocusGoalMinutes: number
  timeFormat: '12h' | '24h'
  notificationsEnabled: boolean
  dailyReminderTime: string
  setDailyFocusGoal: (minutes: number) => void
  setTimeFormat: (fmt: '12h' | '24h') => void
  setNotificationsEnabled: (enabled: boolean) => void
  setDailyReminderTime: (time: string) => void
  hydrate: (data: Partial<SettingsState>) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  dailyFocusGoalMinutes: 120,
  timeFormat: '24h',
  notificationsEnabled: false,
  dailyReminderTime: '09:00',
  setDailyFocusGoal: (dailyFocusGoalMinutes) => set({ dailyFocusGoalMinutes }),
  setTimeFormat: (timeFormat) => set({ timeFormat }),
  setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
  setDailyReminderTime: (dailyReminderTime) => set({ dailyReminderTime }),
  hydrate: (data) => set(data),
}))
