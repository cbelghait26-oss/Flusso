'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { AnalyticsService } from '@/services/AnalyticsService'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTaskStore } from '@/stores/useTaskStore'
import { useObjectiveStore } from '@/stores/useObjectiveStore'
import { cn } from '@/lib/utils'
import { DailyMetric } from '@/types/models'
import { PREVIEW_MODE } from '@/lib/config'

const CHART_COLOR = '#7F77DD'
const SECONDARY_COLOR = '#4ADE80'

// ─── Generate 90 days of realistic mock analytics for preview mode ────────────
function buildMockMetrics(): DailyMetric[] {
  const metrics: DailyMetric[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dayKey = d.toISOString().split('T')[0]
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const focused = isWeekend
      ? Math.random() < 0.4 ? 0 : Math.floor(Math.random() * 60 + 15)
      : Math.random() < 0.15 ? 0 : Math.floor(Math.random() * 90 + 20)
    metrics.push({
      dayKey,
      minutesFocused: focused,
      tasksCompleted: focused > 0 ? Math.floor(Math.random() * 5 + 1) : 0,
      isStreakDay: focused >= 30,
    })
  }
  return metrics
}

function buildMockSessions(): { startTime: { toDate: () => Date }; duration: number }[] {
  const sessions = []
  const peaks = [9, 10, 14, 15, 20] // common focus hours
  for (let i = 0; i < 60; i++) {
    const base = peaks[Math.floor(Math.random() * peaks.length)]
    const hour = Math.min(23, Math.max(0, base + Math.floor(Math.random() * 2 - 1)))
    const d = new Date()
    d.setDate(d.getDate() - Math.floor(Math.random() * 60))
    d.setHours(hour, Math.floor(Math.random() * 60), 0, 0)
    sessions.push({ startTime: { toDate: () => d }, duration: (Math.floor(Math.random() * 4) + 1) * 25 * 60 })
  }
  return sessions
}

export default function AnalyticsPage() {
  const { user } = useAuthStore()
  const { tasks } = useTaskStore()
  const { objectives } = useObjectiveStore()
  const [metrics, setMetrics] = useState<DailyMetric[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (PREVIEW_MODE) {
      setMetrics(buildMockMetrics())
      setSessions(buildMockSessions())
      setLoading(false)
      return
    }
    if (!user) return
    Promise.all([
      AnalyticsService.getDailyMetrics(user.uid),
      AnalyticsService.getFocusSessions(user.uid),
    ]).then(([m, s]) => {
      setMetrics(m)
      setSessions(s)
      setLoading(false)
    })
  }, [user])

  const totalFocusMins = metrics.reduce((s, m) => s + (m.minutesFocused ?? 0), 0)
  const totalTasks = tasks.filter((t) => t.isCompleted).length
  const avgFocusPerDay = metrics.length > 0 ? Math.round(totalFocusMins / metrics.length) : 0
  const longestStreak = metrics.filter((m) => m.isStreakDay).length

  // Last 30 days for bar chart
  const barData = metrics.slice(-30).map((m) => ({
    date: new Date(m.dayKey + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    focus: Math.round((m.minutesFocused ?? 0)),
    tasks: m.tasksCompleted ?? 0,
  }))

  // Time of day — 24 bars
  const hourBuckets = Array(24).fill(0)
  sessions.forEach((s) => {
    if (s.startTime) {
      const h = s.startTime.toDate().getHours()
      hourBuckets[h] += Math.round((s.duration ?? 0) / 60)
    }
  })
  const hourData = hourBuckets.map((mins, h) => ({ hour: `${String(h).padStart(2, '0')}h`, mins }))

  // Heatmap — 52 weeks
  const heatmapData = buildHeatmap(metrics)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Summary stats */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {[
          { label: 'Total Focus', value: `${Math.floor(totalFocusMins / 60)}h ${totalFocusMins % 60}m` },
          { label: 'Tasks Done', value: totalTasks },
          { label: 'Avg / Day', value: `${avgFocusPerDay}m` },
          { label: 'Longest Streak', value: `${longestStreak}d` },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-surface rounded-xl border border-border p-4"
          >
            <p className="text-xs text-text-tertiary">{s.label}</p>
            <p className="text-2xl font-bold font-display text-text-primary mt-1">{s.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Focus Heatmap */}
      <Section title="Focus Heatmap — Past Year">
        <div className="overflow-x-auto pb-1">
          <Heatmap data={heatmapData} />
        </div>
      </Section>

      {/* Daily focus bar chart */}
      <Section title="Daily Focus (last 30 days)">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: 'rgba(127,119,221,0.08)' }}
              />
              <Bar dataKey="focus" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Time of Day */}
      <Section title="Focus by Time of Day">
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourData} margin={{ left: -20 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#9CA3AF' }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: 'rgba(127,119,221,0.08)' }}
              />
              <Bar dataKey="mins" fill={SECONDARY_COLOR} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Objective Progress Timelines */}
      <Section title="Objective Progress">
        <div className="space-y-3">
          {objectives.map((obj) => {
            const objTasks = tasks.filter((t) => t.objectiveId === obj.id)
            const done = objTasks.filter((t) => t.isCompleted).length
            const pct = objTasks.length > 0 ? (done / objTasks.length) * 100 : 0
            return (
              <div key={obj.id} className="flex items-center gap-3">
                <span className="text-sm text-text-secondary w-36 truncate">{obj.title}</span>
                <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
                <span className="text-xs text-text-tertiary w-10 text-right">{Math.round(pct)}%</span>
              </div>
            )
          })}
          {objectives.length === 0 && (
            <p className="text-sm text-text-tertiary">No objectives yet.</p>
          )}
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface rounded-xl border border-border p-4"
    >
      <h3 className="text-sm font-semibold font-display text-text-primary mb-4">{title}</h3>
      {children}
    </motion.div>
  )
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function buildHeatmap(metrics: DailyMetric[]): Map<string, number> {
  const map = new Map<string, number>()
  metrics.forEach((m) => map.set(m.dayKey, m.minutesFocused ?? 0))
  return map
}

function Heatmap({ data }: { data: Map<string, number> }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cells: { date: Date; value: number }[] = []
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    cells.push({ date: d, value: data.get(key) ?? 0 })
  }

  const maxVal = Math.max(...cells.map((c) => c.value), 1)
  const getColor = (v: number) => {
    if (v === 0) return 'bg-surface-2'
    const p = v / maxVal
    if (p < 0.25) return 'bg-primary/20'
    if (p < 0.5) return 'bg-primary/40'
    if (p < 0.75) return 'bg-primary/60'
    return 'bg-primary'
  }

  // Pad so grid starts on Sunday
  const firstDay = cells[0].date.getDay()
  const padded = Array(firstDay).fill(null).concat(cells)

  return (
    <div className="flex gap-0.5" style={{ display: 'grid', gridTemplateColumns: `repeat(53, minmax(0, 1fr))`, gridAutoRows: '1fr' }}>
      {/* Actually render as 7-row columns */}
      {Array.from({ length: 53 }, (_, col) =>
        Array.from({ length: 7 }, (_, row) => {
          const idx = col * 7 + row - firstDay
          const cell = cells[idx]
          if (!cell) return <div key={`${col}-${row}`} className="h-3 w-3" />
          return (
            <div
              key={`${col}-${row}`}
              title={`${cell.date.toLocaleDateString()}: ${cell.value}m`}
              className={cn('h-3 w-3 rounded-sm transition-colors', getColor(cell.value))}
            />
          )
        })
      ).flat()}
    </div>
  )
}
