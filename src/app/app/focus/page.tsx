'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, SkipForward, Square, Volume2, VolumeX } from 'lucide-react'
import { useFocusStore, FocusScene, TimerMode } from '@/stores/useFocusStore'
import { useTaskStore } from '@/stores/useTaskStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTimer } from '@/hooks/useTimer'
import { FocusService } from '@/services/FocusService'
import { Button } from '@/components/ui/Button'
import { formatTimer, cn } from '@/lib/utils'
import { Timestamp } from 'firebase/firestore'

const SCENES: { id: FocusScene; label: string; gradient: string }[] = [
  { id: 'mountain', label: 'Mountain', gradient: 'from-slate-900 via-blue-950 to-slate-800' },
  { id: 'forest', label: 'Forest', gradient: 'from-green-950 via-emerald-900 to-slate-900' },
  { id: 'ocean', label: 'Ocean', gradient: 'from-teal-950 via-cyan-900 to-slate-900' },
  { id: 'space', label: 'Space', gradient: 'from-black via-indigo-950 to-black' },
  { id: 'skyline', label: 'Skyline', gradient: 'from-purple-950 via-slate-900 to-blue-950' },
]

export default function FocusPage() {
  const { isActive } = useFocusStore()
  return isActive ? <ActiveSession /> : <ConfigScreen />
}

// ─── Config Screen ────────────────────────────────────────────────────────────

function ConfigScreen() {
  const {
    scene, mode, focusDurationMinutes, breakDurationMinutes, ambientOn, taskId,
    setScene, setMode, setFocusDuration, setBreakDuration, setAmbientOn, setTaskId, startSession,
  } = useFocusStore()
  const { tasks } = useTaskStore()
  const myTasks = tasks.filter((t) => !t.isCompleted && (t.isMyDay || t.importance >= 3))

  const MODES: { value: TimerMode; label: string }[] = [
    { value: 'pomodoro', label: 'Pomodoro' },
    { value: 'timer', label: 'Timer' },
    { value: 'stopwatch', label: 'Stopwatch' },
  ]

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold font-display text-text-primary">Start Focusing</h2>
          <p className="text-sm text-text-secondary mt-1">Configure your session</p>
        </div>

        {/* Scene picker */}
        <div>
          <p className="text-xs text-text-tertiary uppercase tracking-wide mb-3">Scene</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {SCENES.map((s) => (
              <button
                key={s.id}
                onClick={() => setScene(s.id)}
                className={cn(
                  'flex-shrink-0 h-20 w-28 rounded-xl bg-gradient-to-br transition-all duration-200 relative overflow-hidden',
                  s.gradient,
                  scene === s.id && 'ring-2 ring-primary'
                )}
              >
                <span className="absolute bottom-2 left-0 right-0 text-center text-xs font-medium text-white/80">
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Timer mode */}
        <div>
          <p className="text-xs text-text-tertiary uppercase tracking-wide mb-3">Mode</p>
          <div className="flex gap-1 bg-surface rounded-xl p-1 border border-border">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  mode === m.value ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration pickers (Pomodoro / Timer) */}
        {mode !== 'stopwatch' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wide mb-2">Focus ({focusDurationMinutes} min)</p>
              <input
                type="range"
                min={5} max={90} step={5}
                value={focusDurationMinutes}
                onChange={(e) => setFocusDuration(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            {mode === 'pomodoro' && (
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wide mb-2">Break ({breakDurationMinutes} min)</p>
                <input
                  type="range"
                  min={1} max={30} step={1}
                  value={breakDurationMinutes}
                  onChange={(e) => setBreakDuration(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            )}
          </div>
        )}

        {/* Task selector */}
        <div>
          <p className="text-xs text-text-tertiary uppercase tracking-wide mb-2">Task (optional)</p>
          <select
            value={taskId ?? ''}
            onChange={(e) => setTaskId(e.target.value || null)}
            className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary/60"
          >
            <option value="">No task selected</option>
            {myTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>

        {/* Ambient sound */}
        <div className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-3">
          <span className="text-sm text-text-primary">Ambient sound</span>
          <button
            onClick={() => setAmbientOn(!ambientOn)}
            className={cn(
              'w-12 h-6 rounded-full transition-all duration-200 relative',
              ambientOn ? 'bg-primary' : 'bg-border'
            )}
          >
            <span className={cn(
              'absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-200',
              ambientOn ? 'left-7' : 'left-1'
            )} />
          </button>
        </div>

        {/* Start button */}
        <Button
          size="lg"
          className="w-full"
          onClick={() => startSession({ mode, scene, taskId, focusDuration: focusDurationMinutes, breakDuration: breakDurationMinutes, ambientOn })}
        >
          <Play size={16} /> Start Focus
        </Button>
      </div>
    </div>
  )
}

// ─── Active Session ───────────────────────────────────────────────────────────

function ActiveSession() {
  const {
    mode, scene, phase, secondsLeft, elapsedSeconds, taskId, sessionCount, ambientOn,
    isPaused, pause, resume, endSession, nextPhase, focusDurationMinutes, setAmbientOn,
  } = useFocusStore()
  const { tasks } = useTaskStore()
  const { user } = useAuthStore()
  const [showComplete, setShowComplete] = useState(false)
  const [completedSeconds, setCompletedSeconds] = useState(0)

  const task = tasks.find((t) => t.id === taskId)
  const sceneConfig = SCENES.find((s) => s.id === scene)

  const handlePhaseComplete = useCallback(async () => {
    if (phase === 'work') {
      setCompletedSeconds(elapsedSeconds)
      if (mode === 'pomodoro') {
        nextPhase()
      } else {
        // Timer/stopwatch — show complete overlay
        setShowComplete(true)
        if (user) {
          await FocusService.saveFocusSession(user.uid, {
            duration: elapsedSeconds,
            taskId: taskId ?? null,
            startTime: Timestamp.fromMillis(Date.now() - elapsedSeconds * 1000),
            endTime: Timestamp.now(),
          })
        }
      }
    } else {
      nextPhase() // break → work
    }
  }, [phase, mode, elapsedSeconds, taskId, user, nextPhase])

  useTimer(handlePhaseComplete)

  const handleEnd = async () => {
    if (user && elapsedSeconds > 0) {
      await FocusService.saveFocusSession(user.uid, {
        duration: elapsedSeconds,
        taskId: taskId ?? null,
        startTime: Timestamp.fromMillis(Date.now() - elapsedSeconds * 1000),
        endTime: Timestamp.now(),
      })
    }
    setShowComplete(true)
    setCompletedSeconds(elapsedSeconds)
  }

  const displayTime = mode === 'stopwatch' ? formatTimer(elapsedSeconds) : formatTimer(secondsLeft)

  return (
    <div className={cn('min-h-full flex flex-col bg-gradient-to-br', sceneConfig?.gradient)}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-6">
        <span className="text-sm text-white/60 font-medium">
          {mode === 'pomodoro' ? `Pomodoro — ${phase === 'work' ? 'Work Phase' : 'Break'}` : mode === 'timer' ? 'Timer' : 'Stopwatch'}
        </span>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span>Session {sessionCount + 1}</span>
        </div>
      </div>

      {/* Center timer */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <motion.span
          key={displayTime}
          className="font-mono text-white leading-none select-none"
          style={{ fontSize: 'clamp(64px, 15vw, 128px)' }}
        >
          {displayTime}
        </motion.span>
        {task && (
          <p className="text-white/50 text-sm">{task.title}</p>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={() => isPaused ? resume() : pause()}
            className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all duration-200"
          >
            {isPaused ? <Play size={22} /> : <Pause size={22} />}
          </button>
          {mode === 'pomodoro' && (
            <button
              onClick={() => nextPhase()}
              className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 transition-all duration-200"
            >
              <SkipForward size={16} />
            </button>
          )}
          <button
            onClick={handleEnd}
            className="h-10 w-10 rounded-full bg-white/5 hover:bg-danger/20 border border-white/10 hover:border-danger/30 flex items-center justify-center text-white/60 hover:text-danger transition-all duration-200"
          >
            <Square size={16} />
          </button>
        </div>
      </div>

      {/* Bottom: ambient toggle */}
      <div className="flex items-center justify-between px-6 pb-6">
        <button
          onClick={() => setAmbientOn(!ambientOn)}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          {ambientOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          Ambient
        </button>
      </div>

      {/* Completion overlay */}
      <AnimatePresence>
        {showComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-6"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
              className="text-center space-y-2"
            >
              <div className="text-4xl">🎉</div>
              <h2 className="text-2xl font-bold font-display text-white">Session Complete</h2>
              <p className="text-white/60 text-sm">{Math.floor(completedSeconds / 60)} min focused</p>
            </motion.div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => { setShowComplete(false); endSession() }}>
                Done
              </Button>
              <Button onClick={() => { setShowComplete(false) }}>
                Start Another
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
