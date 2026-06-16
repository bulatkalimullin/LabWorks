import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { DeploymentInfo } from '../components/DeploymentStatus'
import {
  isDeploymentInProgress,
  normalizeDeploymentInfo,
  type CheckerDeployStatus,
} from '../lib/deployStatus'

const POLL_INTERVAL_MS = 2000

export function useDeployStatusPoll(
  submissionUuid: string | null | undefined,
  enabled = true,
) {
  const [polled, setPolled] = useState<DeploymentInfo | null>(null)

  useEffect(() => {
    if (!enabled || !submissionUuid) {
      setPolled(null)
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = (delay = POLL_INTERVAL_MS) => {
      timer = setTimeout(() => {
        void poll()
      }, delay)
    }

    const poll = async () => {
      try {
        const { data } = await api.get<CheckerDeployStatus>('/deploy/status/', {
          params: { submission_uuid: submissionUuid },
        })
        if (cancelled) return
        const next = normalizeDeploymentInfo(data)
        setPolled(next)
        if (isDeploymentInProgress(next)) {
          schedule()
        }
      } catch {
        if (!cancelled) schedule()
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [submissionUuid, enabled])

  return polled
}
