'use client'

import { useAuth } from '@/hooks/useAuth'

export function Providers({ children }: { children: React.ReactNode }) {
  // Initialize auth listener globally
  useAuth()
  return <>{children}</>
}
