'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, CheckSquare, Target, LayoutDashboard, Timer, CalendarDays, Dumbbell, BarChart3, Users, Settings, Plus, ArrowRight } from 'lucide-react'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { useTaskStore } from '@/stores/useTaskStore'
import { useObjectiveStore } from '@/stores/useObjectiveStore'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  type: 'action' | 'task' | 'objective' | 'navigate'
  label: string
  sublabel?: string
  icon: React.ReactNode
  onSelect: () => void
}

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { tasks } = useTaskStore()
  const { objectives } = useObjectiveStore()

  const actions: CommandItem[] = [
    {
      id: 'new-task',
      type: 'action',
      label: 'New Task',
      icon: <Plus size={14} />,
      onSelect: () => { router.push('/app/tasks?new=1'); close() },
    },
    {
      id: 'start-focus',
      type: 'action',
      label: 'Start Focus Session',
      icon: <Timer size={14} />,
      onSelect: () => { router.push('/app/focus'); close() },
    },
    {
      id: 'new-event',
      type: 'action',
      label: 'New Calendar Event',
      icon: <CalendarDays size={14} />,
      onSelect: () => { router.push('/app/calendar?new=1'); close() },
    },
    {
      id: 'new-objective',
      type: 'action',
      label: 'New Objective',
      icon: <Target size={14} />,
      onSelect: () => { router.push('/app/tasks?tab=objectives&new=1'); close() },
    },
  ]

  const navItems: CommandItem[] = [
    { id: 'nav-dashboard', type: 'navigate', label: 'Dashboard', icon: <LayoutDashboard size={14} />, onSelect: () => { router.push('/app/dashboard'); close() } },
    { id: 'nav-tasks', type: 'navigate', label: 'Tasks', icon: <CheckSquare size={14} />, onSelect: () => { router.push('/app/tasks'); close() } },
    { id: 'nav-focus', type: 'navigate', label: 'Focus', icon: <Timer size={14} />, onSelect: () => { router.push('/app/focus'); close() } },
    { id: 'nav-calendar', type: 'navigate', label: 'Calendar', icon: <CalendarDays size={14} />, onSelect: () => { router.push('/app/calendar'); close() } },
    { id: 'nav-training', type: 'navigate', label: 'Training', icon: <Dumbbell size={14} />, onSelect: () => { router.push('/app/training'); close() } },
    { id: 'nav-analytics', type: 'navigate', label: 'Analytics', icon: <BarChart3 size={14} />, onSelect: () => { router.push('/app/analytics'); close() } },
    { id: 'nav-social', type: 'navigate', label: 'Social', icon: <Users size={14} />, onSelect: () => { router.push('/app/social'); close() } },
    { id: 'nav-settings', type: 'navigate', label: 'Settings', icon: <Settings size={14} />, onSelect: () => { router.push('/app/settings'); close() } },
  ]

  const taskItems: CommandItem[] = tasks
    .filter((t) => !t.isCompleted)
    .slice(0, 20)
    .map((t) => ({
      id: `task-${t.id}`,
      type: 'task' as const,
      label: t.title,
      icon: <CheckSquare size={14} />,
      onSelect: () => { router.push(`/app/tasks?task=${t.id}`); close() },
    }))

  const objectiveItems: CommandItem[] = objectives.map((o) => ({
    id: `obj-${o.id}`,
    type: 'objective' as const,
    label: o.title,
    sublabel: o.category,
    icon: <Target size={14} />,
    onSelect: () => { router.push(`/app/tasks?tab=objectives&obj=${o.id}`); close() },
  }))

  const lq = query.toLowerCase()
  const allItems: CommandItem[] = [
    ...(query ? [] : actions),
    ...(query ? [] : navItems),
    ...taskItems.filter((i) => i.label.toLowerCase().includes(lq)),
    ...objectiveItems.filter((i) => i.label.toLowerCase().includes(lq)),
    ...(query ? actions.filter((i) => i.label.toLowerCase().includes(lq)) : []),
    ...(query ? navItems.filter((i) => i.label.toLowerCase().includes(lq)) : []),
  ]

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        allItems[selectedIndex]?.onSelect()
      } else if (e.key === 'Escape') {
        close()
      }
    },
    [allItems, selectedIndex, close]
  )

  const grouped = {
    action: allItems.filter((i) => i.type === 'action'),
    navigate: allItems.filter((i) => i.type === 'navigate'),
    task: allItems.filter((i) => i.type === 'task'),
    objective: allItems.filter((i) => i.type === 'objective'),
  }

  const renderGroup = (label: string, items: CommandItem[]) => {
    if (items.length === 0) return null
    return (
      <div key={label}>
        <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-text-tertiary font-medium">
          {label}
        </p>
        {items.map((item) => {
          const idx = allItems.indexOf(item)
          return (
            <button
              key={item.id}
              onClick={item.onSelect}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-100',
                idx === selectedIndex
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              <span className="flex-shrink-0 text-text-tertiary">{item.icon}</span>
              <span className="flex-1 text-left truncate">{item.label}</span>
              {item.sublabel && (
                <span className="text-xs text-text-tertiary">{item.sublabel}</span>
              )}
              {idx === selectedIndex && <ArrowRight size={12} className="flex-shrink-0" />}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/4 z-50 -translate-x-1/2 w-full max-w-lg bg-surface-2 border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search size={16} className="text-text-tertiary flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search tasks, navigate, actions..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
              />
              <kbd className="text-[10px] text-text-tertiary bg-surface px-1.5 py-0.5 rounded border border-border">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 flex flex-col gap-1">
              {allItems.length === 0 ? (
                <p className="text-center text-sm text-text-tertiary py-8">No results</p>
              ) : (
                <>
                  {renderGroup('Actions', grouped.action)}
                  {renderGroup('Navigate', grouped.navigate)}
                  {renderGroup('Tasks', grouped.task)}
                  {renderGroup('Objectives', grouped.objective)}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
