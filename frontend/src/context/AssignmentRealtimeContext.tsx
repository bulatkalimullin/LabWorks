import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
} from 'react'
import type { Assignment } from '../api/client'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { useAssignmentWebSocket } from '../hooks/useAssignmentWebSocket'
import {
  assignmentRealtimeStore,
  type AssignmentPayload,
  type AssignmentUpdatedEvent,
} from '../lib/assignmentRealtimeStore'

export type { AssignmentPayload, AssignmentUpdatedEvent }

export const FIELD_LABELS: Record<string, string> = {
  title: 'название',
  description: 'описание',
  open_time: 'время открытия',
  close_time: 'время закрытия',
  allowed_extensions: 'допустимые форматы',
  files: 'файл задания',
  effective_close_time: 'ваш дедлайн',
  file_url: 'файл задания',
}

type AssignmentRealtimeContextValue = {
  mergeAssignment: (assignment: AssignmentPayload) => void
}

const AssignmentRealtimeContext = createContext<AssignmentRealtimeContextValue | null>(null)

export function getEffectiveCloseTime(a: AssignmentPayload | Assignment): string {
  return (a as AssignmentPayload).effective_close_time || a.close_time
}

export function getAssignmentStatus(
  a: AssignmentPayload | Assignment,
): 'open' | 'closing-soon' | 'closed' | 'pending' {
  const now = Date.now()
  const open = new Date(a.open_time).getTime()
  const close = new Date(getEffectiveCloseTime(a)).getTime()
  if (now < open) return 'pending'
  if (now > close) return 'closed'
  if (close - now < 60 * 60 * 1000) return 'closing-soon'
  return 'open'
}

export function AssignmentRealtimeProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const highlightTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const scheduleHighlightClear = useCallback((assignmentId: string) => {
    const existing = highlightTimers.current.get(assignmentId)
    if (existing) clearTimeout(existing)
    highlightTimers.current.set(
      assignmentId,
      setTimeout(() => {
        assignmentRealtimeStore.clearChangedFields(assignmentId)
        highlightTimers.current.delete(assignmentId)
      }, 3000),
    )
  }, [])

  const applyUpdate = useCallback(
    (event: AssignmentUpdatedEvent, notify = true) => {
      assignmentRealtimeStore.applyUpdate(event)
      if (event.changed_fields.length > 0) {
        scheduleHighlightClear(event.assignment_id)
      }
      if (notify && event.changed_fields.length > 0) {
        const labels = event.changed_fields
          .map((f: string) => FIELD_LABELS[f] ?? f)
          .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)
        toast(`Задание обновлено: изменено ${labels.join(', ')}`, 'info')
      }
    },
    [scheduleHighlightClear, toast],
  )

  const handleSnapshot = useCallback((list: AssignmentPayload[]) => {
    assignmentRealtimeStore.applySnapshot(list)
  }, [])

  const wsEnabled = isAuthenticated && !!user && !user.is_staff
  useAssignmentWebSocket(wsEnabled, handleSnapshot, (event) => applyUpdate(event, true))

  const mergeAssignment = useCallback((assignment: AssignmentPayload) => {
    assignmentRealtimeStore.mergeAssignment(assignment)
  }, [])

  return (
    <AssignmentRealtimeContext.Provider value={{ mergeAssignment }}>
      {children}
    </AssignmentRealtimeContext.Provider>
  )
}

export function useAssignmentRealtimeOptional() {
  return useContext(AssignmentRealtimeContext)
}

/** @deprecated use useAssignmentLive from hooks/useAssignmentLive */
export function useAssignmentRealtime() {
  const ctx = useContext(AssignmentRealtimeContext)
  if (!ctx) throw new Error('useAssignmentRealtime outside AssignmentRealtimeProvider')
  return ctx
}
