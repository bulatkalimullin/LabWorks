import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { getAssignmentStatus, getEffectiveCloseTime } from '../context/AssignmentRealtimeContext'
import type { AssignmentPayload } from '../lib/assignmentRealtimeStore'

const TWENTY_MINUTES_MS = 20 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000

function computeRemaining(closeTime: string): number {
  return Math.max(0, new Date(closeTime).getTime() - Date.now())
}

function formatHms(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

const STATUS_LABELS = {
  open: 'Открыто',
  'closing-soon': 'Скоро закрывается',
  closed: 'Закрыто',
  pending: 'Ещё не открыто',
}

export default function AssignmentCountdown({
  assignment,
  highlight = false,
  onClosedChange,
}: {
  assignment: AssignmentPayload
  highlight?: boolean
  onClosedChange?: (closed: boolean) => void
}) {
  const effectiveClose = getEffectiveCloseTime(assignment)
  const [remaining, setRemaining] = useState(() => computeRemaining(effectiveClose))

  useEffect(() => {
    setRemaining(computeRemaining(effectiveClose))
    const id = setInterval(() => {
      setRemaining(computeRemaining(effectiveClose))
    }, 1000)
    return () => clearInterval(id)
  }, [effectiveClose])

  const status = getAssignmentStatus(assignment)
  const submissionClosed = status === 'closed' || status === 'pending' || remaining <= 0
  const closedRef = useRef<boolean | null>(null)

  useEffect(() => {
    if (closedRef.current === submissionClosed) return
    closedRef.current = submissionClosed
    onClosedChange?.(submissionClosed)
  }, [submissionClosed, onClosedChange])

  let timerLevel: string
  if (status === 'pending') timerLevel = 'pending'
  else if (status === 'closed') timerLevel = 'closed'
  else if (remaining >= ONE_HOUR_MS) timerLevel = 'long'
  else if (remaining >= TWENTY_MINUTES_MS) timerLevel = 'medium'
  else timerLevel = 'short'

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <span className={`status-badge status-${status} timer-${timerLevel}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>
      <div
        className={`timer-block ${status === 'closing-soon' ? 'timer-block--urgent' : ''} ${highlight ? 'realtime-changed realtime-changed--timer' : ''}`}
      >
        <Clock size={18} style={{ flexShrink: 0 }} />
        <div className="timer-block-inner">
          {status === 'closed' ? (
            <div className="timer-closed-text">Закрыто</div>
          ) : (
            <div className={`timer-label timer-${timerLevel}`}>
              {formatHms(remaining)} до закрытия
            </div>
          )}
        </div>
      </div>
    </>
  )
}
