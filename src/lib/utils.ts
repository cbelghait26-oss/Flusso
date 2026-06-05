import { Timestamp } from 'firebase/firestore'

/** Format a Firestore Timestamp or Date to a readable string */
export function formatDate(ts: Timestamp | Date | null | undefined, format: '12h' | '24h' = '24h'): string {
  if (!ts) return ''
  const date = ts instanceof Timestamp ? ts.toDate() : ts
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Returns "today" | "tomorrow" | "overdue" | "future" | null */
export function getDeadlineStatus(
  deadline: Timestamp | null | undefined
): 'overdue' | 'today' | 'tomorrow' | 'future' | null {
  if (!deadline) return null
  const now = new Date()
  const d = deadline.toDate()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (dDay < today) return 'overdue'
  if (dDay.getTime() === today.getTime()) return 'today'
  if (dDay.getTime() === tomorrow.getTime()) return 'tomorrow'
  return 'future'
}

/** Deterministic daily quote index (same rotation as iOS) */
export function getDailyQuoteIndex(totalQuotes: number): number {
  const now = new Date()
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  )
  return dayOfYear % totalQuotes
}

/** Format seconds to MM:SS */
export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Format minutes to readable string: "1h 23m" or "45m" */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** Get YYYY-MM-DD day key from a Date */
export function getDayKey(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}

/** Generate a random 6-char alphanumeric friend tag */
export function generateFriendTag(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/** Class name helper — filters falsy values */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Objective accent colors indexed 0-7 */
export const OBJECTIVE_COLORS = [
  '#7F77DD', // purple (primary)
  '#4ADE80', // green
  '#60A5FA', // blue
  '#FBBF24', // yellow
  '#F87171', // red
  '#A78BFA', // violet
  '#34D399', // emerald
  '#FB923C', // orange
] as const

/** Get greeting based on current hour */
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
