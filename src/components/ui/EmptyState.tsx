'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}
    >
      <div className="h-14 w-14 rounded-2xl bg-surface flex items-center justify-center mb-4 border border-border">
        <Icon size={24} className="text-text-tertiary" />
      </div>
      <h3 className="text-sm font-semibold text-text-primary font-display mb-2">{title}</h3>
      <p className="text-xs text-text-tertiary max-w-xs leading-relaxed mb-4">{description}</p>
      {action}
    </motion.div>
  )
}
