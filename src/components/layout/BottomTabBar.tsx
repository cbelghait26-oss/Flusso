'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CheckSquare, Timer, CalendarDays, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/app/dashboard', icon: LayoutDashboard, label: 'Home' },
  { href: '/app/tasks', icon: CheckSquare, label: 'Tasks' },
  { href: '/app/focus', icon: Timer, label: 'Focus' },
  { href: '/app/calendar', icon: CalendarDays, label: 'Calendar' },
  { href: '/app/social', icon: Users, label: 'Social' },
]

export function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border safe-area-bottom">
      <div className="flex items-center">
        {TABS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 transition-all duration-200',
                isActive ? 'text-primary' : 'text-text-tertiary'
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
