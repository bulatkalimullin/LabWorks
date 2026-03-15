import { useEffect, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Download, KeyRound } from 'lucide-react'

type Submission = {
  id: number
  assignment: string
  assignment_title?: string
  assignment_close_time?: string
  submitted_at: string
  file_url: string | null
  verification_short?: string | null
  verification_payload?: string | null
}

function assignmentClosed(closeTime: string | undefined): boolean {
  if (!closeTime) return false
  return new Date(closeTime).getTime() <= Date.now()
}

export default function MySubmissionsPage() {
  const { isAuthenticated } = useAuth()
  const { toast } = useToast()
  const [list, setList] = useState<Submission[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const base = import.meta.env.VITE_API_URL || '/api/v1'

  useEffect(() => {
    if (isAuthenticated) api.get('/submissions/').then((r) => setList(r.data)).catch(() => setList([]))
  }, [isAuthenticated])

  if (!isAuthenticated) return <Navigate to="/login" replace />

  function download(id: number) {
    fetch(`${base}/submissions/${id}/download/`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access')}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 403) {
            try {
              const body = await r.json() as { detail?: string }
              toast(body.detail || 'Скачивание недоступно', 'error')
            } catch {
              toast('Скачивание недоступно', 'error')
            }
            return null
          }
          toast('Ошибка скачивания', 'error')
          return null
        }
        return r.blob()
      })
      .then((b) => {
        if (!b) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = `submission_${id}`
        a.click()
      })
      .catch(() => {})
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }} className="page-enter">
      <h1>Мои работы</h1>
      <div className="glass" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Задание</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Дата</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Верификационный ключ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <>
                <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>{s.assignment_title || s.assignment}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {new Date(s.submitted_at).toLocaleString('ru')}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {s.verification_short ? (
                      <button
                        type="button"
                        className="verify-key-badge"
                        style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
                        title="Нажмите для подробностей"
                        onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                      >
                        <KeyRound size={12} /> {s.verification_short}…
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                    {s.file_url && !assignmentClosed(s.assignment_close_time) && (
                      <button type="button" className="btn btn-ghost" style={{ padding: '0.25rem' }} onClick={() => download(s.id)}>
                        <Download size={16} />
                      </button>
                    )}
                    <Link to={`/assignment/${s.assignment}`} className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', marginLeft: 4 }}>
                      К заданию
                    </Link>
                  </td>
                </tr>
                {expanded === s.id && s.verification_payload && (
                  <tr key={`${s.id}-verify`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td colSpan={4} style={{ padding: '0.5rem 1rem 0.75rem' }}>
                      <div className="verify-expand">
                        <div className="verify-row">
                          <span className="verify-label">Payload</span>
                          <span className="verify-value">{s.verification_payload}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Пока нет сдач.</p>}
    </div>
  )
}
