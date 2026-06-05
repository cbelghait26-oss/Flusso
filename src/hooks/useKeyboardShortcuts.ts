'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCommandPalette } from './useCommandPalette'
import { useTaskStore } from '@/stores/useTaskStore'
import { useFocusStore } from '@/stores/useFocusStore'

export function useKeyboardShortcuts() {
  const router = useRouter()
  const { toggle: togglePalette } = useCommandPalette()
  const { isActive } = useFocusStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable

      // Cmd+K → command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        togglePalette()
        return
      }

      // Escape is handled by individual modal components

      if (isInput) return

      // Number keys 1-7 → navigate
      const navMap: Record<string, string> = {
        '1': '/app/dashboard',
        '2': '/app/tasks',
        '3': '/app/focus',
        '4': '/app/calendar',
        '5': '/app/training',
        '6': '/app/analytics',
        '7': '/app/social',
      }
      if (navMap[e.key] && !e.metaKey && !e.ctrlKey && !e.altKey) {
        router.push(navMap[e.key])
        return
      }

      // T → new task
      if (e.key === 't' || e.key === 'T') {
        router.push('/app/tasks?new=1')
        return
      }

      // F → start focus
      if (e.key === 'f' || e.key === 'F') {
        router.push('/app/focus')
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router, togglePalette])
}
