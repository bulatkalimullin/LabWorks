import type { Assignment } from '../api/client'

export type AssignmentPayload = Assignment & { effective_close_time?: string }

export type AssignmentUpdatedEvent = {
  assignment_id: string
  changed_fields: string[]
  payload: AssignmentPayload
}

type Listener = () => void

const assignments = new Map<string, AssignmentPayload>()
const changedFields = new Map<string, Set<string>>()
export const EMPTY_CHANGED_FIELDS: ReadonlySet<string> = new Set<string>()
const listenersById = new Map<string, Set<Listener>>()
let globalVersion = 0
const globalListeners = new Set<Listener>()

function notify(assignmentId: string) {
  listenersById.get(assignmentId)?.forEach((cb) => cb())
  globalListeners.forEach((cb) => cb())
}

function mergePayload(
  prev: AssignmentPayload | undefined,
  payload: AssignmentPayload,
  fields: string[],
): AssignmentPayload {
  if (!prev || fields.length === 0) return { ...payload }
  const next = { ...prev }
  for (const field of fields) {
    const key = field as keyof AssignmentPayload
    if (key in payload) {
      ;(next as Record<string, unknown>)[field] = payload[key]
    }
  }
  return next
}

export const assignmentRealtimeStore = {
  getAssignment(id: string): AssignmentPayload | undefined {
    return assignments.get(id)
  },

  getChangedFields(id: string): ReadonlySet<string> {
    return changedFields.get(id) ?? EMPTY_CHANGED_FIELDS
  },

  getGlobalVersion(): number {
    return globalVersion
  },

  subscribe(assignmentId: string, listener: Listener): () => void {
    let set = listenersById.get(assignmentId)
    if (!set) {
      set = new Set()
      listenersById.set(assignmentId, set)
    }
    set.add(listener)
    return () => {
      set!.delete(listener)
      if (set!.size === 0) listenersById.delete(assignmentId)
    }
  },

  subscribeGlobal(listener: Listener): () => void {
    globalListeners.add(listener)
    return () => globalListeners.delete(listener)
  },

  mergeAssignment(assignment: AssignmentPayload, fields: string[] = []) {
    const id = String(assignment.id)
    const prev = assignments.get(id)
    const next = fields.length > 0 && prev
      ? mergePayload(prev, assignment, fields)
      : { ...assignment }
    assignments.set(id, next)
    globalVersion += 1
    notify(id)
  },

  applySnapshot(list: AssignmentPayload[]) {
    for (const item of list) {
      const id = String(item.id)
      assignments.set(id, { ...item })
    }
    globalVersion += 1
    list.forEach((item) => notify(String(item.id)))
  },

  applyUpdate(event: AssignmentUpdatedEvent): AssignmentUpdatedEvent {
    const id = event.assignment_id
    const prev = assignments.get(id)
    const next = mergePayload(prev, event.payload, event.changed_fields)
    assignments.set(id, next)
    if (event.changed_fields.length > 0) {
      changedFields.set(id, new Set(event.changed_fields))
    }
    globalVersion += 1
    notify(id)
    return event
  },

  clearChangedFields(id: string) {
    if (!changedFields.has(id)) return
    changedFields.delete(id)
    notify(id)
  },
}
