import { Timestamp } from 'firebase/firestore'

// ─── Task ───────────────────────────────────────────────────────────────────
export interface Task {
  id: string
  title: string
  isCompleted: boolean
  importance: number // 1-4
  deadline: Timestamp | null
  objectiveId: string | null
  notes: string
  isMyDay: boolean
  userId: string
  createdAt: Timestamp
  updatedAt: Timestamp
  sortOrder?: number
}

// ─── Objective ───────────────────────────────────────────────────────────────
export type ObjectiveCategory =
  | 'Academic'
  | 'Career'
  | 'Personal'
  | 'Health'
  | 'Skill'
  | 'Creative'
  | 'Misc'

export interface Objective {
  id: string
  title: string
  category: ObjectiveCategory
  colorIndex: number // 0-7
  tasks: string[] // task IDs
  targetDate: Timestamp | null
  isCompleted: boolean
  userId: string
  createdAt?: Timestamp
}

// ─── CalendarEvent ───────────────────────────────────────────────────────────
export interface CalendarEvent {
  id: string
  title: string
  date: Timestamp
  endDate: Timestamp | null
  isAllDay: boolean
  color: string
  notes: string
  userId: string
}

// ─── FocusSession ────────────────────────────────────────────────────────────
export interface FocusSession {
  id: string
  duration: number // seconds
  taskId: string | null
  startTime: Timestamp
  endTime: Timestamp
  userId: string
}

// ─── TrainingPlan ─────────────────────────────────────────────────────────────
export type TrainingPlanType = 'Cycle' | 'Week'

export interface TrainingDay {
  dayIndex: number
  exercises: Exercise[]
}

export interface Exercise {
  name: string
  sets: number
  reps: number
  weight: number
}

export interface TrainingPlan {
  id: string
  objectiveId: string
  type: TrainingPlanType
  days: TrainingDay[]
  startDate: Timestamp
  userId: string
}

// ─── Habit ────────────────────────────────────────────────────────────────────
export type HabitFrequency = 'daily' | 'weekly'

export interface Habit {
  id: string
  objectiveId: string
  title: string
  frequency: HabitFrequency
  completions: string[] // ISO date strings
  userId: string
}

// ─── Achievement ──────────────────────────────────────────────────────────────
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface Achievement {
  id: string
  tier: AchievementTier
  unlockedAt: Timestamp | null
  userId: string
}

// ─── UserProfile ──────────────────────────────────────────────────────────────
export interface UserProfile {
  uid: string
  displayName: string
  friendTag: string
  photoURL: string | null
  streak: number
  totalFocusMinutes: number
}

// ─── UserSettings ─────────────────────────────────────────────────────────────
export interface UserSettings {
  dailyFocusGoalMinutes: number
  timeFormat: '12h' | '24h'
  onboardingComplete: boolean
  onboardingName?: string
  onboardingReason?: string
  notificationsEnabled: boolean
  dailyReminderTime?: string // "HH:MM"
}

// ─── UserMetrics ──────────────────────────────────────────────────────────────
export interface UserMetrics {
  uid: string
  displayName: string
  friendTag: string
  photoURL: string | null
  streak: number
  totalFocusMinutes: number
  tasksCompleted: number
  currentlyFocusing: boolean
  lastActive: Timestamp | null
}

export interface DailyMetric {
  dayKey: string // "YYYY-MM-DD"
  minutesFocused: number
  tasksCompleted: number
  isStreakDay: boolean
}

// ─── Friendship / Social ──────────────────────────────────────────────────────
export type FriendRequestStatus = 'pending' | 'accepted' | 'declined'

export interface FriendRequest {
  id: string
  fromUid: string
  toTag: string
  status: FriendRequestStatus
  createdAt: Timestamp
}

export interface Friendship {
  id: string
  uids: string[]
  createdAt: Timestamp
}

// ─── FocusRoom (web-exclusive) ────────────────────────────────────────────────
export interface FocusRoom {
  id: string
  hostUid: string
  participantUids: string[]
  startedAt: Timestamp
  isActive: boolean
}
