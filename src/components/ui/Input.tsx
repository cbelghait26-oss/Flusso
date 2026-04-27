'use client'

import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightIcon, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-text-tertiary pointer-events-none">{leftIcon}</span>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary',
              'focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all duration-200',
              !!leftIcon && 'pl-9',
              !!rightIcon && 'pr-9',
              error && 'border-danger/60 focus:border-danger focus:ring-danger/20',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 text-text-tertiary">{rightIcon}</span>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
