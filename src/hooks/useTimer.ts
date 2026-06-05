'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useFocusStore } from '@/stores/useFocusStore'

export function useTimer(onSessionComplete: () => void) {
  const { isActive, isPaused, mode, secondsLeft, tick, endSession } = useFocusStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastTickRef = useRef<number>(Date.now())

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Catch-up on visibility change (tab returns from background)
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && isActive && !isPaused) {
        const now = Date.now()
        const elapsed = Math.floor((now - lastTickRef.current) / 1000)
        if (elapsed > 1) {
          // Apply missed ticks
          for (let i = 0; i < elapsed - 1; i++) {
            tick()
          }
        }
        lastTickRef.current = now
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [isActive, isPaused, tick])

  useEffect(() => {
    if (!isActive || isPaused) {
      clearTimer()
      return
    }

    lastTickRef.current = Date.now()
    intervalRef.current = setInterval(() => {
      lastTickRef.current = Date.now()
      tick()
    }, 1000)

    return clearTimer
  }, [isActive, isPaused, clearTimer, tick])

  // Detect session / phase completion (pomodoro / timer)
  useEffect(() => {
    if (isActive && !isPaused && mode !== 'stopwatch' && secondsLeft === 0) {
      clearTimer()
      onSessionComplete()
    }
  }, [secondsLeft, isActive, isPaused, mode, onSessionComplete, clearTimer])

  return null
}
