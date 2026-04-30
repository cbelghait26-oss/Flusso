'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  online?: boolean
}

const SIZE_MAP = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
}

const PX_MAP = { xs: 24, sm: 32, md: 40, lg: 48, xl: 64 }

export function Avatar({ src, name, size = 'md', className, online }: AvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  const px = PX_MAP[size]

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center overflow-hidden',
          'bg-primary/20 text-primary font-medium font-body',
          SIZE_MAP[size]
        )}
      >
        {src ? (
          <Image
            src={src}
            alt={name ?? 'Avatar'}
            width={px}
            height={px}
            className="rounded-full object-cover w-full h-full"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface',
            online ? 'bg-success' : 'bg-text-tertiary'
          )}
        />
      )}
    </div>
  )
}
