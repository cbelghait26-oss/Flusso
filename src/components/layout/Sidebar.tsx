'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  CheckSquare,
  Timer,
  CalendarDays,
  Dumbbell,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { Avatar } from '@/components/ui/Avatar'
import Image from 'next/image'

const NAV_ITEMS = [
  { href: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard', key: '1' },
  { href: '/app/tasks', icon: CheckSquare, label: 'Tasks', key: '2' },
  { href: '/app/focus', icon: Timer, label: 'Focus', key: '3' },
  { href: '/app/calendar', icon: CalendarDays, label: 'Calendar', key: '4' },
  { href: '/app/training', icon: Dumbbell, label: 'Training', key: '5' },
  { href: '/app/analytics', icon: BarChart3, label: 'Analytics', key: '6' },
  { href: '/app/social', icon: Users, label: 'Social', key: '7' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { profile } = useAuthStore()

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex-shrink-0 hidden md:flex flex-col h-full bg-surface border-r border-border overflow-hidden"
    >
      {/* Logo */}
      <div className={cn('flex items-center h-14 px-4 border-b border-border gap-3', collapsed && 'justify-center px-0')}>
        <div className="h-7 w-7 flex-shrink-0">
          <Image src="/assets/flusso-mark.svg" alt="Flusso" width={28} height={28} />
        </div>
        {!collapsed && (
          <span className="text-sm font-bold font-display text-text-primary tracking-wide">
            Flusso
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label, key }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? `${label} (${key})` : undefined}
              className={cn(
                'group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 relative',
                'text-text-secondary hover:text-text-primary hover:bg-surface-2',
                isActive && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                collapsed && 'justify-center px-0 py-2.5'
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium">{label}</span>
              )}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full"
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: Settings + User */}
      <div className="px-2 pb-4 flex flex-col gap-1 border-t border-border pt-3">
        <Link
          href="/app/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
            'text-text-secondary hover:text-text-primary hover:bg-surface-2',
            pathname === '/app/settings' && 'bg-primary/10 text-primary',
            collapsed && 'justify-center px-0'
          )}
        >
          <Settings size={18} />
          {!collapsed && <span className="text-sm font-medium">Settings</span>}
        </Link>

        {!collapsed && profile && (
          <div className="flex items-center gap-3 px-3 py-2 mt-1">
            <Avatar src={profile.photoURL} name={profile.displayName} size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{profile.displayName}</p>
              <p className="text-xs text-text-tertiary">#{profile.friendTag}</p>
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-16 z-10 h-6 w-6 rounded-full bg-surface border border-border flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  )
}
