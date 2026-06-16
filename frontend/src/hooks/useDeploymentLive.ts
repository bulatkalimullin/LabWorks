import { useSyncExternalStore } from 'react'
import { deploymentRealtimeStore } from '../lib/deploymentRealtimeStore'

export function useDeploymentForStudent(studentId: number | undefined) {
  return useSyncExternalStore(
    (cb) => (studentId ? deploymentRealtimeStore.subscribe(studentId, cb) : () => {}),
    () => (studentId ? deploymentRealtimeStore.get(studentId) : undefined),
    () => (studentId ? deploymentRealtimeStore.get(studentId) : undefined),
  )
}

export function useDeploymentGlobalVersion() {
  return useSyncExternalStore(
    (cb) => deploymentRealtimeStore.subscribeGlobal(cb),
    () => deploymentRealtimeStore.getGlobalVersion(),
    () => deploymentRealtimeStore.getGlobalVersion(),
  )
}
