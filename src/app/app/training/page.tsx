'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Dumbbell, ChevronDown, Check } from 'lucide-react'
import { useObjectiveStore } from '@/stores/useObjectiveStore'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

// Training is linked to Objectives of category 'Health'
export default function TrainingPage() {
  const { objectives } = useObjectiveStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const trainingObjectives = objectives.filter((o) => o.category === 'Health')

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display text-text-primary">Training</h2>
          <p className="text-sm text-text-secondary">Health & fitness objectives</p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus size={14} /> Log Workout</Button>
      </div>

      {trainingObjectives.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No training objectives"
          description="Create a Health objective to track your training plans."
        />
      ) : (
        <div className="space-y-3">
          {trainingObjectives.map((obj, i) => (
            <motion.div
              key={obj.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-surface rounded-xl border border-border overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(expandedId === obj.id ? null : obj.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-2 transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Dumbbell size={16} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{obj.title}</p>
                  <p className="text-xs text-text-tertiary">{obj.category}</p>
                </div>
                <ChevronDown
                  size={16}
                  className={cn('text-text-tertiary transition-transform', expandedId === obj.id && 'rotate-180')}
                />
              </button>

              {expandedId === obj.id && (
                <div className="border-t border-border p-4 space-y-3">
                  <ProgressBar value={0} />
                  <p className="text-xs text-text-tertiary">
                    Link tasks to this objective to track workout progress.
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {showNew && <LogWorkoutModal onClose={() => setShowNew(false)} />}
    </div>
  )
}

function LogWorkoutModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a full implementation this would save to Firestore
    onClose()
  }

  return (
    <Modal isOpen onClose={onClose} title="Log Workout">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Workout name" placeholder="e.g. Upper body strength" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        <Input label="Duration (minutes)" type="number" placeholder="45" value={duration} onChange={(e) => setDuration(e.target.value)} />
        <div>
          <label className="text-xs text-text-tertiary uppercase tracking-wide mb-1.5 block">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="How did it go?"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/60 resize-none"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Log Workout</Button>
        </div>
      </form>
    </Modal>
  )
}
