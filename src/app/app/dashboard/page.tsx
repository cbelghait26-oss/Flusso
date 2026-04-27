'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Flame, ArrowRight, Timer } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTaskStore } from '@/stores/useTaskStore'
import { useObjectiveStore } from '@/stores/useObjectiveStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { QUOTES } from '@/lib/quotes'
import { OBJECTIVE_COLORS, getDailyQuoteIndex, getGreeting, getDeadlineStatus } from '@/lib/utils'

const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
}

export default function DashboardPage() {
  const { profile } = useAuthStore()
  const { tasks } = useTaskStore()
  const { objectives } = useObjectiveStore()
  const { dailyFocusGoalMinutes } = useSettingsStore()
  const router = useRouter()
  const [focusedToday] = useState(0) // TODO: pull from userMetrics

  const greeting = getGreeting()
  const quote = QUOTES[getDailyQuoteIndex(QUOTES.length)]

  const todayTasks = tasks.filter((t) => {
    if (t.isCompleted) return false
    if (t.isMyDay) return true
    const status = getDeadlineStatus(t.deadline)
    return status === 'today' || status === 'overdue'
  }).slice(0, 5)

  const nextTask = todayTasks[0]
  const activeObjectives = objectives.filter((o) => !o.isCompleted).slice(0, 3)
  const focusPct = dailyFocusGoalMinutes > 0 ? Math.min(100, (focusedToday / dailyFocusGoalMinutes) * 100) : 0

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Greeting */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.3, delay: 0 }}
            className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface to-background p-6"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <h2 className="text-xl font-bold font-display text-text-primary">
              {greeting}, {profile?.displayName?.split(' ')[0] ?? 'there'} 👋
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {focusedToday === 0
                ? "Ready to start your focus session?"
                : `You've focused ${focusedToday} min today. Keep it up!`}
            </p>
          </motion.div>

          {/* Quote of the Day */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.3, delay: 0.04 }}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <p className="text-xs uppercase tracking-widest text-text-tertiary font-medium mb-2">Quote of the Day</p>
            <blockquote className="text-sm text-text-primary leading-relaxed italic">
              &ldquo;{quote.text}&rdquo;
            </blockquote>
            <p className="text-xs text-text-tertiary mt-2">— {quote.author}</p>
          </motion.div>

          {/* Today's Tasks */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.3, delay: 0.08 }}
            className="rounded-xl border border-border bg-surface"
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-text-primary font-display">Today's Tasks</h3>
              <Link href="/app/tasks" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {todayTasks.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-text-tertiary">No tasks due today.</p>
            ) : (
              <ul className="divide-y divide-border">
                {todayTasks.map((task, i) => {
                  const objective = objectives.find((o) => o.id === task.objectiveId)
                  const ds = getDeadlineStatus(task.deadline)
                  return (
                    <motion.li
                      key={task.id}
                      variants={fadeInUp}
                      initial="initial"
                      animate="animate"
                      transition={{ duration: 0.2, delay: 0.1 + i * 0.05 }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="h-4 w-4 rounded-full border-2 border-border flex-shrink-0" />
                      <span className="flex-1 text-sm text-text-primary truncate">{task.title}</span>
                      {objective && (
                        <Badge
                          className="text-[10px]"
                          style={{ borderColor: OBJECTIVE_COLORS[objective.colorIndex] + '40', color: OBJECTIVE_COLORS[objective.colorIndex] }}
                        >
                          {objective.title}
                        </Badge>
                      )}
                      {ds === 'overdue' && <Badge variant="danger" className="text-[10px]">Overdue</Badge>}
                      {ds === 'today' && <Badge variant="warning" className="text-[10px]">Today</Badge>}
                    </motion.li>
                  )
                })}
              </ul>
            )}
          </motion.div>

          {/* Next focus suggestion */}
          {nextTask && (
            <motion.div
              variants={fadeInUp}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.3, delay: 0.16 }}
              className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-4"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Timer size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-secondary mb-0.5">Ready to focus?</p>
                <p className="text-sm font-medium text-text-primary truncate">{nextTask.title}</p>
              </div>
              <Button size="sm" onClick={() => router.push('/app/focus')}>
                Focus
              </Button>
            </motion.div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">

          {/* Focus ring */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.3, delay: 0.12 }}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <p className="text-xs uppercase tracking-widest text-text-tertiary font-medium mb-4">Daily Focus</p>
            <div className="flex items-center justify-center">
              <FocusRing current={focusedToday} goal={dailyFocusGoalMinutes} />
            </div>
          </motion.div>

          {/* Streak */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.3, delay: 0.16 }}
            className="rounded-xl border border-border bg-surface p-4 flex items-center gap-4"
          >
            <div className="h-12 w-12 rounded-xl bg-streak/10 flex items-center justify-center flex-shrink-0">
              <Flame size={24} className="text-streak" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-text-primary">{profile?.streak ?? 0}</p>
              <p className="text-xs text-text-secondary">day streak</p>
            </div>
          </motion.div>

          {/* Active Objectives */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.3, delay: 0.2 }}
            className="rounded-xl border border-border bg-surface"
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-text-primary font-display">Objectives</h3>
              <Link href="/app/tasks?tab=objectives" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
            {activeObjectives.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-text-tertiary">No active objectives.</p>
            ) : (
              <ul className="divide-y divide-border">
                {activeObjectives.map((obj, i) => {
                  const objTasks = tasks.filter((t) => t.objectiveId === obj.id)
                  const completed = objTasks.filter((t) => t.isCompleted).length
                  const pct = objTasks.length > 0 ? (completed / objTasks.length) * 100 : 0
                  const color = OBJECTIVE_COLORS[obj.colorIndex] ?? OBJECTIVE_COLORS[0]
                  return (
                    <li key={obj.id} className="px-4 py-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-sm text-text-primary truncate flex-1">{obj.title}</span>
                        <span className="text-xs text-text-tertiary">{Math.round(pct)}%</span>
                      </div>
                      <ProgressBar value={pct} height="xs" color="" className="[&>div]:bg-primary" />
                    </li>
                  )
                })}
              </ul>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function FocusRing({ current, goal }: { current: number; goal: number }) {
  const size = 120
  const strokeWidth = 10
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const pct = goal > 0 ? Math.min(1, current / goal) : 0
  const offset = circ * (1 - pct)

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2A3E" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#7F77DD"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-bold font-mono text-text-primary">{current}</span>
        <span className="text-[10px] text-text-tertiary">/ {goal} min</span>
      </div>
    </div>
  )
}
