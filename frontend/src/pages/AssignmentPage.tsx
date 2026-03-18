import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api, type Assignment, parseApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import FileDropzone from '../components/FileDropzone'
import CommentSection from '../components/CommentSection'
import Modal from '../components/Modal'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileArchive,
  KeyRound,
  MessageSquare,
  Search,
  Shield,
} from 'lucide-react'

type Submission = {
  id: number
  assignment: string
  submitted_at: string
  file_url: string | null
  text_response: string | null
  student_username?: string
  verification_short?: string | null
  verification_payload?: string | null
  verification_signature?: string | null
}

// Constants outside component — no recalculation on every render
const TWENTY_MINUTES_MS = 20 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000

function getFileExtension(url: string): string {
  const clean = url.split('?')[0]
  const parts = clean.split('.')
  if (parts.length < 2) return ''
  return parts[parts.length - 1].toLowerCase()
}

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

function getStatus(assignment: Assignment): 'open' | 'closing-soon' | 'closed' | 'pending' {
  const now = Date.now()
  const open = new Date(assignment.open_time).getTime()
  const close = new Date(assignment.close_time).getTime()
  if (now < open) return 'pending'
  if (now > close) return 'closed'
  if (close - now < 60 * 60 * 1000) return 'closing-soon'
  return 'open'
}

const STATUS_LABELS = {
  open: 'Открыто',
  'closing-soon': 'Скоро закрывается',
  closed: 'Закрыто',
  pending: 'Ещё не открыто',
}

// Extracted shared component for assignment file block
function AssignmentFileBlock({
  fileUrl,
  assignmentMarkdown,
  markdownComponents,
  onDownload,
}: {
  fileUrl: string | null | undefined
  assignmentMarkdown: string | null
  markdownComponents: Record<string, unknown>
  onDownload?: (url: string) => void
}) {
  return (
    <div className="glass" style={{ padding: '1.25rem', marginBottom: '1rem', marginTop: '1rem' }}>
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Файл задания</h3>
      {fileUrl
        ? (getFileExtension(fileUrl) === 'md' && assignmentMarkdown ? (
          <>
            <div
              className="assignment-markdown"
              style={{
                borderRadius: 10,
                border: '1px solid var(--border)',
                padding: '0.85rem 1rem',
                background: 'rgba(15,23,42,0.6)',
                fontSize: '0.9rem',
                lineHeight: 1.6,
              }}
            >
              <ReactMarkdown components={markdownComponents as Parameters<typeof ReactMarkdown>[0]['components']}>{assignmentMarkdown}</ReactMarkdown>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: '0.75rem', display: 'inline-flex' }}
              onClick={() => fileUrl && onDownload?.(fileUrl)}
            >
              <Download size={16} /> Скачать файл задания (.md)
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ display: 'inline-flex' }}
            onClick={() => fileUrl && onDownload?.(fileUrl)}
          >
            <Download size={16} /> Скачать файл задания
          </button>
        ))
        : (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Файл задания не прикреплён. Добавьте его в панели преподавателя или в админке.
          </p>
        )}
    </div>
  )
}

export default function AssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [textResponse, setTextResponse] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [commentFor, setCommentFor] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expandedVerify, setExpandedVerify] = useState<number | null>(null)
  const [assignmentMarkdown, setAssignmentMarkdown] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<403 | 404 | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startWorkFired = useRef(false)
  const leftColRef = useRef<HTMLDivElement>(null)
  // Behavior analytics counters (anti-GPT)
  const clipboardChanges = useRef(0)
  const pasteCount = useRef(0)
  const pasteChars = useRef(0)
  const keystrokes = useRef(0)
  const tabSwitches = useRef(0)
  // Keylog buffer: {key, t} where t = ms since page load
  const keylogBuffer = useRef<{ key: string; t: number }[]>([])
  const pageLoadTime = useRef(Date.now())
  const keylogDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [rightColMinHeight, setRightColMinHeight] = useState<number>(0)
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const base = import.meta.env.VITE_API_URL || '/api/v1'

  // Reset pageLoadTime on mount
  useEffect(() => { pageLoadTime.current = Date.now() }, [])

  const markdownComponents = useMemo(
    () => ({
      code({
        className,
        children,
        ...props
      }: { className?: string; children?: React.ReactNode }) {
        const codeString = String(children ?? '')
        const isBlock = (className || '').includes('language-') || codeString.includes('\n')
        if (isBlock) {
          return (
            <pre className="assignment-code-block">
              <code {...props}>{codeString}</code>
            </pre>
          )
        }
        return (
          <code className="assignment-markdown-inline-code" {...props}>
            {children}
          </code>
        )
      },
    }),
    [],
  )

  useEffect(() => {
    if (!assignmentId) return
    setErrorCode(null)
    api
      .get(`/assignments/${assignmentId}/`)
      .then((r) => setAssignment(r.data))
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 403 || status === 404) {
          setErrorCode(status)
        }
        setAssignment(null)
      })
    if (!user?.is_staff) {
      api.post(`/assignments/${assignmentId}/events/`, { event_type: 'OPEN_PAGE' }).catch(() => {})
    }
  }, [assignmentId, user?.is_staff])

  // Timer — only re-run when close_time changes
  useEffect(() => {
    if (!assignment) return
    setRemaining(computeRemaining(assignment.close_time))
    intervalRef.current = setInterval(() => {
      setRemaining(computeRemaining(assignment.close_time))
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [assignment?.close_time])

  // Markdown fetch with AbortController
  useEffect(() => {
    if (!assignment?.file_url) {
      setAssignmentMarkdown(null)
      return
    }
    const ext = getFileExtension(assignment.file_url)
    if (ext !== 'md') {
      setAssignmentMarkdown(null)
      return
    }
    const controller = new AbortController()
    fetch(assignment.file_url, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${localStorage.getItem('access') || ''}` },
    })
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((text) => { if (!controller.signal.aborted) setAssignmentMarkdown(text) })
      .catch((e: unknown) => { if ((e as { name?: string })?.name !== 'AbortError') setAssignmentMarkdown(null) })
    return () => controller.abort()
  }, [assignment?.file_url])

  // ResizeObserver — mount once, observes DOM changes on its own
  useEffect(() => {
    const el = leftColRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setRightColMinHeight(el.offsetHeight)
    })
    ro.observe(el)
    setRightColMinHeight(el.offsetHeight)
    return () => ro.disconnect()
  }, [])

  // Clipboard polling (anti-GPT monitoring) — только для студентов
  useEffect(() => {
    if (!assignmentId || user?.is_staff) return
    let lastHash = ''
    let isPolling = false
    const dbg = localStorage.getItem('labworks_debug') === 'true'

    const pollClipboard = async () => {
      if (isPolling) return
      isPolling = true
      try {
        const text = await navigator.clipboard.readText()
        if (!text) return
        const hash = `${text.length}:${text.slice(0, 30)}`
        if (hash === lastHash) return
        lastHash = hash
        clipboardChanges.current++
        if (dbg) console.log(`[LW] CLIPBOARD_CHANGE #${clipboardChanges.current} | len=${text.length} | content="${text.slice(0, 200)}"`)
        api.post(`/assignments/${assignmentId}/events/`, {
          event_type: 'CLIPBOARD_CHANGE',
          metadata: { content: text.slice(0, 500), length: text.length },
        }).catch(() => {})
      } catch { /* clipboard-read permission not granted — silent */ } finally {
        isPolling = false
      }
    }

    const clipboardInterval = setInterval(pollClipboard, 2000)

    const onVisibilityChange = () => {
      if (!document.hidden) {
        if (dbg) console.log('[LW] TAB_FOCUS — проверяю буфер')
        pollClipboard()
      } else {
        tabSwitches.current++
        if (dbg) console.log(`[LW] TAB_SWITCH #${tabSwitches.current}`)
        api.post(`/assignments/${assignmentId}/events/`, {
          event_type: 'TAB_SWITCH',
          metadata: {},
        }).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    // alt+tab возврат: 200ms задержка чтобы браузер успел передать права на clipboard
    const onWindowFocus = () => setTimeout(pollClipboard, 200)
    window.addEventListener('focus', onWindowFocus)

    // document paste — работает без clipboard-read permission, через e.clipboardData
    const onDocumentPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text') ?? ''
      if (!text) return
      const hash = `${text.length}:${text.slice(0, 30)}`
      if (hash === lastHash) return
      lastHash = hash
      clipboardChanges.current++
      if (dbg) console.log(`[LW] CLIPBOARD_CHANGE (paste) #${clipboardChanges.current} | len=${text.length} | content="${text.slice(0, 200)}"`)
      api.post(`/assignments/${assignmentId}/events/`, {
        event_type: 'CLIPBOARD_CHANGE',
        metadata: { content: text.slice(0, 500), length: text.length },
      }).catch(() => {})
    }
    document.addEventListener('paste', onDocumentPaste)

    // copy — студент скопировал текст прямо со страницы задания
    const onCopy = () => setTimeout(pollClipboard, 100)
    document.addEventListener('copy', onCopy)

    // throttled click — ловим момент когда студент кликает по странице после возврата
    let lastClickPoll = 0
    const onDocumentClick = () => {
      const now = Date.now()
      if (now - lastClickPoll < 3000) return
      lastClickPoll = now
      pollClipboard()
    }
    document.addEventListener('click', onDocumentClick)

    return () => {
      clearInterval(clipboardInterval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onWindowFocus)
      document.removeEventListener('paste', onDocumentPaste)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('click', onDocumentClick)
    }
  }, [assignmentId, user?.is_staff])

  // Keylog flush при размонтировании (финальный батч)
  useEffect(() => {
    if (!assignmentId || user?.is_staff) return
    return () => {
      if (keylogDebounce.current) clearTimeout(keylogDebounce.current)
      const batch = keylogBuffer.current.splice(0)
      if (batch.length === 0) return
      api.post(`/assignments/${assignmentId}/events/`, {
        event_type: 'KEYLOG_BATCH',
        metadata: { keys: batch },
      }).catch(() => {})
    }
  }, [assignmentId, user?.is_staff])

  const refreshSubmissions = useCallback(async () => {
    if (!assignmentId || !user) return
    try {
      if (user.is_staff) {
        const r = await api.get(`/assignments/${assignmentId}/submissions/`)
        setSubmissions(r.data)
      } else {
        const r = await api.get('/submissions/')
        const list = (r.data as Submission[]).filter((s) => s.assignment === assignmentId)
        setSubmissions(list)
      }
    } catch {
    }
  }, [assignmentId, user?.id, user?.is_staff])

  useEffect(() => { refreshSubmissions() }, [refreshSubmissions])

  const handleFileSelect = useCallback((f: File | null) => {
    setFile(f)
    if (f && !startWorkFired.current && !user?.is_staff && assignmentId) {
      startWorkFired.current = true
      api.post(`/assignments/${assignmentId}/events/`, { event_type: 'START_WORK' }).catch(() => {})
    }
  }, [user?.is_staff, assignmentId])

  const handleFileError = useCallback((msg: string) => toast(msg, 'error'), [toast])

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextResponse(e.target.value)
    if (!startWorkFired.current && !user?.is_staff && assignmentId) {
      startWorkFired.current = true
      api.post(`/assignments/${assignmentId}/events/`, { event_type: 'START_WORK' }).catch(() => {})
    }
  }, [user?.is_staff, assignmentId])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.repeat) return  // ignore key auto-repeat
    keystrokes.current++
    const t = Date.now() - pageLoadTime.current
    keylogBuffer.current.push({ key: e.key, t })
    if (localStorage.getItem('labworks_debug') === 'true') {
      console.log(`[LW] KEY "${e.key}" t=${t}ms total=${keystrokes.current}`)
    }
    // Debounce: отправить батч через 1 секунду паузы
    if (keylogDebounce.current) clearTimeout(keylogDebounce.current)
    keylogDebounce.current = setTimeout(() => {
      const batch = keylogBuffer.current.splice(0)
      if (batch.length === 0) return
      const dbg = localStorage.getItem('labworks_debug') === 'true'
      if (dbg) console.log(`[LW] KEYLOG_BATCH (debounce) | keys=${batch.length}`, batch)
      if (assignmentId) {
        api.post(`/assignments/${assignmentId}/events/`, {
          event_type: 'KEYLOG_BATCH',
          metadata: { keys: batch },
        }).catch(() => {})
      }
    }, 1000)
  }, [assignmentId])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text')
    pasteCount.current++
    pasteChars.current += text.length
    if (localStorage.getItem('labworks_debug') === 'true') {
      console.log(`[LW] PASTE_DETECTED #${pasteCount.current} | len=${text.length} | content="${text.slice(0, 200)}"`)
    }
    if (assignmentId) {
      api.post(`/assignments/${assignmentId}/events/`, {
        event_type: 'PASTE_DETECTED',
        metadata: { length: text.length },
      }).catch(() => {})
    }
  }, [assignmentId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!assignmentId || !assignment) return
    if (submitting) return

    if (remaining === 0) {
      toast('Задание закрыто — срок сдачи истёк', 'error')
      return
    }

    const form = new FormData()
    form.append('assignment', assignmentId)
    if (file) form.append('file', file)
    if (textResponse.trim()) form.append('text_response', textResponse)
    // Behavior analytics
    const totalChars = textResponse.length
    const pasteRatio = totalChars > 0 ? pasteChars.current / totalChars : 0
    let gptScore = 0
    if (clipboardChanges.current >= 3) gptScore += 3
    if (pasteRatio > 0.7) gptScore += 3
    if (keystrokes.current < 50 && totalChars > 200) gptScore += 2
    if (tabSwitches.current > 3) gptScore += 1
    if (pasteCount.current > 2) gptScore += 1
    // Flush remaining keylog batch before submit
    const finalKeylog = keylogBuffer.current.splice(0)
    if (finalKeylog.length > 0) {
      api.post(`/assignments/${assignmentId}/events/`, {
        event_type: 'KEYLOG_BATCH',
        metadata: { keys: finalKeylog },
      }).catch(() => {})
    }
    form.append('behavior_clipboard_changes', String(clipboardChanges.current))
    form.append('behavior_paste_count', String(pasteCount.current))
    form.append('behavior_paste_chars', String(pasteChars.current))
    form.append('behavior_keystrokes', String(keystrokes.current))
    form.append('behavior_tab_switches', String(tabSwitches.current))
    form.append('behavior_gpt_score', String(Math.min(10, gptScore)))
    setSubmitting(true)
    try {
      await api.post('/submissions/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 2000)
      toast('Работа успешно отправлена!', 'success')
      setFile(null)
      setTextResponse('')
      refreshSubmissions()
    } catch (err) {
      toast(parseApiError(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function downloadZip() {
    if (!user?.is_staff || !assignmentId) return
    fetch(`${base}/export/assignment/${assignmentId}/`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access')}` },
    })
      .then((r) => r.blob())
      .then((b) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = `${assignment?.title || 'submissions'}.zip`
        a.click()
      })
      .catch(() => toast('Ошибка скачивания', 'error'))
  }

  function downloadSubmissionFile(url: string) {
    fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access') || ''}` },
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
          throw new Error()
        }
        const cd = r.headers.get('Content-Disposition') || ''
        const match = cd.match(/filename="?([^"]+)"?/)
        const filename = match?.[1] || 'submission'
        return { blob: await r.blob(), filename }
      })
      .then((res) => {
        if (!res) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(res.blob)
        a.download = res.filename
        a.click()
      })
      .catch(() => toast('Нет файла для скачивания', 'error'))
  }

  function downloadAssignmentFile(url: string) {
    fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access') || ''}` },
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
          throw new Error()
        }
        const cd = r.headers.get('Content-Disposition') || ''
        const match = cd.match(/filename="?([^"]+)"?/)
        const filename = match?.[1] || 'file'
        return { blob: await r.blob(), filename }
      })
      .then((res) => {
        if (!res) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(res.blob)
        a.download = res.filename
        a.click()
      })
      .catch(() => toast('Ошибка скачивания', 'error'))
  }

  if (errorCode === 403) return <AssignmentForbidden />
  if (errorCode === 404) return <AssignmentNotFound />

  if (!user?.is_staff && !user?.totp_enabled) {
    return (
      <div className="twofa-gate page-enter">
        <Shield size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
        <h2>Требуется двухфакторная аутентификация</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Для доступа к заданиям необходимо подключить Google Authenticator.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/account')}>
          Подключить 2FA
        </button>
      </div>
    )
  }

  if (!assignment) {
    return (
      <div style={{ padding: '2rem' }}>
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    )
  }

  const status = getStatus(assignment)
  const allowedExtensions = assignment.allowed_extensions
    ? assignment.allowed_extensions.split(',').map((e) => e.trim()).filter(Boolean)
    : []
  let timerLevel: string
  if (status === 'pending') {
    timerLevel = 'pending'
  } else if (status === 'closed') {
    timerLevel = 'closed'
  } else if (remaining >= ONE_HOUR_MS) {
    timerLevel = 'long'
  } else if (remaining >= TWENTY_MINUTES_MS) {
    timerLevel = 'medium'
  } else {
    timerLevel = 'short'
  }

  return (
    <div className="assignment-layout page-enter">
      <div ref={leftColRef} className="assignment-left">
        <Link
          to={`/course/${assignment.course}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', marginBottom: '1rem' }}
        >
          <ArrowLeft size={16} /> Назад к заданиям
        </Link>

        {user?.is_staff ? (
          <>
            <div className="glass" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <button type="button" className="btn btn-primary" onClick={downloadZip} style={{ width: '100%' }}>
                <FileArchive size={18} /> Скачать все работы (ZIP)
              </button>
            </div>

            {submissions.length > 0 && (
              <div className="glass" style={{ padding: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>
                  Сдачи ({submissions.length})
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {submissions.map((s) => (
                    <li key={s.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem', marginBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <span style={{ flex: 1, fontSize: '0.9rem' }}>
                          {s.student_username && (
                            <strong style={{ color: 'var(--text)' }}>{s.student_username} — </strong>
                          )}
                          <span style={{ color: 'var(--text-muted)' }}>
                            {new Date(s.submitted_at).toLocaleString('ru')}
                          </span>
                        </span>
                        {s.verification_short && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace', fontSize: '0.78rem' }}
                            title="Верификационный ключ (нажмите для подробностей)"
                            onClick={() => setExpandedVerify(expandedVerify === s.id ? null : s.id)}
                          >
                            <KeyRound size={14} /> {s.verification_short}…
                          </button>
                        )}
                        {s.file_url && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ padding: '0.35rem 0.6rem' }}
                            onClick={() => downloadSubmissionFile(s.file_url!)}
                            title="Скачать файл"
                          >
                            <Download size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '0.35rem 0.6rem' }}
                          onClick={() => setCommentFor(s.id)}
                          title="Комментарии"
                        >
                          <MessageSquare size={16} />
                        </button>
                      </div>
                      {expandedVerify === s.id && s.verification_payload && (
                        <div className="verify-expand">
                          <div className="verify-row">
                            <span className="verify-label">Payload</span>
                            <span className="verify-value">{s.verification_payload}</span>
                            <button type="button" className="btn btn-ghost" style={{ padding: '0.2rem 0.4rem' }}
                              onClick={() => { navigator.clipboard.writeText(s.verification_payload!); toast('Скопировано', 'success') }}>
                              <Copy size={13} />
                            </button>
                          </div>
                          {s.verification_signature && (
                            <div className="verify-row">
                              <span className="verify-label">HMAC-SHA256</span>
                              <span className="verify-value" style={{ wordBreak: 'break-all' }}>{s.verification_signature}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {submissions.length === 0 && (
              <p style={{ color: 'var(--text-muted)' }}>Пока нет сдач.</p>
            )}

            <AssignmentFileBlock
              fileUrl={assignment.file_url}
              assignmentMarkdown={assignmentMarkdown}
              markdownComponents={markdownComponents}
              onDownload={downloadAssignmentFile}
            />
          </>
        ) : (
          <>
            {submissions.length > 0 && (
              <div className="glass" style={{ padding: '1rem', marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Мои сдачи</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {submissions.map((s) => (
                    <li
                      key={s.id}
                      style={{
                        padding: '0.5rem 0',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        {new Date(s.submitted_at).toLocaleString('ru')}
                      </span>
                      {s.verification_short && (
                        <span className="verify-key-badge" title="Верификационный ключ вашей сдачи">
                          <KeyRound size={12} /> {s.verification_short}…
                        </span>
                      )}
                      {s.file_url && status !== 'closed' && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '0.35rem 0.6rem' }}
                          onClick={() => downloadSubmissionFile(s.file_url!)}
                        >
                          <Download size={16} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <AssignmentFileBlock
              fileUrl={assignment.file_url}
              assignmentMarkdown={assignmentMarkdown}
              markdownComponents={markdownComponents}
              onDownload={downloadAssignmentFile}
            />

            {submitSuccess && (
              <div className="submit-success-banner">
                <CheckCircle2 size={20} /> Работа принята!
              </div>
            )}

            <div className="glass" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Отправить работу</h3>
              <form onSubmit={submit}>
                <FileDropzone
                  onFile={handleFileSelect}
                  onError={handleFileError}
                  allowedExtensions={allowedExtensions.length ? allowedExtensions : undefined}
                />
                <label style={{ marginTop: '1rem' }}>Текстовый ответ</label>
                <textarea
                  className="input"
                  rows={4}
                  value={textResponse}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  style={{ resize: 'vertical' }}
                  placeholder="Необязательно — опишите ваш подход..."
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={status === 'closed' || status === 'pending' || remaining <= 0 || submitting}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  {submitting ? 'Отправка…' : 'Отправить'}
                </button>
                {status === 'closed' && (
                  <p style={{ marginTop: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>
                    Срок сдачи истёк
                  </p>
                )}
              </form>
            </div>
          </>
        )}
      </div>

      <div className="assignment-right" style={rightColMinHeight ? { minHeight: rightColMinHeight } : undefined}>
        <div className="glass assignment-info-card assignment-info-card--scrolls">
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.35rem' }}>{assignment.title}</h1>
          <div style={{ marginBottom: '1rem' }}>
            <span className={`status-badge status-${status} timer-${timerLevel}`}>{STATUS_LABELS[status]}</span>
          </div>
          <div className={`timer-block ${status === 'closing-soon' ? 'timer-block--urgent' : ''}`}>
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
          <p className="timer-warning-text">
            После истечения таймера задание автоматически закрывается, и отправка решения становится недоступной.
          </p>
          <div className="info-row">
            <Calendar size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 2 }}>Открытие</div>
              <div style={{ fontSize: '0.9rem' }}>{new Date(assignment.open_time).toLocaleString('ru')}</div>
            </div>
          </div>
          <div className="info-row">
            <Calendar size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 2 }}>Закрытие</div>
              <div style={{ fontSize: '0.9rem' }}>{new Date(assignment.close_time).toLocaleString('ru')}</div>
            </div>
          </div>
          {allowedExtensions.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Допустимые форматы</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allowedExtensions.map((ext) => (
                  <span key={ext} className="ext-badge">.{ext}</span>
                ))}
              </div>
            </div>
          )}
          {assignment.description && (
            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Описание</div>
              <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {assignment.description}
              </p>
            </div>
          )}
        </div>
      </div>

      <Modal open={commentFor !== null} onClose={() => setCommentFor(null)} title="Комментарии">
        {commentFor !== null && <CommentSection submissionId={commentFor} />}
      </Modal>
    </div>
  )
}

function AssignmentForbidden() {
  const navigate = useNavigate()
  return (
    <div className="page-enter error-page-wrap">
      <div
        className="glass"
        style={{ padding: '2rem', textAlign: 'center' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '999px',
              border: '1px solid var(--border)',
              background:
                'radial-gradient(circle at 30% 20%, rgba(59,130,246,0.5), rgba(15,23,42,0.9))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={40} style={{ color: '#fbbf24' }} />
          </div>
        </div>
        <h1 className="error-title">Доступ к заданию ограничен</h1>
        <p className="error-subtitle">
          Возможно, вы не состоите в группе, для которой открыто это задание, или у вас нет прав
          на просмотр. Обратитесь к преподавателю или администратору, если считаете, что это
          ошибка.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/')}
          >
            На главную
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/account')}
          >
            Аккаунт
          </button>
        </div>
      </div>
    </div>
  )
}

function AssignmentNotFound() {
  const navigate = useNavigate()
  return (
    <div className="page-enter error-page-wrap">
      <div
        className="glass"
        style={{ padding: '2rem', textAlign: 'center' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '999px',
              border: '1px solid var(--border)',
              background:
                'radial-gradient(circle at 30% 20%, rgba(96,165,250,0.6), rgba(15,23,42,0.9))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Search size={38} style={{ color: 'var(--text)' }} />
          </div>
        </div>
        <h1 className="error-title">Задание не найдено (404)</h1>
        <p className="error-subtitle">
          Возможно, задание было удалено, ссылка устарела или вы перешли по неверному адресу.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/')}
          >
            К курсам
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(-1)}
          >
            Назад
          </button>
        </div>
      </div>
    </div>
  )
}
