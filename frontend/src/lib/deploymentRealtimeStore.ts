import type { DeploymentInfo } from '../components/DeploymentStatus'
import { normalizeDeploymentInfo, type CheckerDeployStatus } from '../lib/deployStatus'

export type DeploymentPayload = DeploymentInfo & {
  student_id: number
  student_username: string
}

export type DeploymentWirePayload = CheckerDeployStatus & {
  student_id: number
  student_username: string
}

type Listener = () => void

const deployments = new Map<number, DeploymentPayload>()
let globalVersion = 0
const listenersByStudent = new Map<number, Set<Listener>>()
const globalListeners = new Set<Listener>()

function notify(studentId: number) {
  listenersByStudent.get(studentId)?.forEach((cb) => cb())
  globalListeners.forEach((cb) => cb())
}

export const deploymentRealtimeStore = {
  get(studentId: number): DeploymentPayload | undefined {
    return deployments.get(studentId)
  },

  getGlobalVersion(): number {
    return globalVersion
  },

  subscribe(studentId: number, listener: Listener): () => void {
    let set = listenersByStudent.get(studentId)
    if (!set) {
      set = new Set()
      listenersByStudent.set(studentId, set)
    }
    set.add(listener)
    return () => {
      set!.delete(listener)
      if (set!.size === 0) listenersByStudent.delete(studentId)
    }
  },

  subscribeGlobal(listener: Listener): () => void {
    globalListeners.add(listener)
    return () => globalListeners.delete(listener)
  },

  applySnapshot(payload: DeploymentWirePayload) {
    deployments.set(payload.student_id, {
      ...normalizeDeploymentInfo(payload),
      student_id: payload.student_id,
      student_username: payload.student_username,
    })
    globalVersion += 1
    notify(payload.student_id)
  },

  applyUpdate(payload: DeploymentWirePayload) {
    deployments.set(payload.student_id, {
      ...normalizeDeploymentInfo(payload),
      student_id: payload.student_id,
      student_username: payload.student_username,
    })
    globalVersion += 1
    notify(payload.student_id)
  },

  seedFromSubmissions(
    items: { student?: number; student_deployment?: DeploymentInfo | null; student_username?: string }[],
  ) {
    for (const item of items) {
      if (!item.student || !item.student_deployment) continue
      deployments.set(item.student, {
        ...normalizeDeploymentInfo(item.student_deployment),
        student_id: item.student,
        student_username: item.student_username ?? String(item.student),
      })
    }
    globalVersion += 1
    globalListeners.forEach((cb) => cb())
  },
}
