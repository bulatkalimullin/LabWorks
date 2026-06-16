import { useEffect, useRef } from 'react'
import type { AssignmentUpdatedEvent } from '../context/AssignmentRealtimeContext'
import type { DeploymentWirePayload } from '../lib/deploymentRealtimeStore'

function wsBase(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined
  if (env) return env.replace(/\/$/, '')
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}`
}

export function useAssignmentWebSocket(
  enabled: boolean,
  onSnapshot: (assignments: AssignmentUpdatedEvent['payload'][]) => void,
  onUpdate: (event: AssignmentUpdatedEvent) => void,
  onDeploymentSnapshot?: (payload: DeploymentWirePayload) => void,
  onDeploymentUpdate?: (payload: DeploymentWirePayload) => void,
) {
  const onSnapshotRef = useRef(onSnapshot)
  const onUpdateRef = useRef(onUpdate)
  const onDeploymentSnapshotRef = useRef(onDeploymentSnapshot)
  const onDeploymentUpdateRef = useRef(onDeploymentUpdate)
  onSnapshotRef.current = onSnapshot
  onUpdateRef.current = onUpdate
  onDeploymentSnapshotRef.current = onDeploymentSnapshot
  onDeploymentUpdateRef.current = onDeploymentUpdate

  useEffect(() => {
    if (!enabled) return

    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let delay = 1000
    let cancelled = false

    function connect() {
      const token = localStorage.getItem('access')
      if (!token || cancelled) return

      const url = `${wsBase()}/ws/assignments/?token=${encodeURIComponent(token)}`
      ws = new WebSocket(url)

      ws.onopen = () => {
        delay = 1000
      }

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string) as {
            type: string
            payload?: AssignmentUpdatedEvent['payload'][] | AssignmentUpdatedEvent['payload'] | DeploymentWirePayload
            assignment_id?: string
            changed_fields?: string[]
          }
          if (data.type === 'assignments_snapshot' && Array.isArray(data.payload)) {
            onSnapshotRef.current(data.payload)
          } else if (data.type === 'assignment_updated' && data.payload && data.assignment_id) {
            onUpdateRef.current({
              assignment_id: data.assignment_id,
              changed_fields: data.changed_fields ?? [],
              payload: data.payload as AssignmentUpdatedEvent['payload'],
            })
          } else if (data.type === 'deployment_snapshot' && data.payload && !Array.isArray(data.payload)) {
            onDeploymentSnapshotRef.current?.(data.payload as DeploymentWirePayload)
          } else if (data.type === 'deployment_updated' && data.payload && !Array.isArray(data.payload)) {
            onDeploymentUpdateRef.current?.(data.payload as DeploymentWirePayload)
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        if (cancelled) return
        reconnectTimer = setTimeout(() => {
          delay = Math.min(delay * 2, 30000)
          connect()
        }, delay)
      }

      ws.onerror = () => {
        ws?.close()
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [enabled])
}
