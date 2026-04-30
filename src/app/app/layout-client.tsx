'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { BottomTabBar } from '@/components/layout/BottomTabBar'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTaskStore } from '@/stores/useTaskStore'
import { useObjectiveStore } from '@/stores/useObjectiveStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Spinner } from '@/components/ui/Spinner'
import { Timestamp } from 'firebase/firestore'

// ─── Preview mode — bypasses auth with mock data ───────────────────────────
const PREVIEW_MODE = false

const PAGE_TITLES: Record<string, string> = {
  '/app/dashboard': 'Dashboard',
  '/app/tasks': 'Tasks',
  '/app/focus': 'Focus',
  '/app/calendar': 'Calendar',
  '/app/training': 'Training',
  '/app/analytics': 'Analytics',
  '/app/social': 'Social',
  '/app/settings': 'Settings',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { user, settings, loading, isPremium, setUser, setProfile, setSettings, setIsPremium } = useAuthStore()
  const { setTasks } = useTaskStore()
  const { setObjectives } = useObjectiveStore()

  useKeyboardShortcuts()

  // Seed mock data in preview mode
  useEffect(() => {
    if (!PREVIEW_MODE) return
    setUser({ uid: 'preview', displayName: 'Demo User', email: 'demo@flusso.app', photoURL: null } as any)
    setProfile({ uid: 'preview', displayName: 'Demo User', friendTag: 'demo#0001', photoURL: null, streak: 7, totalFocusMinutes: 1240 })
    setSettings({ dailyFocusGoalMinutes: 60, timeFormat: '12h', onboardingComplete: true, notificationsEnabled: true })
    setIsPremium(true)
    const now = Timestamp.now()
    setTasks([
      { id: '1', title: 'Review design system tokens', notes: '', isCompleted: false, isMyDay: true, importance: 3, deadline: Timestamp.fromDate(new Date()), objectiveId: 'obj1', sortOrder: 1, userId: 'preview', createdAt: now, updatedAt: now },
      { id: '2', title: 'Write unit tests for auth flow', notes: '', isCompleted: false, isMyDay: true, importance: 2, deadline: null, objectiveId: 'obj1', sortOrder: 2, userId: 'preview', createdAt: now, updatedAt: now },
      { id: '3', title: 'Update landing page copy', notes: '', isCompleted: true, isMyDay: false, importance: 1, deadline: null, objectiveId: 'obj2', sortOrder: 3, userId: 'preview', createdAt: now, updatedAt: now },
      { id: '4', title: 'Ship mobile onboarding v2', notes: '', isCompleted: false, isMyDay: false, importance: 4, deadline: Timestamp.fromDate(new Date(Date.now() + 86400000 * 2)), objectiveId: 'obj2', sortOrder: 4, userId: 'preview', createdAt: now, updatedAt: now },
      { id: '5', title: 'Run 5k', notes: '', isCompleted: false, isMyDay: true, importance: 2, deadline: null, objectiveId: 'obj3', sortOrder: 5, userId: 'preview', createdAt: now, updatedAt: now },
    ])
    setObjectives([
      { id: 'obj1', title: 'Launch Flusso Web App', category: 'Career', colorIndex: 0, tasks: [], targetDate: null, isCompleted: false, userId: 'preview' },
      { id: 'obj2', title: 'Grow Mobile User Base', category: 'Career', colorIndex: 2, tasks: [], targetDate: null, isCompleted: false, userId: 'preview' },
      { id: 'obj3', title: 'Get fit this summer', category: 'Health', colorIndex: 1, tasks: [], targetDate: null, isCompleted: false, userId: 'preview' },
    ])
  }, [])

  // Auth guard (skipped in preview mode)
  useEffect(() => {
    if (PREVIEW_MODE) return
    if (loading) return
    if (!user) { router.replace('/signin'); return }
    if (settings && !settings.onboardingComplete) { router.replace('/app/onboarding'); return }
    if (!isPremium && pathname !== '/app/paywall' && pathname !== '/app/onboarding') { router.replace('/app/paywall') }
  }, [user, settings, loading, isPremium, pathname, router])

  if (loading && !PREVIEW_MODE) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user && !PREVIEW_MODE) return null

  const pageTitle = Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ?? 'Flusso'

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((c) => !c)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar title={pageTitle} />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <BottomTabBar />
      <CommandPalette />
    </div>
  )
}
