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
import { TaskService } from '@/services/TaskService'
import { ObjectiveService } from '@/services/ObjectiveService'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Spinner } from '@/components/ui/Spinner'

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
  const { user, settings, loading, isPremium } = useAuthStore()
  const { setTasks } = useTaskStore()
  const { setObjectives } = useObjectiveStore()

  useKeyboardShortcuts()

  // Auth guard
  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/signin')
      return
    }
    if (settings && !settings.onboardingComplete) {
      router.replace('/app/onboarding')
      return
    }
    if (!isPremium && pathname !== '/app/paywall' && pathname !== '/app/onboarding') {
      router.replace('/app/paywall')
    }
  }, [user, settings, loading, isPremium, pathname, router])

  // Subscribe to real-time data
  useEffect(() => {
    if (!user) return
    const unsubTasks = TaskService.subscribe(user.uid, setTasks)
    const unsubObjectives = ObjectiveService.subscribe(user.uid, setObjectives)
    return () => {
      unsubTasks()
      unsubObjectives()
    }
  }, [user, setTasks, setObjectives])

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) return null

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
