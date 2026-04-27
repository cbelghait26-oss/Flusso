'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Trophy, Search, Plus, Check, X, Clock } from 'lucide-react'
import { useSocialStore } from '@/stores/useSocialStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { SocialService } from '@/services/SocialService'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { FriendRequest } from '@/types/models'

type LeaderboardPeriod = 'week' | 'month' | 'alltime'
type LeaderboardMetric = 'focus' | 'tasks' | 'streak'

export default function SocialPage() {
  const [activePanel, setActivePanel] = useState<'friends' | 'leaderboard'>('leaderboard')
  const [period, setPeriod] = useState<LeaderboardPeriod>('week')
  const [metric, setMetric] = useState<LeaderboardMetric>('focus')
  const [showAddFriend, setShowAddFriend] = useState(false)
  const { user, profile } = useAuthStore()
  const { leaderboard, friendRequests, friendships, setLeaderboard, setFriendRequests, setFriendships } = useSocialStore()

  useEffect(() => {
    if (!user) return
    const unsub = SocialService.subscribeLeaderboard([], setLeaderboard)
    const unsubReqs = SocialService.subscribeIncomingRequests(profile?.friendTag ?? '', setFriendRequests)
    SocialService.getFriendships(user.uid).then(setFriendships)
    return () => { unsub(); unsubReqs() }
  }, [user, period, metric, setLeaderboard, setFriendRequests, setFriendships])

  const pendingCount = friendRequests.filter((r) => r.status === 'pending').length

  return (
    <div className="h-full flex flex-col">
      {/* Panel toggle */}
      <div className="flex items-center gap-1 px-4 md:px-6 pt-4 border-b border-border pb-0">
        {(['leaderboard', 'friends'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setActivePanel(p)}
            className={cn(
              'px-4 py-2 text-sm font-medium capitalize border-b-2 transition-all duration-200 flex items-center gap-1.5',
              activePanel === p ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            {p === 'leaderboard' ? <Trophy size={14} /> : <Users size={14} />}
            {p}
            {p === 'friends' && pendingCount > 0 && (
              <span className="h-4 w-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activePanel === 'leaderboard' ? (
          <LeaderboardPanel period={period} metric={metric} onPeriodChange={setPeriod} onMetricChange={setMetric} leaderboard={leaderboard} currentUserId={user?.uid} />
        ) : (
          <FriendsPanel friendships={friendships} requests={friendRequests} userId={user?.uid ?? ''} onAddFriend={() => setShowAddFriend(true)} />
        )}
      </div>

      {showAddFriend && (
        <AddFriendModal onClose={() => setShowAddFriend(false)} userId={user?.uid ?? ''} />
      )}
    </div>
  )
}

// ─── Leaderboard Panel ────────────────────────────────────────────────────────

function LeaderboardPanel({
  period, metric, onPeriodChange, onMetricChange, leaderboard, currentUserId,
}: {
  period: LeaderboardPeriod; metric: LeaderboardMetric
  onPeriodChange: (p: LeaderboardPeriod) => void
  onMetricChange: (m: LeaderboardMetric) => void
  leaderboard: any[]; currentUserId?: string
}) {
  const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'Month' },
    { value: 'alltime', label: 'All Time' },
  ]
  const METRICS: { value: LeaderboardMetric; label: string }[] = [
    { value: 'focus', label: 'Focus' },
    { value: 'tasks', label: 'Tasks' },
    { value: 'streak', label: 'Streak' },
  ]

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex gap-1 bg-surface rounded-xl border border-border p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                period === p.value ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-surface rounded-xl border border-border p-0.5">
          {METRICS.map((m) => (
            <button
              key={m.value}
              onClick={() => onMetricChange(m.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                metric === m.value ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {leaderboard.length === 0 ? (
          <div className="p-8 text-center text-text-tertiary text-sm">No data yet. Add friends to compete!</div>
        ) : (
          leaderboard.map((entry, i) => {
            const isMe = entry.userId === currentUserId
            const value = metric === 'focus'
              ? `${Math.floor((entry.totalFocusMinutes ?? 0) / 60)}h ${(entry.totalFocusMinutes ?? 0) % 60}m`
              : metric === 'tasks'
              ? `${entry.tasksCompleted ?? 0} tasks`
              : `${entry.currentStreak ?? 0}d`

            return (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0',
                  isMe && 'bg-primary/5'
                )}
              >
                <span className="text-lg w-8 text-center">{medals[i] ?? `#${i + 1}`}</span>
                <Avatar
                  src={entry.photoURL}
                  name={entry.displayName}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', isMe ? 'text-primary' : 'text-text-primary')}>
                    {entry.displayName}{isMe && ' (You)'}
                  </p>
                  <p className="text-xs text-text-tertiary">{entry.friendTag}</p>
                </div>
                <span className="text-sm font-semibold text-text-primary">{value}</span>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Friends Panel ────────────────────────────────────────────────────────────

function FriendsPanel({ friendships, requests, userId, onAddFriend }: {
  friendships: any[]; requests: FriendRequest[]; userId: string; onAddFriend: () => void
}) {
  const incoming = requests.filter((r) => r.status === 'pending')

  const handleAccept = async (r: FriendRequest) => {
    if (!userId) return
    await SocialService.acceptFriendRequest(r.id, r.fromUid, userId)
  }
  const handleDecline = async (r: FriendRequest) => {
    await SocialService.declineFriendRequest(r.id)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold font-display text-text-primary">Friends</h3>
        <Button size="sm" onClick={onAddFriend}><Plus size={14} /> Add Friend</Button>
      </div>

      {incoming.length > 0 && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <p className="text-xs text-text-tertiary uppercase tracking-wide px-4 py-2 border-b border-border">Pending Requests ({incoming.length})</p>
          {incoming.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
              <Avatar name={r.fromUid} size="sm" />
              <span className="flex-1 text-sm text-text-primary">{r.fromUid}</span>
              <button onClick={() => handleAccept(r)} className="p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors">
                <Check size={14} />
              </button>
              <button onClick={() => handleDecline(r)} className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {friendships.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="mx-auto mb-2 text-text-tertiary" size={28} />
            <p className="text-sm text-text-tertiary">No friends yet.</p>
            <p className="text-xs text-text-tertiary mt-1">Add friends by their friend tag to compete on the leaderboard.</p>
          </div>
        ) : (
          friendships.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0"
            >
              <Avatar name={f.friendId} size="sm" online />
              <div>
                <p className="text-sm font-medium text-text-primary">{f.friendId}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Add Friend Modal ─────────────────────────────────────────────────────────

function AddFriendModal({ onClose, userId }: { onClose: () => void; userId: string }) {
  const [tag, setTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tag.trim()) return
    setLoading(true)
    setError('')
    try {
      await SocialService.sendFriendRequest(userId, tag.trim())
      setSent(true)
    } catch (err: any) {
      setError(err.message ?? 'Failed to send request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Add Friend">
      {sent ? (
        <div className="text-center py-4 space-y-2">
          <Check className="mx-auto text-success" size={28} />
          <p className="text-sm text-text-primary">Friend request sent!</p>
          <Button onClick={onClose}>Close</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Friend Tag"
            placeholder="e.g. alex#1234"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            autoFocus
            error={error}
          />
          <p className="text-xs text-text-tertiary">Your friend tag is shown in your profile settings.</p>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={loading}>Send Request</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
