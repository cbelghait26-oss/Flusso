import { create } from 'zustand'

export type TimerMode = 'pomodoro' | 'timer' | 'stopwatch'
export type FocusScene = 'mountain' | 'forest' | 'ocean' | 'space' | 'skyline'
export type SessionPhase = 'work' | 'break'

interface FocusState {
  isActive: boolean
  isPaused: boolean
  mode: TimerMode
  scene: FocusScene
  phase: SessionPhase
  secondsLeft: number
  totalSeconds: number
  elapsedSeconds: number
  taskId: string | null
  sessionCount: number
  ambientOn: boolean
  focusDurationMinutes: number
  breakDurationMinutes: number
  // actions
  startSession: (opts: {
    mode: TimerMode
    scene: FocusScene
    taskId: string | null
    focusDuration: number
    breakDuration: number
    ambientOn: boolean
  }) => void
  pause: () => void
  resume: () => void
  tick: () => void
  endSession: () => void
  setScene: (scene: FocusScene) => void
  setMode: (mode: TimerMode) => void
  setFocusDuration: (mins: number) => void
  setBreakDuration: (mins: number) => void
  setAmbientOn: (on: boolean) => void
  setTaskId: (id: string | null) => void
  nextPhase: () => void
}

export const useFocusStore = create<FocusState>((set, get) => ({
  isActive: false,
  isPaused: false,
  mode: 'pomodoro',
  scene: 'mountain',
  phase: 'work',
  secondsLeft: 25 * 60,
  totalSeconds: 25 * 60,
  elapsedSeconds: 0,
  taskId: null,
  sessionCount: 0,
  ambientOn: false,
  focusDurationMinutes: 25,
  breakDurationMinutes: 5,

  startSession: ({ mode, scene, taskId, focusDuration, breakDuration, ambientOn }) => {
    const total = mode === 'stopwatch' ? 0 : focusDuration * 60
    set({
      isActive: true,
      isPaused: false,
      mode,
      scene,
      phase: 'work',
      secondsLeft: total,
      totalSeconds: total,
      elapsedSeconds: 0,
      taskId,
      ambientOn,
      focusDurationMinutes: focusDuration,
      breakDurationMinutes: breakDuration,
    })
  },

  pause: () => set({ isPaused: true }),
  resume: () => set({ isPaused: false }),

  tick: () => {
    const { mode, secondsLeft, elapsedSeconds } = get()
    if (mode === 'stopwatch') {
      set({ elapsedSeconds: elapsedSeconds + 1 })
    } else {
      if (secondsLeft > 0) {
        set({ secondsLeft: secondsLeft - 1, elapsedSeconds: elapsedSeconds + 1 })
      }
    }
  },

  nextPhase: () => {
    const { phase, focusDurationMinutes, breakDurationMinutes, sessionCount } = get()
    if (phase === 'work') {
      set({
        phase: 'break',
        secondsLeft: breakDurationMinutes * 60,
        totalSeconds: breakDurationMinutes * 60,
        elapsedSeconds: 0,
        sessionCount: sessionCount + 1,
      })
    } else {
      set({
        phase: 'work',
        secondsLeft: focusDurationMinutes * 60,
        totalSeconds: focusDurationMinutes * 60,
        elapsedSeconds: 0,
      })
    }
  },

  endSession: () =>
    set({
      isActive: false,
      isPaused: false,
      phase: 'work',
      secondsLeft: get().focusDurationMinutes * 60,
      totalSeconds: get().focusDurationMinutes * 60,
      elapsedSeconds: 0,
    }),

  setScene: (scene) => set({ scene }),
  setMode: (mode) => set({ mode }),
  setFocusDuration: (mins) =>
    set({ focusDurationMinutes: mins, secondsLeft: mins * 60, totalSeconds: mins * 60 }),
  setBreakDuration: (mins) => set({ breakDurationMinutes: mins }),
  setAmbientOn: (on) => set({ ambientOn: on }),
  setTaskId: (id) => set({ taskId: id }),
}))
