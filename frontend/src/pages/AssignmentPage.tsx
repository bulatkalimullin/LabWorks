import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api, type Assignment, parseApiError } from '../api/client'
import { triggerNativeDownload } from '../lib/download'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import AssignmentLiveSidebar from '../components/AssignmentLiveSidebar'
import AssignmentDeadlinePanel from '../components/AssignmentDeadlinePanel'
import { useAssignmentLive } from '../hooks/useAssignmentLive'
import { assignmentRealtimeStore } from '../lib/assignmentRealtimeStore'
import FileDropzone from '../components/FileDropzone'
import CommentSection from '../components/CommentSection'
import Modal from '../components/Modal'
import MermaidBlock from '../components/MermaidBlock'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  KeyRound,
  MessageSquare,
  Search,
  Shield,
  Rocket,
} from 'lucide-react'

type DeploymentInfo = {
  status: string
  access_urls: { service: string; container_port?: number; host_port?: number; url: string }[]
  traceback?: string
  public_base_url?: string
  last_submission_uuid?: string | null
  updated_at?: string
}

type Submission = {
  id: number
  uuid?: string
  assignment: string
  submitted_at: string
  file_url: string | null
  text_response: string | null
  student_username?: string
  verification_short?: string | null
  verification_payload?: string | null
  verification_signature?: string | null
  student_deployment?: DeploymentInfo | null
}

function getFileExtension(path: string): string {
  const basename = path.split('?')[0].split('/').pop() || ''
  const parts = basename.split('.')
  if (parts.length < 2) return ''
  return parts[parts.length - 1].toLowerCase()
}

function isMarkdownFile(filesPath: string | null | undefined): boolean {
  return getFileExtension(filesPath ?? '') === 'md'
}

// Extracted shared component for assignment file block
function AssignmentFileBlock({
  fileUrl,
  isMarkdown,
  assignmentMarkdown,
  markdownLoading,
  markdownError,
  markdownComponents,
  onDownload,
}: {
  fileUrl: string | null | undefined
  isMarkdown: boolean
  assignmentMarkdown: string | null
  markdownLoading: boolean
  markdownError: boolean
  markdownComponents: Record<string, unknown>
  onDownload?: (url: string) => void
}) {
  return (
    <div className="glass" style={{ padding: '1.25rem', marginBottom: '1rem', marginTop: '1rem' }}>
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Файл задания</h3>
      {fileUrl
        ? (isMarkdown ? (
          <>
            {markdownLoading && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
                Загрузка файла задания…
              </p>
            )}
            {markdownError && (
              <p style={{ fontSize: '0.85rem', color: 'var(--danger)', margin: '0 0 0.75rem' }}>
                Не удалось загрузить файл задания для просмотра.
              </p>
            )}
            {assignmentMarkdown && (
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
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents as Parameters<typeof ReactMarkdown>[0]['components']}
                >
                  {assignmentMarkdown}
                </ReactMarkdown>
              </div>
            )}
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
  const [submissionClosed, setSubmissionClosed] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expandedVerify, setExpandedVerify] = useState<number | null>(null)
  const [assignmentMarkdown, setAssignmentMarkdown] = useState<string | null>(null)
  const [markdownLoading, setMarkdownLoading] = useState(false)
  const [markdownError, setMarkdownError] = useState(false)
  const [errorCode, setErrorCode] = useState<403 | 404 | null>(null)
  const startWorkFired = useRef(false)
  const leftColRef = useRef<HTMLDivElement>(null)
  const rightColRef = useRef<HTMLDivElement>(null)
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
  const { user, isLoading } = useAuth()
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
        const codeString = String(children ?? '').replace(/\n$/, '')
        if ((className || '').includes('language-mermaid')) {
          return <MermaidBlock chart={codeString} />
        }
        const isBlock = (className || '').includes('language-') || codeString.includes('\n')
        if (isBlock) {
          return (
            <pre className="assignment-code-block">
              <code className={className} {...props}>{codeString}</code>
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
    if (!assignmentId || isLoading) return
    setErrorCode(null)
    api
      .get(`/assignments/${assignmentId}/`)
      .then((r) => {
        setAssignment(r.data)
        assignmentRealtimeStore.mergeAssignment(r.data)
      })
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
  }, [assignmentId, user?.is_staff, isLoading])

  const liveAssignment = useAssignmentLive(assignmentId, assignment ?? undefined)
  const handleClosedChange = useCallback((closed: boolean) => setSubmissionClosed(closed), [])

  // Markdown fetch with AbortController
  useEffect(() => {
    if (!liveAssignment?.file_url || !isMarkdownFile(liveAssignment.files)) {
      setAssignmentMarkdown(null)
      setMarkdownLoading(false)
      setMarkdownError(false)
      return
    }
    const controller = new AbortController()
    setMarkdownLoading(true)
    setMarkdownError(false)
    setAssignmentMarkdown(null)
    fetch(liveAssignment.file_url, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${localStorage.getItem('access') || ''}` },
    })
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((text) => {
        if (!controller.signal.aborted) {
          setAssignmentMarkdown(text)
          setMarkdownLoading(false)
        }
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name !== 'AbortError' && !controller.signal.aborted) {
          setAssignmentMarkdown(null)
          setMarkdownLoading(false)
          setMarkdownError(true)
        }
      })
    return () => controller.abort()
  }, [liveAssignment?.file_url, liveAssignment?.files])

  // Keep right column tall enough for sticky timer while reading long assignment
  useEffect(() => {
    const left = leftColRef.current
    const right = rightColRef.current
    if (!left || !right) return

    const syncHeight = () => {
      right.style.minHeight = `${left.offsetHeight}px`
    }

    const observer = new ResizeObserver(syncHeight)
    observer.observe(left)
    syncHeight()

    return () => observer.disconnect()
  }, [liveAssignment, assignmentMarkdown, markdownLoading, submissions.length, user?.is_staff])

  // Clipboard polling (anti-GPT monitoring) — только для студентов
  useEffect(() => {
    if (!assignmentId || isLoading || user?.is_staff) return
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
  }, [assignmentId, user?.is_staff, isLoading])

  // Keylog flush при размонтировании (финальный батч)
  useEffect(() => {
    if (!assignmentId || isLoading || user?.is_staff) return
    return () => {
      if (keylogDebounce.current) clearTimeout(keylogDebounce.current)
      const batch = keylogBuffer.current.splice(0)
      if (batch.length === 0) return
      api.post(`/assignments/${assignmentId}/events/`, {
        event_type: 'KEYLOG_BATCH',
        metadata: { keys: batch },
      }).catch(() => {})
    }
  }, [assignmentId, user?.is_staff, isLoading])

  const refreshSubmissions = useCallback(async () => {
    if (!assignmentId || !user || isLoading) return
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
  }, [assignmentId, user?.id, user?.is_staff, isLoading])

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

  const [deployingId, setDeployingId] = useState<number | null>(null)

  async function deploySubmission(submissionUuid: string, submissionId: number) {
    setDeployingId(submissionId)
    try {
      await api.post(`/submissions/${submissionUuid}/deploy/`)
      toast('Деплой поставлен в очередь', 'success')
      const r = await api.get(`/assignments/${assignmentId}/submissions/`)
      setSubmissions(r.data)
    } catch (err) {
      toast(parseApiError(err), 'error')
    } finally {
      setDeployingId(null)
    }
  }

  async function toggleAutoDeploy() {
    if (!liveAssignment) return
    try {
      const next = !liveAssignment.auto_deploy
      await api.patch(`/assignments/${liveAssignment.id}/`, { auto_deploy: next })
      setAssignment((a) => (a ? { ...a, auto_deploy: next } : a))
      toast(next ? 'Автодеплой включён' : 'Автодеплой выключен', 'success')
    } catch (err) {
      toast(parseApiError(err), 'error')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!assignmentId || !liveAssignment) return
    if (submitting) return

    if (submissionClosed) {
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
      await api.post('/submissions/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      })
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
        a.download = `${liveAssignment?.title || 'submissions'}.zip`
        a.click()
      })
      .catch(() => toast('Ошибка скачивания', 'error'))
  }

  function downloadSubmissionFile(url: string) {
    const token = localStorage.getItem('access') || ''
    if (!token) {
      toast('Войдите в аккаунт', 'error')
      return
    }
    triggerNativeDownload(url, token)
  }

  function downloadAssignmentFile(url: string) {
    const token = localStorage.getItem('access') || ''
    if (!token) {
      toast('Войдите в аккаунт', 'error')
      return
    }
    triggerNativeDownload(url, token)
  }

  if (errorCode === 403) return <AssignmentForbidden />
  if (errorCode === 404) return <AssignmentNotFound />

  if (isLoading) {
    return (
      <div style={{ padding: '2rem' }}>
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    )
  }

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

  if (!assignment || !liveAssignment) {
    return (
      <div style={{ padding: '2rem' }}>
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    )
  }

  const allowedExtensions = liveAssignment.allowed_extensions
    ? liveAssignment.allowed_extensions.split(',').map((e: string) => e.trim()).filter(Boolean)
    : []

  return (
    <div className="assignment-layout page-enter">
      <div ref={leftColRef} className="assignment-left">
        <Link
          to={`/course/${liveAssignment.course}`}
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

            <AssignmentDeadlinePanel assignment={liveAssignment} />

            <div className="glass" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!liveAssignment.auto_deploy}
                  onChange={toggleAutoDeploy}
                />
                <span>Автодеплой при сдаче (RabbitMQ → checker)</span>
              </label>
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
                        {s.file_url && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ padding: '0.35rem 0.6rem' }}
                            disabled={deployingId === s.id}
                            onClick={() => deploySubmission(String(s.uuid ?? s.id), s.id)}
                            title="Развернуть на checker"
                          >
                            <Rocket size={16} />
                          </button>
                        )}
                      </div>
                      {s.student_deployment && (
                        <div style={{ marginTop: 8, fontSize: '0.82rem' }}>
                          <strong>Деплой:</strong>{' '}
                          <span style={{
                            color: s.student_deployment.status === 'running' ? 'var(--success)' :
                              s.student_deployment.status === 'error' ? 'var(--danger)' : 'var(--text-muted)',
                          }}>
                            {s.student_deployment.status}
                          </span>
                          {s.student_deployment.access_urls?.length > 0 && (
                            <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                              {s.student_deployment.access_urls.map((u) => (
                                <li key={u.url}>
                                  <a href={u.url} target="_blank" rel="noreferrer">{u.service}: {u.url}</a>
                                </li>
                              ))}
                            </ul>
                          )}
                          {s.student_deployment.traceback && (
                            <details style={{ marginTop: 6 }}>
                              <summary style={{ color: 'var(--danger)', cursor: 'pointer' }}>Traceback</summary>
                              <pre style={{
                                fontSize: '0.75rem',
                                overflow: 'auto',
                                maxHeight: 200,
                                background: 'rgba(0,0,0,0.2)',
                                padding: 8,
                                borderRadius: 6,
                              }}>{s.student_deployment.traceback}</pre>
                            </details>
                          )}
                        </div>
                      )}
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
              isMarkdown={isMarkdownFile(assignment.files)}
              assignmentMarkdown={assignmentMarkdown}
              markdownLoading={markdownLoading}
              markdownError={markdownError}
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
                      {s.file_url && !submissionClosed && (
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
              fileUrl={liveAssignment.file_url}
              isMarkdown={isMarkdownFile(liveAssignment.files)}
              assignmentMarkdown={assignmentMarkdown}
              markdownLoading={markdownLoading}
              markdownError={markdownError}
              markdownComponents={markdownComponents}
              onDownload={downloadAssignmentFile}
            />

            {submitSuccess && (
              <div className="submit-success-banner">
                <CheckCircle2 size={20} /> Работа принята!
              </div>
            )}

            <div className={`glass ${submissionClosed ? 'submission-form--closed' : ''}`} style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Отправить работу</h3>
              <form onSubmit={submit}>
                <FileDropzone
                  onFile={handleFileSelect}
                  onError={handleFileError}
                  allowedExtensions={allowedExtensions.length ? allowedExtensions : undefined}
                  disabled={submissionClosed}
                />
                <label style={{ marginTop: '1rem' }}>Текстовый ответ</label>
                <textarea
                  className="input"
                  rows={4}
                  value={textResponse}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  disabled={submissionClosed}
                  style={{ resize: 'vertical' }}
                  placeholder="Необязательно — опишите ваш подход..."
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submissionClosed || submitting}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  {submitting ? 'Отправка…' : 'Отправить'}
                </button>
                {submissionClosed && (
                  <p style={{ marginTop: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>
                    Срок сдачи истёк
                  </p>
                )}
              </form>
            </div>
          </>
        )}
      </div>

      <div ref={rightColRef} className="assignment-right">
        <AssignmentLiveSidebar
          assignmentId={assignmentId!}
          base={assignment}
          onClosedChange={handleClosedChange}
        />
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
