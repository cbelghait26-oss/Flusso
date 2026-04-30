'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendarStore } from '@/stores/useCalendarStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTaskStore } from '@/stores/useTaskStore'
import { CalendarService } from '@/services/CalendarService'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { CalendarEvent } from '@/types/models'
import { Timestamp } from 'firebase/firestore'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EVENT_COLORS = ['#7F77DD', '#4ADE80', '#60A5FA', '#FBBF24', '#F87171', '#A78BFA', '#34D399', '#FB923C']

type ViewMode = 'week' | 'month'

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showCreate, setShowCreate] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const { events, setEvents } = useCalendarStore()
  const { user } = useAuthStore()
  const { tasks } = useTaskStore()

  useEffect(() => {
    if (!user) return
    CalendarService.getEvents(user.uid).then(setEvents)
  }, [user, setEvents])

  const navigate = (dir: number) => {
    const d = new Date(currentDate)
    if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCurrentDate(d)
  }

  const weekStart = getWeekStart(currentDate)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-surface-2 text-text-secondary hover:text-text-primary transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-text-primary w-32 text-center">
            {view === 'week'
              ? `${weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : currentDate.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-surface-2 text-text-secondary hover:text-text-primary transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface rounded-lg border border-border p-0.5">
            {(['week', 'month'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium capitalize transition-all duration-200',
                  view === v ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Event
          </Button>
        </div>
      </div>

      {/* Calendar view */}
      <div className="flex-1 overflow-auto">
        {view === 'week' ? (
          <WeekView
            weekStart={weekStart}
            events={events}
            tasks={tasks}
            onEventClick={setSelectedEvent}
            onSlotClick={() => setShowCreate(true)}
          />
        ) : (
          <MonthView
            date={currentDate}
            events={events}
            tasks={tasks}
            onEventClick={setSelectedEvent}
            onDayClick={() => setShowCreate(true)}
          />
        )}
      </div>

      {showCreate && (
        <CreateEventSheet
          onClose={() => setShowCreate(false)}
          userId={user?.uid ?? ''}
          onCreated={(evt) => setEvents([...events, evt])}
        />
      )}
    </div>
  )
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ weekStart, events, tasks, onEventClick, onSlotClick }: {
  weekStart: Date
  events: CalendarEvent[]
  tasks: import('@/types/models').Task[]
  onEventClick: (e: CalendarEvent) => void
  onSlotClick: () => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const today = new Date()

  return (
    <div className="flex flex-col min-w-0">
      {/* Day headers */}
      <div className="flex border-b border-border sticky top-0 bg-surface z-10">
        <div className="w-14 flex-shrink-0" />
        {days.map((d) => {
          const isToday = d.toDateString() === today.toDateString()
          return (
            <div key={d.toISOString()} className="flex-1 text-center py-2 border-l border-border">
              <p className="text-xs text-text-tertiary">{DAYS[d.getDay()]}</p>
              <p className={cn(
                'text-sm font-medium mt-0.5',
                isToday ? 'text-primary' : 'text-text-primary'
              )}>{d.getDate()}</p>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="flex">
        <div className="w-14 flex-shrink-0">
          {HOURS.map((h) => (
            <div key={h} className="h-14 border-b border-border/50 flex items-start pt-1 pr-2 justify-end">
              <span className="text-[10px] text-text-tertiary">{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>
        {days.map((d) => (
          <div key={d.toISOString()} className="flex-1 border-l border-border relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="h-14 border-b border-border/30 hover:bg-surface-2/30 cursor-pointer transition-colors"
                onClick={onSlotClick}
              />
            ))}
            {/* Events for this day */}
            {events
              .filter((e) => {
                const ed = e.date.toDate()
                return ed.toDateString() === d.toDateString()
              })
              .map((e) => {
                const start = e.date.toDate()
                const top = (start.getHours() + start.getMinutes() / 60) * 56
                return (
                  <div
                    key={e.id}
                    className="absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] font-medium cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
                    style={{ top, background: e.color + '30', borderLeft: `2px solid ${e.color}`, color: e.color, minHeight: 20 }}
                    onClick={(ev) => { ev.stopPropagation(); onEventClick(e) }}
                  >
                    {e.title}
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ date, events, tasks, onEventClick, onDayClick }: {
  date: Date
  events: CalendarEvent[]
  tasks: import('@/types/models').Task[]
  onEventClick: (e: CalendarEvent) => void
  onDayClick: () => void
}) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const startPadding = firstDay.getDay()
  const today = new Date()

  const cells: (Date | null)[] = [
    ...Array(startPadding).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(date.getFullYear(), date.getMonth(), i + 1)),
  ]
  // Pad to complete last week
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="p-4">
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
        {DAYS.map((d) => (
          <div key={d} className="bg-surface px-2 py-1.5 text-center text-xs text-text-tertiary font-medium uppercase tracking-wide">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} className="bg-background h-24" />
          const isToday = d.toDateString() === today.toDateString()
          const dayEvents = events.filter((e) => e.date.toDate().toDateString() === d.toDateString())
          return (
            <div
              key={d.toISOString()}
              className="bg-surface h-24 p-1.5 cursor-pointer hover:bg-surface-2 transition-colors"
              onClick={onDayClick}
            >
              <span className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1',
                isToday ? 'bg-primary text-white' : 'text-text-secondary'
              )}>{d.getDate()}</span>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map((e) => (
                  <div
                    key={e.id}
                    className="text-[10px] rounded px-1 py-0.5 truncate cursor-pointer"
                    style={{ background: e.color + '20', color: e.color }}
                    onClick={(ev) => { ev.stopPropagation(); onEventClick(e) }}
                  >
                    {e.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <span className="text-[10px] text-text-tertiary">+{dayEvents.length - 2} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Create Event Sheet ───────────────────────────────────────────────────────

function CreateEventSheet({ onClose, userId, onCreated }: {
  onClose: () => void
  userId: string
  onCreated: (e: CalendarEvent) => void
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [isAllDay, setIsAllDay] = useState(false)
  const [notes, setNotes] = useState('')
  const [color, setColor] = useState(EVENT_COLORS[0])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    try {
      const dateObj = new Date(`${date}T${startTime}:00`)
      const endDateObj = new Date(`${date}T${endTime}:00`)
      const id = await CalendarService.create(userId, {
        title: title.trim(),
        date: Timestamp.fromDate(dateObj),
        endDate: isAllDay ? null : Timestamp.fromDate(endDateObj),
        isAllDay,
        color,
        notes,
      })
      onCreated({
        id, title: title.trim(),
        date: Timestamp.fromDate(dateObj),
        endDate: isAllDay ? null : Timestamp.fromDate(endDateObj),
        isAllDay, color, notes, userId,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ x: 400 }}
        animate={{ x: 0 }}
        exit={{ x: 400 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-96 z-50 bg-surface-2 border-l border-border overflow-y-auto"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary font-display">New Event</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <Input label="Title" placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          {!isAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <Input label="End time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} id="allday" className="accent-primary" />
            <label htmlFor="allday" className="text-sm text-text-secondary cursor-pointer">All day</label>
          </div>
          <div>
            <label className="text-xs text-text-tertiary uppercase tracking-wide mb-2 block">Color</label>
            <div className="flex gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn('h-6 w-6 rounded-full transition-all duration-200', color === c && 'ring-2 ring-offset-2 ring-offset-surface-2 ring-primary')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-text-tertiary uppercase tracking-wide mb-1.5 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/60 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" loading={loading} className="flex-1">Create Event</Button>
          </div>
        </form>
      </motion.div>
    </>
  )
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}
