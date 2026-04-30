'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Star, Calendar, Trash2, Edit3, CheckSquare, Target, X, ChevronDown } from 'lucide-react'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useTaskStore } from '@/stores/useTaskStore'
import { useObjectiveStore } from '@/stores/useObjectiveStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { TaskService } from '@/services/TaskService'
import { ObjectiveService } from '@/services/ObjectiveService'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { OBJECTIVE_COLORS, getDeadlineStatus, cn } from '@/lib/utils'
import { Task, Objective, ObjectiveCategory } from '@/types/models'
import { Timestamp } from 'firebase/firestore'
import { PREVIEW_MODE } from '@/lib/config'

type TabType = 'tasks' | 'objectives'
type FilterType = 'all' | 'myday' | 'important' | 'planned'

const CATEGORIES: { value: ObjectiveCategory; label: string }[] = [
  { value: 'Academic', label: '🎓 Academic' },
  { value: 'Career', label: '💼 Career' },
  { value: 'Personal', label: '🌱 Personal' },
  { value: 'Health', label: '💪 Health' },
  { value: 'Skill', label: '⚡ Skill' },
  { value: 'Creative', label: '🎨 Creative' },
  { value: 'Misc', label: '📌 Misc' },
]

export default function TasksPage() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<TabType>((searchParams.get('tab') as TabType) ?? 'tasks')
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null)
  const [showNewTask, setShowNewTask] = useState(searchParams.get('new') === '1')
  const [showNewObjective, setShowNewObjective] = useState(
    searchParams.get('new') === '1' && searchParams.get('tab') === 'objectives'
  )

  const { tasks, addTask, updateTask, removeTask } = useTaskStore()
  const { objectives, addObjective, removeObjective } = useObjectiveStore()
  const { user } = useAuthStore()

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'myday' && !t.isMyDay) return false
    if (filter === 'important' && t.importance < 3) return false
    if (filter === 'planned' && !t.deadline) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group tasks
  const groups = {
    overdue: filteredTasks.filter((t) => !t.isCompleted && getDeadlineStatus(t.deadline) === 'overdue'),
    today: filteredTasks.filter((t) => !t.isCompleted && (t.isMyDay || getDeadlineStatus(t.deadline) === 'today')),
    tomorrow: filteredTasks.filter((t) => !t.isCompleted && getDeadlineStatus(t.deadline) === 'tomorrow'),
    upcoming: filteredTasks.filter((t) => !t.isCompleted && getDeadlineStatus(t.deadline) === 'future'),
    someday: filteredTasks.filter((t) => !t.isCompleted && !t.deadline && !t.isMyDay),
    completed: filteredTasks.filter((t) => t.isCompleted),
  }

  const handleComplete = (task: Task) => {
    updateTask(task.id, { isCompleted: !task.isCompleted })
    if (!PREVIEW_MODE && user) TaskService.complete(user.uid, task.id, !task.isCompleted).catch(() => {})
  }

  const handleDeleteTask = (taskId: string) => {
    removeTask(taskId)
    if (selectedTask?.id === taskId) setSelectedTask(null)
    if (!PREVIEW_MODE && user) TaskService.delete(user.uid, taskId).catch(() => {})
  }

  const handleDeleteObjective = (objId: string) => {
    removeObjective(objId)
    if (selectedObjective?.id === objId) setSelectedObjective(null)
    if (!PREVIEW_MODE && user) ObjectiveService.delete(user.uid, objId).catch(() => {})
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 md:px-6 pt-4 border-b border-border pb-0">
        {(['tasks', 'objectives'] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium capitalize border-b-2 transition-all duration-200',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            {t === 'tasks' ? (
              <span className="flex items-center gap-1.5"><CheckSquare size={14} />{t}</span>
            ) : (
              <span className="flex items-center gap-1.5"><Target size={14} />{t}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {tab === 'tasks' ? (
          <TasksTab
            groups={groups}
            search={search}
            filter={filter}
            onSearchChange={setSearch}
            onFilterChange={setFilter}
            onSelectTask={setSelectedTask}
            selectedTask={selectedTask}
            onComplete={handleComplete}
            onDelete={handleDeleteTask}
            showNew={showNewTask}
            onShowNew={() => setShowNewTask(true)}
          />
        ) : (
          <ObjectivesTab
            objectives={objectives.filter((o) =>
              !search || o.title.toLowerCase().includes(search.toLowerCase())
            )}
            tasks={tasks}
            search={search}
            onSearchChange={setSearch}
            selectedObjective={selectedObjective}
            onSelectObjective={setSelectedObjective}
            onDelete={handleDeleteObjective}
            showNew={showNewObjective}
            onShowNew={() => setShowNewObjective(true)}
          />
        )}
      </div>

      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          objectives={objectives}
          userId={user?.uid ?? ''}
        />
      )}
      {showNewObjective && (
        <NewObjectiveModal
          onClose={() => setShowNewObjective(false)}
          userId={user?.uid ?? ''}
        />
      )}
    </div>
  )
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab({
  groups, search, filter, onSearchChange, onFilterChange,
  onSelectTask, selectedTask, onComplete, onDelete, showNew, onShowNew,
}: {
  groups: Record<string, Task[]>
  search: string; filter: FilterType
  onSearchChange: (s: string) => void
  onFilterChange: (f: FilterType) => void
  onSelectTask: (t: Task) => void
  selectedTask: Task | null
  onComplete: (t: Task) => void
  onDelete: (id: string) => void
  showNew: boolean
  onShowNew: () => void
}) {
  const FILTERS: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'myday', label: 'My Day' },
    { value: 'important', label: 'Important' },
    { value: 'planned', label: 'Planned' },
  ]

  const totalVisible = Object.values(groups).flat().length

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Task list */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
        <div className="p-4 space-y-3 border-b border-border">
          <div className="flex gap-2">
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              leftIcon={<Search size={14} />}
              className="flex-1"
            />
            <Button onClick={onShowNew} size="md">
              <Plus size={14} /> New
            </Button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => onFilterChange(f.value)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-all duration-200',
                  filter === f.value
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-text-secondary hover:text-text-primary'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {totalVisible === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="No tasks"
              description="Create your first task to get started."
              action={<Button size="sm" onClick={onShowNew}><Plus size={14} /> New Task</Button>}
            />
          ) : (
            Object.entries(groups).map(([group, tasks]) => {
              if (tasks.length === 0) return null
              const labels: Record<string, string> = {
                overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow',
                upcoming: 'Upcoming', someday: 'Someday', completed: 'Completed',
              }
              return (
                <TaskGroup
                  key={group}
                  label={labels[group]}
                  tasks={tasks}
                  isCompleted={group === 'completed'}
                  onSelect={onSelectTask}
                  selected={selectedTask}
                  onComplete={onComplete}
                  onDelete={onDelete}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => onSelectTask(null as unknown as Task)}
        />
      )}
    </div>
  )
}

function TaskGroup({
  label, tasks, isCompleted, onSelect, selected, onComplete, onDelete,
}: {
  label: string; tasks: Task[]; isCompleted: boolean
  onSelect: (t: Task) => void; selected: Task | null
  onComplete: (t: Task) => void; onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(!isCompleted)
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide hover:text-text-secondary transition-colors"
      >
        <ChevronDown size={12} className={cn('transition-transform', !expanded && '-rotate-90')} />
        {label}
        <span className="text-[10px] bg-surface-2 px-1.5 py-0.5 rounded-full">{tasks.length}</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isSelected={selected?.id === task.id}
                onSelect={onSelect}
                onComplete={onComplete}
                onDelete={onDelete}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TaskRow({ task, isSelected, onSelect, onComplete, onDelete }: {
  task: Task; isSelected: boolean
  onSelect: (t: Task) => void; onComplete: (t: Task) => void; onDelete: (id: string) => void
}) {
  const { objectives } = useObjectiveStore()
  const objective = objectives.find((o) => o.id === task.objectiveId)
  const ds = getDeadlineStatus(task.deadline)

  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-150',
        isSelected ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-surface-2 border-l-2 border-transparent'
      )}
      onClick={() => onSelect(task)}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onComplete(task) }}
        className={cn(
          'h-4 w-4 rounded-full border-2 flex-shrink-0 transition-all duration-200 flex items-center justify-center',
          task.isCompleted ? 'border-success bg-success/20' : 'border-border hover:border-primary'
        )}
      >
        {task.isCompleted && <div className="h-1.5 w-1.5 rounded-full bg-success" />}
      </button>
      <span className={cn('flex-1 text-sm truncate', task.isCompleted && 'line-through text-text-tertiary')}>
        {task.title}
      </span>
      {objective && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full border"
          style={{ color: OBJECTIVE_COLORS[objective.colorIndex], borderColor: OBJECTIVE_COLORS[objective.colorIndex] + '40' }}
        >
          {objective.title}
        </span>
      )}
      {ds === 'overdue' && <Badge variant="danger" className="text-[10px] hidden group-hover:inline-flex">Late</Badge>}
      {task.importance >= 3 && <Star size={12} className="text-warning flex-shrink-0" />}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
        className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-all p-1"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function TaskDetailPanel({ task, onClose }: { task: Task; onClose: () => void }) {
  const { user } = useAuthStore()
  const { objectives } = useObjectiveStore()
  const { updateTask } = useTaskStore()
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)

  useEffect(() => { setTitle(task.title); setNotes(task.notes) }, [task])

  const save = useCallback(() => {
    updateTask(task.id, { title, notes })
    if (!PREVIEW_MODE && user) TaskService.update(user.uid, task.id, { title, notes }).catch(() => {})
  }, [user, task.id, title, notes, updateTask])

  return (
    <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col border-l border-border overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium text-text-primary font-display">Task Detail</span>
        <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="p-4 space-y-4 flex-1">
        <div>
          <label className="text-xs text-text-tertiary uppercase tracking-wide mb-1.5 block">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/60"
          />
        </div>
        <div>
          <label className="text-xs text-text-tertiary uppercase tracking-wide mb-1.5 block">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={save}
            rows={4}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/60 resize-none"
          />
        </div>
        <div>
          <label className="text-xs text-text-tertiary uppercase tracking-wide mb-1.5 block">Objective</label>
          <p className="text-sm text-text-secondary">
            {objectives.find((o) => o.id === task.objectiveId)?.title ?? 'None'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={task.isMyDay}
            onChange={(e) => {
              updateTask(task.id, { isMyDay: e.target.checked })
              if (!PREVIEW_MODE && user) TaskService.update(user.uid, task.id, { isMyDay: e.target.checked }).catch(() => {})
            }}
            className="accent-primary"
          />
          <span className="text-sm text-text-secondary">My Day</span>
        </div>
      </div>
    </div>
  )
}

// ─── Objectives Tab ────────────────────────────────────────────────────────────

function ObjectivesTab({
  objectives, tasks, search, onSearchChange,
  selectedObjective, onSelectObjective, onDelete, showNew, onShowNew,
}: {
  objectives: Objective[]; tasks: Task[]; search: string
  onSearchChange: (s: string) => void
  selectedObjective: Objective | null
  onSelectObjective: (o: Objective) => void; onDelete: (id: string) => void
  showNew: boolean; onShowNew: () => void
}) {
  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 flex gap-2 border-b border-border">
          <Input
            placeholder="Search objectives..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            leftIcon={<Search size={14} />}
            className="flex-1"
          />
          <Button onClick={onShowNew} size="md"><Plus size={14} /> New</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {objectives.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No objectives"
              description="Create an objective to connect your tasks to meaningful goals."
              action={<Button size="sm" onClick={onShowNew}><Plus size={14} /> New Objective</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {objectives.map((obj, i) => {
                const objTasks = tasks.filter((t) => t.objectiveId === obj.id)
                const done = objTasks.filter((t) => t.isCompleted).length
                const pct = objTasks.length > 0 ? (done / objTasks.length) * 100 : 0
                const color = OBJECTIVE_COLORS[obj.colorIndex] ?? OBJECTIVE_COLORS[0]
                return (
                  <motion.div
                    key={obj.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => onSelectObjective(obj)}
                    className={cn(
                      'rounded-xl border bg-surface p-4 cursor-pointer transition-all duration-200 hover:border-primary/40',
                      selectedObjective?.id === obj.id && 'border-primary/60 bg-primary/5'
                    )}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-3 w-1 rounded-full mt-1 flex-shrink-0" style={{ background: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{obj.title}</p>
                        <p className="text-xs text-text-tertiary">{obj.category}</p>
                      </div>
                    </div>
                    <ProgressBar value={pct} height="xs" />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-text-tertiary">{done}/{objTasks.length} tasks</span>
                      <span className="text-xs text-text-secondary">{Math.round(pct)}%</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {selectedObjective && (
        <ObjectiveDetailPanel
          objective={selectedObjective}
          tasks={tasks.filter((t) => t.objectiveId === selectedObjective.id)}
          onClose={() => onSelectObjective(null as unknown as Objective)}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

function ObjectiveDetailPanel({
  objective, tasks, onClose, onDelete,
}: {
  objective: Objective; tasks: Task[]
  onClose: () => void; onDelete: (id: string) => void
}) {
  const { user } = useAuthStore()
  const { updateObjective } = useObjectiveStore()
  const [title, setTitle] = useState(objective.title)

  useEffect(() => setTitle(objective.title), [objective])

  const save = () => {
    updateObjective(objective.id, { title })
    if (!PREVIEW_MODE && user) ObjectiveService.update(user.uid, objective.id, { title }).catch(() => {})
  }

  const color = OBJECTIVE_COLORS[objective.colorIndex] ?? OBJECTIVE_COLORS[0]
  const done = tasks.filter((t) => t.isCompleted).length
  const pct = tasks.length > 0 ? (done / tasks.length) * 100 : 0

  return (
    <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col border-l border-border overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="h-3 w-3 rounded-full" style={{ background: color }} />
        <span className="text-sm font-medium text-text-primary font-display flex-1 ml-2">{objective.category}</span>
        <button
          onClick={() => onDelete(objective.id)}
          className="text-text-tertiary hover:text-danger transition-colors mr-2 p-1"
        >
          <Trash2 size={14} />
        </button>
        <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="p-4 space-y-4 flex-1">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          className="w-full bg-transparent text-base font-semibold text-text-primary font-display focus:outline-none border-b border-border pb-2 focus:border-primary"
        />
        <div>
          <div className="flex justify-between text-xs text-text-secondary mb-1.5">
            <span>Progress</span><span>{Math.round(pct)}%</span>
          </div>
          <ProgressBar value={pct} />
        </div>
        <div>
          <p className="text-xs text-text-tertiary uppercase tracking-wide mb-2">Tasks ({tasks.length})</p>
          {tasks.length === 0 ? (
            <p className="text-sm text-text-tertiary">No tasks yet.</p>
          ) : (
            <ul className="space-y-1">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <div className={cn('h-3 w-3 rounded-full border-2 flex-shrink-0', t.isCompleted ? 'border-success bg-success/20' : 'border-border')} />
                  <span className={cn('truncate', t.isCompleted && 'line-through text-text-tertiary')}>{t.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── New Task Modal ────────────────────────────────────────────────────────────

function NewTaskModal({ onClose, objectives, userId }: { onClose: () => void; objectives: Objective[]; userId: string }) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [objectiveId, setObjectiveId] = useState('')
  const [importance, setImportance] = useState(1)
  const [isMyDay, setIsMyDay] = useState(false)
  const [loading, setLoading] = useState(false)
  const { addTask } = useTaskStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    const now = Timestamp.now()
    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const taskData = {
      title: title.trim(),
      notes,
      objectiveId: objectiveId || null,
      importance,
      isMyDay,
      isCompleted: false,
      deadline: null,
      sortOrder: Date.now(),
    }
    try {
      if (PREVIEW_MODE) {
        addTask({ id: localId, userId, ...taskData, createdAt: now, updatedAt: now })
      } else {
        const id = await TaskService.create(userId, taskData)
        addTask({ id, userId, ...taskData, createdAt: now, updatedAt: now })
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="New Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />
        <div>
          <label className="text-xs text-text-tertiary uppercase tracking-wide mb-1.5 block">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes..."
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/60 resize-none"
          />
        </div>
        <div>
          <label className="text-xs text-text-tertiary uppercase tracking-wide mb-1.5 block">Objective</label>
          <select
            value={objectiveId}
            onChange={(e) => setObjectiveId(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/60"
          >
            <option value="">None</option>
            {objectives.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={isMyDay} onChange={(e) => setIsMyDay(e.target.checked)} id="myday" className="accent-primary" />
          <label htmlFor="myday" className="text-sm text-text-secondary cursor-pointer">Add to My Day</label>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Create Task</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── New Objective Modal ──────────────────────────────────────────────────────

function NewObjectiveModal({ onClose, userId }: { onClose: () => void; userId: string }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ObjectiveCategory>('Personal')
  const [colorIndex, setColorIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const { addObjective } = useObjectiveStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const objData = { title: title.trim(), category, colorIndex, tasks: [], targetDate: null, isCompleted: false }
    try {
      if (PREVIEW_MODE) {
        addObjective({ id: localId, userId, ...objData })
      } else {
        const id = await ObjectiveService.create(userId, objData)
        addObjective({ id, userId, ...objData })
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="New Objective">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Title" placeholder="Objective title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        <div>
          <label className="text-xs text-text-tertiary uppercase tracking-wide mb-2 block">Category</label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={cn(
                  'py-2 px-3 rounded-lg border text-xs font-medium transition-all duration-200 text-left',
                  category === c.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface text-text-secondary hover:border-primary/40'
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-text-tertiary uppercase tracking-wide mb-2 block">Color</label>
          <div className="flex gap-2">
            {OBJECTIVE_COLORS.map((color, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setColorIndex(i)}
                className={cn('h-6 w-6 rounded-full transition-all duration-200', colorIndex === i && 'ring-2 ring-offset-2 ring-offset-surface-2 ring-primary')}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Create Objective</Button>
        </div>
      </form>
    </Modal>
  )
}
