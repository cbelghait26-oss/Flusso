'use client'

import { Bell, Command } from 'lucide-react'
import { useFocusStore } from '@/stores/useFocusStore'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { formatTimer } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
  const { isActive, secondsLeft, mode, elapsedSeconds } = useFocusStore()
  const { open } = useCommandPalette()

  const displayTime = mode === 'stopwatch' ? formatTimer(elapsedSeconds) : formatTimer(secondsLeft)

  return (
    <header className="h-14 flex items-center px-4 md:px-6 border-b border-border bg-surface/80 backdrop-blur-sm flex-shrink-0 gap-4">
      <h1 className="text-sm font-semibold text-text-primary font-display flex-1">{title}</h1>

      <div className="flex items-center gap-2">
        {/* Focus status pill */}
        {isActive && (
          <div className="flex items-center gap-1.5 bg-danger/10 border border-danger/20 text-danger rounded-full px-3 py-1 text-xs font-medium font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
            Focusing · {displayTime}
          </div>
        )}

        {/* Command palette trigger */}
        <button
          onClick={open}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-surface-2 border border-border text-text-tertiary hover:text-text-primary hover:border-primary/30 transition-all duration-200 text-xs"
        >
          <Command size={12} />
          <span className="hidden sm:inline">K</span>
        </button>

        {/* Notifications */}
        <button className="h-8 w-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-all duration-200 relative">
          <Bell size={16} />
        </button>
      </div>
    </header>
  )
}
