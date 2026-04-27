'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthService } from '@/services/AuthService'
import { useAuthStore } from '@/stores/useAuthStore'
import { cn } from '@/lib/utils'

const REASONS = [
  { id: 'focus', label: 'Improve my focus' },
  { id: 'goals', label: 'Achieve my goals' },
  { id: 'habits', label: 'Build better habits' },
  { id: 'time', label: 'Manage my time' },
  { id: 'productivity', label: 'Boost productivity' },
  { id: 'mindset', label: 'Build a success mindset' },
]

const FOCUS_GOALS = [30, 60, 120, 180]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [focusGoal, setFocusGoal] = useState<number | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { user } = useAuthStore()

  const direction = 1

  const handleComplete = async () => {
    if (!user) return
    setLoading(true)
    try {
      await AuthService.saveUserSettings(user.uid, {
        onboardingComplete: true,
        onboardingName: name,
        onboardingReason: reason ?? '',
        dailyFocusGoalMinutes: focusGoal ?? 60,
        timeFormat: '24h',
        notificationsEnabled: false,
      })
      router.replace('/app/paywall')
    } finally {
      setLoading(false)
    }
  }

  const canNext = (step === 1 && name.trim().length > 0) ||
    (step === 2 && focusGoal !== null) ||
    (step === 3 && reason !== null)

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-8">
          <Image src="/assets/flusso-mark.svg" alt="Flusso" width={40} height={40} />
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                'flex-1 h-1 rounded-full transition-all duration-300',
                s <= step ? 'bg-primary' : 'bg-border'
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold font-display text-text-primary mb-2">What's your name?</h2>
                <p className="text-sm text-text-secondary">We'll personalize your experience.</p>
              </div>
              <Input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canNext && setStep(2)}
                autoFocus
              />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold font-display text-text-primary mb-2">Daily focus goal</h2>
                <p className="text-sm text-text-secondary">How many minutes per day?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {FOCUS_GOALS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setFocusGoal(g)}
                    className={cn(
                      'py-3 rounded-xl border text-sm font-medium transition-all duration-200',
                      focusGoal === g
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-surface border-border text-text-secondary hover:border-primary/40 hover:text-text-primary'
                    )}
                  >
                    {g} min
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold font-display text-text-primary mb-2">Why are you here?</h2>
                <p className="text-sm text-text-secondary">Choose what resonates most.</p>
              </div>
              <div className="space-y-2">
                {REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setReason(r.id)}
                    className={cn(
                      'w-full text-left py-3 px-4 rounded-xl border text-sm font-medium transition-all duration-200',
                      reason === r.id
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-surface border-border text-text-secondary hover:border-primary/40 hover:text-text-primary'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} className="flex-1">
              Back
            </Button>
          )}
          <Button
            className="flex-1"
            disabled={!canNext}
            loading={loading}
            onClick={() => {
              if (step < 3) setStep((s) => s + 1)
              else handleComplete()
            }}
          >
            {step === 3 ? 'Get started' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  )
}
