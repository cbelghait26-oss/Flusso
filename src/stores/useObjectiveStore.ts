import { create } from 'zustand'
import { Objective } from '@/types/models'

interface ObjectiveState {
  objectives: Objective[]
  setObjectives: (objectives: Objective[]) => void
  addObjective: (objective: Objective) => void
  updateObjective: (id: string, updates: Partial<Objective>) => void
  removeObjective: (id: string) => void
  reset: () => void
}

export const useObjectiveStore = create<ObjectiveState>((set) => ({
  objectives: [],
  setObjectives: (objectives) => set({ objectives }),
  addObjective: (objective) =>
    set((s) => ({ objectives: [objective, ...s.objectives] })),
  updateObjective: (id, updates) =>
    set((s) => ({
      objectives: s.objectives.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      ),
    })),
  removeObjective: (id) =>
    set((s) => ({
      objectives: s.objectives.filter((o) => o.id !== id),
    })),
  reset: () => set({ objectives: [] }),
}))
