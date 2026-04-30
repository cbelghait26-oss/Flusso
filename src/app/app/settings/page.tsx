'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Settings2, Trophy, Camera, LogOut, Trash2, ChevronRight, Check } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { AuthService } from '@/services/AuthService'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { updateProfile } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

type SettingsTab = 'profile' | 'preferences' | 'achievements'

const ACHIEVEMENTS = [
  { id: 'first_focus', title: 'First Focus', description: 'Complete your first focus session', icon: '🎯' },
  { id: 'streak_3', title: '3-Day Streak', description: '3 consecutive days of focus', icon: '🔥' },
  { id: 'streak_7', title: 'Week Warrior', description: '7-day streak', icon: '⚡' },
  { id: 'streak_30', title: 'Iron Focus', description: '30-day streak', icon: '🛡️' },
  { id: 'tasks_10', title: 'Task Slayer', description: 'Complete 10 tasks', icon: '✅' },
  { id: 'tasks_50', title: 'Productivity Pro', description: 'Complete 50 tasks', icon: '💪' },
  { id: 'tasks_100', title: 'Century Mark', description: 'Complete 100 tasks', icon: '💯' },
  { id: 'focus_60', title: 'Deep Focus', description: '60+ min in one session', icon: '🧠' },
  { id: 'focus_120', title: 'Flow State', description: '120+ min in one session', icon: '🌊' },
  { id: 'pomodoro_5', title: 'Tomato Garden', description: 'Complete 5 pomodoros', icon: '🍅' },
  { id: 'pomodoro_25', title: 'Pomador', description: '25 total pomodoros', icon: '🏆' },
  { id: 'objective_1', title: 'Goal Setter', description: 'Create your first objective', icon: '🎖️' },
  { id: 'objective_complete', title: 'Accomplished', description: 'Complete an objective', icon: '⭐' },
  { id: 'social_1', title: 'Social Butterfly', description: 'Add your first friend', icon: '🦋' },
  { id: 'social_leaderboard', title: 'On the Board', description: 'Reach the top 3 weekly', icon: '📊' },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('profile')
  const { user, profile, settings } = useAuthStore()

  const TABS: { value: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { value: 'profile', label: 'Profile', icon: <User size={14} /> },
    { value: 'preferences', label: 'Preferences', icon: <Settings2 size={14} /> },
    { value: 'achievements', label: 'Achievements', icon: <Trophy size={14} /> },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-4 md:px-6 pt-4 border-b border-border pb-0">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium capitalize border-b-2 transition-all duration-200 flex items-center gap-1.5',
              tab === t.value ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="max-w-2xl mx-auto"
          >
            {tab === 'profile' && <ProfileTab />}
            {tab === 'preferences' && <PreferencesTab />}
            {tab === 'achievements' && <AchievementsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user, profile } = useAuthStore()
  const [displayName, setDisplayName] = useState(profile?.displayName ?? user?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')

  const handleSaveProfile = async () => {
    if (!user) return
    setSaving(true)
    try {
      await updateProfile(user, { displayName })
      await updateDoc(doc(db, 'users', user.uid), { displayName })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await AuthService.signOut()
  }

  const handleDelete = async () => {
    if (!user) return
    await AuthService.deleteAccount(user)
  }

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar src={user?.photoURL ?? undefined} name={user?.displayName ?? 'U'} size="xl" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{user?.displayName ?? 'User'}</p>
          <p className="text-xs text-text-tertiary">{user?.email}</p>
          {profile?.friendTag && (
            <p className="text-xs text-primary mt-0.5 font-mono">{profile.friendTag}</p>
          )}
        </div>
      </div>

      {/* Name */}
      <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold font-display text-text-primary">Account</h3>
        <Input
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Button onClick={handleSaveProfile} loading={saving}>
          {saved ? <><Check size={14} /> Saved</> : 'Save Changes'}
        </Button>
      </div>

      {/* Password change (email accounts only) */}
      {user?.providerData.some((p) => p.providerId === 'password') && (
        <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
          <h3 className="text-sm font-semibold font-display text-text-primary">Change Password</h3>
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setPwError('') }}
          />
          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={pwError}
          />
          <Button
            variant="secondary"
            onClick={async () => {
              if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
              if (!user?.email) return
              await AuthService.resetPassword(user.email)
              setPwError('')
              alert('Password reset email sent.')
            }}
          >
            Send Reset Email
          </Button>
        </div>
      )}

      {/* Danger zone */}
      <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold font-display text-text-primary">Account Actions</h3>
        <Button variant="secondary" className="w-full justify-start gap-2" onClick={handleSignOut}>
          <LogOut size={14} /> Sign Out
        </Button>
        <Button variant="danger" className="w-full justify-start gap-2" onClick={() => setShowDeleteConfirm(true)}>
          <Trash2 size={14} /> Delete Account
        </Button>
      </div>

      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Account">
        <p className="text-sm text-text-secondary mb-4">This will permanently delete your account and all data. This action cannot be undone.</p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete Account</Button>
        </div>
      </Modal>
    </div>
  )
}

// ─── Preferences Tab ──────────────────────────────────────────────────────────

function PreferencesTab() {
  const { settings } = useAuthStore()
  const { user } = useAuthStore()
  const [dailyGoal, setDailyGoal] = useState(settings?.dailyFocusGoalMinutes ?? 60)
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>(settings?.timeFormat ?? '12h')
  const [notifications, setNotifications] = useState(settings?.notificationsEnabled ?? true)
  const [reminderTime, setReminderTime] = useState(settings?.dailyReminderTime ?? '08:00')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      await AuthService.saveUserSettings(user.uid, {
        dailyFocusGoalMinutes: dailyGoal,
        timeFormat,
        notificationsEnabled: notifications,
        dailyReminderTime: reminderTime,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const GOAL_OPTIONS = [30, 60, 90, 120, 180]

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold font-display text-text-primary">Focus Settings</h3>
        <div>
          <label className="text-xs text-text-tertiary uppercase tracking-wide mb-2 block">Daily Focus Goal</label>
          <div className="flex gap-2 flex-wrap">
            {GOAL_OPTIONS.map((g) => (
              <button
                key={g}
                onClick={() => setDailyGoal(g)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200',
                  dailyGoal === g ? 'bg-primary border-primary text-white' : 'border-border text-text-secondary hover:border-primary/40'
                )}
              >
                {g}m
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-text-tertiary uppercase tracking-wide mb-2 block">Time Format</label>
          <div className="flex gap-2">
            {(['12h', '24h'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTimeFormat(f)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200',
                  timeFormat === f ? 'bg-primary border-primary text-white' : 'border-border text-text-secondary hover:border-primary/40'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold font-display text-text-primary">Notifications</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Enable notifications</span>
          <button
            onClick={() => setNotifications((n) => !n)}
            className={cn('w-12 h-6 rounded-full transition-all duration-200 relative', notifications ? 'bg-primary' : 'bg-border')}
          >
            <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-200', notifications ? 'left-7' : 'left-1')} />
          </button>
        </div>
        {notifications && (
          <Input label="Daily reminder time" type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
        )}
      </div>

      <Button onClick={handleSave} loading={saving}>
        {saved ? <><Check size={14} /> Saved</> : 'Save Preferences'}
      </Button>
    </div>
  )
}

// ─── Achievements Tab ─────────────────────────────────────────────────────────

function AchievementsTab() {
  const { profile } = useAuthStore()
  const unlockedIds: string[] = []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold font-display text-text-primary">Achievements</h3>
        <Badge variant="primary">{unlockedIds.length}/{ACHIEVEMENTS.length}</Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ACHIEVEMENTS.map((a, i) => {
          const unlocked = unlockedIds.includes(a.id)
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                'flex items-start gap-3 p-3 rounded-xl border transition-all duration-200',
                unlocked ? 'bg-surface border-primary/20' : 'bg-surface/50 border-border opacity-50'
              )}
            >
              <span className="text-2xl">{unlocked ? a.icon : '🔒'}</span>
              <div>
                <p className={cn('text-sm font-medium', unlocked ? 'text-text-primary' : 'text-text-tertiary')}>{a.title}</p>
                <p className="text-xs text-text-tertiary">{a.description}</p>
              </div>
              {unlocked && <Check size={14} className="ml-auto text-success flex-shrink-0 mt-0.5" />}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
