'use client'

import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'primary'
  className?: string
  style?: React.CSSProperties
}

export function Badge({ children, variant = 'default', className, style }: BadgeProps) {
  const variants = {
    default: 'bg-surface-2 text-text-secondary border-border',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
    primary: 'bg-primary/10 text-primary border-primary/20',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        variants[variant],
        className
      )}
      style={style}
    >
      {children}
    </span>
  )
}
