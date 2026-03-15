import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft,
  Copy, Download, Eye, KeyRound, MessageSquare, Save, Shield, Tag, User,
} from 'lucide-react'
import {
  api, type AdminSubmission, STUDENT_LABELS, LABEL_COLORS,
  SUBMISSION_FLAGS, parseApiError,
} from '../api/client'
import { useToast } from '../context/ToastContext'

const base = import.meta.env.VITE_API_URL || '/api/v1'

function fmt(s: number): string {
  if (s <= 0) return '0с'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts = []
  if (h) parts.push(`${h}ч`)
  if (m) parts.push(`${m}м`)
  if (sec) parts.push(`${sec}с`)
  return parts.join(' ')
}

function TimingBar({ timing }: { timing: AdminSubmission['timing'] }) {
  const { first_view_at, first_start_at, submit_at } = timing
  if (!first_view_at) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Студент не открывал страницу задания (нет данных о просмотре)
      </p>
    )
  }
  const viewDate = new Date(first_view_at)
  const submitDate = new Date(submit_at)
  const totalSec = (submitDate.getTime() - viewDate.getTime()) / 1000
  const startSec = first_start_at
    ? (new Date(first_start_at).getTime() - viewDate.getTime()) / 1000
    : null

  return (
    <div className="timing-container">
      <div className="timing-row">
        <div className="timing-event">
          <div className="timing-dot timing-dot-view" />
          <div>
            <div className="timing-event-label">Первый просмотр</div>
            <div className="timing-event-time">{viewDate.toLocaleString('ru')}</div>
          </div>
        </div>
        {first_start_at && (
          <>
            <div className="timing-line" style={{ flex: startSec ? startSec / totalSec : 0.1 }} />
            <div className="timing-event">
              <div className="timing-dot timing-dot-start" />
              <div>
                <div className="timing-event-label">Начало работы</div>
                <div className="timing-event-time">{new Date(first_start_at).toLocaleString('ru')}</div>
              </div>
            </div>
          </>
        )}
        <div className="timing-line" />
        <div className="timing-event">
          <div className="timing-dot timing-dot-submit" />
          <div>
            <div className="timing-event-label">Сдача</div>
            <div className="timing-event-time">{submitDate.toLocaleString('ru')}</div>
          </div>
        </div>
      </div>
      <div className="timing-stats">
        {timing.time_from_view_to_submit !== null && (
          <div className="timing-stat">
            <Eye size={14} />
            <span>От просмотра до сдачи: <strong>{fmt(timing.time_from_view_to_submit)}</strong></span>
          </div>
        )}
        {timing.time_from_start_to_submit !== null && (
          <div className="timing-stat">
            <CheckCircle2 size={14} />
            <span>От начала работы до сдачи: <strong>{fmt(timing.time_from_start_to_submit)}</strong></span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [submission, setSubmission] = useState<AdminSubmission | null>(null)
  const [allIds, setAllIds] = useState<number[]>([])
  const [noteValue, setNoteValue] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.get('/admin/submissions/', { params: { page_size: 1000 } })
      .then((r) => {
        const data = Array.isArray(r.data) ? r.data : r.data.results ?? []
        setAllIds(data.map((s: AdminSubmission) => s.id))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    api.get(`/admin/submissions/${id}/`)
      .then((r) => {
        setSubmission(r.data)
        setNoteValue(r.data.admin_note || '')
      })
      .catch(() => navigate('/admin/submissions'))
  }, [id])

  const currentIdx = allIds.indexOf(Number(id))
  const prevId = currentIdx > 0 ? allIds[currentIdx - 1] : null
  const nextId = currentIdx >= 0 && currentIdx < allIds.length - 1 ? allIds[currentIdx + 1] : null

  const saveNote = useCallback(async (value: string) => {
    if (!id) return
    setNoteSaving(true)
    try {
      await api.patch(`/admin/submissions/${id}/annotate/`, { admin_note: value })
      toast('Заметка сохранена', 'success')
    } catch (err) {
      toast(parseApiError(err), 'error')
    } finally {
      setNoteSaving(false)
    }
  }, [id])

  function onNoteChange(val: string) {
    setNoteValue(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNote(val), 1500)
  }

  async function toggleFlag(code: string) {
    if (!submission || !id) return
    const flags = submission.admin_flags.includes(code)
      ? submission.admin_flags.filter((f) => f !== code)
      : [...submission.admin_flags, code]
    try {
      const r = await api.patch(`/admin/submissions/${id}/annotate/`, { admin_flags: flags })
      setSubmission(r.data)
    } catch (err) {
      toast(parseApiError(err), 'error')
    }
  }

  async function setLabel(label: string) {
    if (!submission || !id) return
    try {
      const r = await api.patch(`/admin/submissions/${id}/annotate/`, { student_label: label })
      setSubmission(r.data)
      toast('Метка обновлена', 'success')
    } catch (err) {
      toast(parseApiError(err), 'error')
    }
  }

  async function postComment() {
    if (!id || !newComment.trim()) return
    setCommentSaving(true)
    try {
      await api.post(`/submissions/${id}/comments/`, { text: newComment })
      setNewComment('')
      const r = await api.get(`/admin/submissions/${id}/`)
      setSubmission(r.data)
      toast('Комментарий добавлен', 'success')
    } catch (err) {
      toast(parseApiError(err), 'error')
    } finally {
      setCommentSaving(false)
    }
  }

  function downloadFile() {
    if (!id) return
    fetch(`${base}/submissions/${id}/download/`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access')}` },
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.blob() })
      .then((b) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = `submission_${id}`
        a.click()
      })
      .catch(() => toast('Нет файла', 'error'))
  }

  if (!submission) {
    return (
      <div style={{ padding: '2rem' }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 60, marginBottom: 12 }} />
        ))}
      </div>
    )
  }

  const labelColor = LABEL_COLORS[submission.student_label] ?? '#94a3b8'

  return (
    <div className="admin-page">
      <div className="admin-detail-topbar">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin/submissions')}>
          <ChevronLeft size={16} /> Назад
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {currentIdx >= 0 ? `${currentIdx + 1} / ${allIds.length}` : ''}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!prevId}
            onClick={() => prevId && navigate(`/admin/submissions/${prevId}`)}
          >
            <ArrowLeft size={15} /> Пред.
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!nextId}
            onClick={() => nextId && navigate(`/admin/submissions/${nextId}`)}
          >
            След. <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="admin-detail-left">
          <div className="glass admin-detail-section">
            <div className="admin-section-title"><User size={15} /> Студент</div>
            <div className="admin-student-card">
              <div className="admin-student-avatar">
                {submission.student_full_name[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>{submission.student_full_name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>@{submission.student_username}</div>
              </div>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                <Tag size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Метка студента
              </div>
              <select
                className="admin-select"
                style={{ width: '100%' }}
                value={submission.student_label}
                onChange={(e) => setLabel(e.target.value)}
              >
                <option value="">— без метки —</option>
                {STUDENT_LABELS.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
              {submission.student_label && (
                <div style={{ marginTop: 6 }}>
                  <span
                    style={{
                      background: `${labelColor}22`,
                      color: labelColor,
                      border: `1px solid ${labelColor}55`,
                      borderRadius: 6,
                      padding: '3px 10px',
                      fontSize: '0.8rem',
                    }}
                  >
                    {submission.student_label_display}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="glass admin-detail-section">
            <div className="admin-section-title"><MessageSquare size={15} /> Задание</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 4 }}>{submission.assignment_title}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>{submission.course_name}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Сдано: {new Date(submission.submitted_at).toLocaleString('ru')}
            </div>
            {submission.file_url && (
              <button type="button" className="btn btn-ghost" style={{ marginTop: 12, width: '100%' }} onClick={downloadFile}>
                <Download size={15} /> Скачать файл
              </button>
            )}
            {submission.text_response && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Текстовый ответ</div>
                <pre style={{
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 8,
                  padding: '0.75rem',
                  fontSize: '0.82rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                  maxHeight: 200,
                  overflow: 'auto',
                }}>
                  {submission.text_response}
                </pre>
              </div>
            )}
          </div>

          <div className="glass admin-detail-section">
            <div className="admin-section-title">
              <Shield size={15} /> Верификация
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '0.78rem' }}
                onClick={() => setShowVerify((v) => !v)}
              >
                {showVerify ? 'Свернуть' : 'Показать'}
              </button>
            </div>
            {showVerify && submission.verification_payload && (
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Payload</div>
                <div style={{
                  background: 'rgba(0,0,0,0.35)',
                  borderRadius: 8,
                  padding: '0.6rem',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  wordBreak: 'break-all',
                  marginBottom: 8,
                }}>
                  {submission.verification_payload}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ marginLeft: 8, padding: '1px 6px', fontSize: '0.7rem' }}
                    onClick={() => { navigator.clipboard.writeText(submission.verification_payload!); toast('Скопировано', 'success') }}
                  >
                    <Copy size={11} />
                  </button>
                </div>
                {submission.verification_signature && (
                  <>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>HMAC-SHA256</div>
                    <div style={{
                      background: 'rgba(0,0,0,0.35)',
                      borderRadius: 8,
                      padding: '0.6rem',
                      fontFamily: 'monospace',
                      fontSize: '0.72rem',
                      wordBreak: 'break-all',
                    }}>
                      <KeyRound size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      {submission.verification_signature}
                    </div>
                  </>
                )}
              </div>
            )}
            {showVerify && !submission.verification_payload && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Нет данных верификации</p>
            )}
          </div>
        </div>

        <div className="admin-detail-right">
          <div className="glass admin-detail-section">
            <div className="admin-section-title"><Eye size={15} /> Хронология работы</div>
            <TimingBar timing={submission.timing} />
          </div>

          <div className="glass admin-detail-section">
            <div className="admin-section-title"><Tag size={15} /> Флаги сдачи</div>
            <div className="admin-flags-grid">
              {SUBMISSION_FLAGS.map((fl) => {
                const active = submission.admin_flags.includes(fl.code)
                return (
                  <button
                    key={fl.code}
                    type="button"
                    className={`flag-chip${active ? ' flag-active' : ''}`}
                    onClick={() => toggleFlag(fl.code)}
                  >
                    {active && <CheckCircle2 size={12} />}
                    {fl.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="glass admin-detail-section">
            <div className="admin-section-title">
              <Save size={15} /> Заметка администратора
              {noteSaving && <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Сохранение…</span>}
            </div>
            <textarea
              className="input"
              rows={5}
              value={noteValue}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Только для администраторов. Сохраняется автоматически…"
              style={{ resize: 'vertical', fontSize: '0.875rem' }}
            />
          </div>

          <div className="glass admin-detail-section">
            <div className="admin-section-title"><MessageSquare size={15} /> Комментарии ({submission.comments.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {submission.comments.map((c) => (
                <div key={c.id} className="admin-comment">
                  <div className="admin-comment-header">
                    <strong>{c.author_full_name || c.author_username}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {new Date(c.created_at).toLocaleString('ru')}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', marginTop: 4 }}>{c.text}</div>
                </div>
              ))}
              {submission.comments.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Нет комментариев</p>
              )}
            </div>
            <textarea
              className="input"
              rows={3}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Написать комментарий студенту…"
              style={{ resize: 'vertical', fontSize: '0.875rem', marginBottom: 8 }}
            />
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={commentSaving || !newComment.trim()}
              onClick={postComment}
            >
              {commentSaving ? 'Отправка…' : 'Отправить комментарий'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
