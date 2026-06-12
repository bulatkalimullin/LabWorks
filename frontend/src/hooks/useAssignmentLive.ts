import { useSyncExternalStore } from 'react'
import {
  assignmentRealtimeStore,
  EMPTY_CHANGED_FIELDS,
  type AssignmentPayload,
} from '../lib/assignmentRealtimeStore'

export function useAssignmentLive(
  assignmentId: string | undefined,
  fallback?: AssignmentPayload,
): AssignmentPayload | undefined {
  const live = useSyncExternalStore(
    (cb) => (assignmentId ? assignmentRealtimeStore.subscribe(assignmentId, cb) : () => {}),
    () => (assignmentId ? assignmentRealtimeStore.getAssignment(assignmentId) : undefined),
    () => (assignmentId ? assignmentRealtimeStore.getAssignment(assignmentId) : undefined),
  )
  return live ?? fallback
}

export function useAssignmentChangedFields(assignmentId: string | undefined): ReadonlySet<string> {
  return useSyncExternalStore(
    (cb) => (assignmentId ? assignmentRealtimeStore.subscribe(assignmentId, cb) : () => {}),
    () => (assignmentId ? assignmentRealtimeStore.getChangedFields(assignmentId) : EMPTY_CHANGED_FIELDS),
    () => EMPTY_CHANGED_FIELDS,
  )
}

export function useAssignmentsLiveVersion(): number {
  return useSyncExternalStore(
    (cb) => assignmentRealtimeStore.subscribeGlobal(cb),
    () => assignmentRealtimeStore.getGlobalVersion(),
    () => assignmentRealtimeStore.getGlobalVersion(),
  )
}
