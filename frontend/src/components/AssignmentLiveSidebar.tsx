import { Calendar } from 'lucide-react'
import type { Assignment } from '../api/client'
import { getEffectiveCloseTime } from '../context/AssignmentRealtimeContext'
import { useAssignmentChangedFields, useAssignmentLive } from '../hooks/useAssignmentLive'
import AssignmentCountdown from './AssignmentCountdown'

export default function AssignmentLiveSidebar({
  assignmentId,
  base,
  onClosedChange,
}: {
  assignmentId: string
  base: Assignment
  onClosedChange?: (closed: boolean) => void
}) {
  const live = useAssignmentLive(assignmentId, base) ?? base
  const changedFields = useAssignmentChangedFields(assignmentId)
  const fieldClass = (field: string) => (changedFields.has(field) ? 'realtime-changed' : '')
  const timerChanged = changedFields.has('effective_close_time') || changedFields.has('close_time')
  const effectiveCloseTime = getEffectiveCloseTime(live)
  const allowedExtensions = live.allowed_extensions
    ? live.allowed_extensions.split(',').map((e) => e.trim()).filter(Boolean)
    : []

  return (
    <div className="glass assignment-info-card assignment-info-card--scrolls">
      <h1 className={fieldClass('title')} style={{ margin: '0 0 0.5rem', fontSize: '1.35rem' }}>
        {live.title}
      </h1>
      <AssignmentCountdown assignment={live} highlight={timerChanged} onClosedChange={onClosedChange} />
      <p className="timer-warning-text">
        После истечения таймера задание автоматически закрывается, и отправка решения становится недоступной.
      </p>
      <div className="info-row">
        <Calendar size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 2 }}>Открытие</div>
          <div className={fieldClass('open_time')} style={{ fontSize: '0.9rem' }}>
            {new Date(live.open_time).toLocaleString('ru')}
          </div>
        </div>
      </div>
      <div className="info-row">
        <Calendar size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 2 }}>Закрытие</div>
          <div className={fieldClass('effective_close_time')} style={{ fontSize: '0.9rem' }}>
            {new Date(effectiveCloseTime).toLocaleString('ru')}
          </div>
        </div>
      </div>
      {allowedExtensions.length > 0 && (
        <div className={fieldClass('allowed_extensions')} style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Допустимые форматы</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allowedExtensions.map((ext) => (
              <span key={ext} className="ext-badge">.{ext}</span>
            ))}
          </div>
        </div>
      )}
      {live.description && (
        <div className={fieldClass('description')} style={{ marginTop: '1.25rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Описание</div>
          <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {live.description}
          </p>
        </div>
      )}
    </div>
  )
}
