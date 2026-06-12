import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import type { Assignment } from '../api/client'
import {
  getAssignmentStatus,
} from '../context/AssignmentRealtimeContext'
import { useAssignmentChangedFields, useAssignmentLive } from '../hooks/useAssignmentLive'

const STATUS_LABELS: Record<string, string> = {
  open: 'Открыто',
  'closing-soon': 'Скоро закрывается',
  closed: 'Закрыто',
  pending: 'Ещё не открыто',
}

export default function AssignmentCourseRow({ assignment }: { assignment: Assignment }) {
  const live = useAssignmentLive(assignment.id, assignment) ?? assignment
  const changed = useAssignmentChangedFields(assignment.id)
  const status = getAssignmentStatus(live)

  return (
    <li
      className={`glass card-hover${changed.size ? ' realtime-changed' : ''}`}
      style={{
        marginBottom: '0.75rem',
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <Clock size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {live.title}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span className={`status-badge status-${status}`}>{STATUS_LABELS[status]}</span>
        <Link
          to={`/assignment/${live.id}`}
          className="btn btn-primary btn-sm"
          style={{ padding: '0.4rem 0.8rem' }}
        >
          Открыть
        </Link>
      </div>
    </li>
  )
}
