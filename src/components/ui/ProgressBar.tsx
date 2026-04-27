'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number // 0-100
  className?: string
  color?: string
  animated?: boolean
  height?: 'xs' | 'sm' | 'md'
}

const HEIGHT_MAP = { xs: 'h-1', sm: 'h-1.5', md: 'h-2' }

export function ProgressBar({
  value,
  className,
  color = 'bg-primary',
  animated = true,
  height = 'sm',
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      className={cn(
        'w-full bg-surface rounded-full overflow-hidden',
        HEIGHT_MAP[height],
        className
      )}
    >
      <motion.div
        className={cn('h-full rounded-full', color)}
        initial={animated ? { width: 0 } : { width: `${clamped}%` }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  )
}
