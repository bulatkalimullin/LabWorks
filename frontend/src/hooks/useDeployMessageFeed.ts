import { useEffect, useRef, useState } from 'react'
import type { DeploymentInfo } from '../components/DeploymentStatus'
import type { DeployFeedMessage as StoredDeployMessage } from '../lib/deployStatus'
import { sanitizeDeployError } from '../lib/deployStatus'

export type DeployFeedMessage = StoredDeployMessage & {
  id: string
}

function messageKind(phase: string, kind: StoredDeployMessage['kind'] = 'status'): NonNullable<StoredDeployMessage['kind']> {
  if (phase === 'error') return 'error'
  if (phase === 'ready_to_test' || phase === 'running') return 'success'
  return kind
}

function extractCandidates(deployment: DeploymentInfo): { text: string; kind: NonNullable<StoredDeployMessage['kind']> }[] {
  const phase = deployment.phase ?? deployment.status
  const out: { text: string; kind: NonNullable<StoredDeployMessage['kind']> }[] = []

  for (const msg of deployment.messages ?? []) {
    if (msg.text?.trim()) {
      out.push({
        text: msg.kind === 'error' ? sanitizeDeployError(msg.text) : msg.text.trim(),
        kind: messageKind(msg.phase ?? phase, msg.kind ?? 'status'),
      })
    }
  }

  if (deployment.label?.trim()) {
    out.push({ text: deployment.label.trim(), kind: messageKind(phase, 'status') })
  }
  if (deployment.hint?.trim() && deployment.hint !== deployment.label) {
    out.push({ text: deployment.hint.trim(), kind: messageKind(phase, 'hint') })
  }
  if (
    deployment.message?.trim()
    && deployment.message !== deployment.label
    && deployment.message !== deployment.hint
  ) {
    out.push({ text: deployment.message.trim(), kind: messageKind(phase, 'status') })
  }
  if (deployment.error?.trim()) {
    out.push({ text: sanitizeDeployError(deployment.error), kind: 'error' })
  }

  return out
}

export function useDeployMessageFeed(
  deployment: DeploymentInfo | null | undefined,
  sessionKey?: string | null,
) {
  const [messages, setMessages] = useState<DeployFeedMessage[]>([])
  const seenRef = useRef<Set<string>>(new Set())
  const prevSession = useRef(sessionKey)

  useEffect(() => {
    if (prevSession.current !== sessionKey) {
      prevSession.current = sessionKey
      seenRef.current = new Set()
      setMessages([])
    }
  }, [sessionKey])

  useEffect(() => {
    if (!deployment) return

    const phase = deployment.phase ?? deployment.status
    const at = deployment.updated_at ?? new Date().toISOString()

    for (const candidate of extractCandidates(deployment)) {
      const key = `${phase}:${candidate.kind}:${candidate.text}`
      if (seenRef.current.has(key)) continue
      seenRef.current.add(key)
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}-${key.slice(0, 24)}`,
          text: candidate.text,
          phase,
          kind: candidate.kind,
          at,
        },
      ])
    }
  }, [deployment])

  return messages
}
