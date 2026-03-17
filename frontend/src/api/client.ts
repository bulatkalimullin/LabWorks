import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || '/api/v1'

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const isSyncCheck = err.config?.url?.includes('auth/sync') ?? false
    if (
      err.response?.status === 401 &&
      localStorage.getItem('refresh') &&
      !isSyncCheck
    ) {
      try {
        const { data } = await axios.post(`${baseURL}/auth/refresh/`, {
          refresh: localStorage.getItem('refresh'),
        })
        localStorage.setItem('access', data.access)
        err.config.headers.Authorization = `Bearer ${data.access}`
        return api.request(err.config)
      } catch {
        localStorage.removeItem('access')
        localStorage.removeItem('refresh')
        window.location.replace('/login')
      }
    }
    return Promise.reject(err)
  }
)

export function parseApiError(err: unknown): string {
  const anyErr = err as { response?: { data?: any } }
  const data = anyErr.response?.data
  if (!data) return 'Произошла ошибка. Попробуйте ещё раз.'

  if (typeof data.detail === 'string') return data.detail

  if (typeof data === 'string') return data

  if (typeof data === 'object') {
    const parts: string[] = []
    for (const [field, value] of Object.entries(data)) {
      const label = field === 'non_field_errors' ? '' : `${field}: `
      if (Array.isArray(value)) {
        parts.push(`${label}${value.join(' ')}`.trim())
      } else if (typeof value === 'string') {
        parts.push(`${label}${value}`.trim())
      }
    }
    if (parts.length) return parts.join('; ')
  }

  return 'Произошла ошибка. Попробуйте ещё раз.'
}

export type CourseImage = { id: number; image: string; title?: string | null; order: number }
export type Course = {
  id: number
  name: string
  cover_image?: string | null
  images?: CourseImage[]
}
export type Assignment = {
  id: string
  title: string
  description: string
  course: number
  course_id?: number
  allowed_extensions: string
  open_time: string
  close_time: string
  file_url?: string | null
}

export const STUDENT_LABELS: { code: string; name: string }[] = [
  { code: 'strong', name: 'Сильный ученик' },
  { code: 'above_avg', name: 'Выше среднего' },
  { code: 'avg', name: 'Средний' },
  { code: 'struggling', name: 'Слабый' },
  { code: 'cheats', name: 'Списывает' },
  { code: 'gpt', name: 'GPT' },
  { code: 'gpt_suspected', name: 'Подозрение на GPT' },
  { code: 'plagiarism', name: 'Плагиат' },
  { code: 'plagiarism_suspected', name: 'Подозрение на плагиат' },
  { code: 'inactive', name: 'Неактивный' },
  { code: 'excellent', name: 'Отличник' },
  { code: 'creative', name: 'Творческий подход' },
  { code: 'hardworking', name: 'Трудолюбивый' },
  { code: 'fast', name: 'Быстрый' },
  { code: 'needs_help', name: 'Нуждается в помощи' },
  { code: 'improving', name: 'Прогрессирует' },
  { code: 'declining', name: 'Снизил активность' },
  { code: 'leader', name: 'Лидер' },
  { code: 'disruptive', name: 'Проблемный' },
  { code: 'absent', name: 'Часто отсутствует' },
]

export const LABEL_COLORS: Record<string, string> = {
  strong: '#10b981',
  above_avg: '#3b82f6',
  avg: '#94a3b8',
  struggling: '#f59e0b',
  cheats: '#ef4444',
  gpt: '#8b5cf6',
  gpt_suspected: '#a855f7',
  plagiarism: '#dc2626',
  plagiarism_suspected: '#f87171',
  inactive: '#6b7280',
  excellent: '#fbbf24',
  creative: '#06b6d4',
  hardworking: '#84cc16',
  fast: '#22c55e',
  needs_help: '#fb923c',
  improving: '#34d399',
  declining: '#e5c347',
  leader: '#818cf8',
  disruptive: '#f43f5e',
  absent: '#94a3b8',
}

export const SUBMISSION_FLAGS: { code: string; name: string }[] = [
  { code: 'suspicious', name: 'Подозрительное' },
  { code: 'plagiarism', name: 'Плагиат' },
  { code: 'gpt', name: 'GPT' },
  { code: 'excellent', name: 'Отличная работа' },
  { code: 'accepted', name: 'Зачтено' },
  { code: 'rejected', name: 'Не зачтено' },
  { code: 'needs_review', name: 'Требует проверки' },
  { code: 'revised', name: 'Исправлена' },
  { code: 'incomplete', name: 'Неполная' },
  { code: 'strong_work', name: 'Сильная работа' },
]

export type BehaviorEvent = {
  event_type: 'CLIPBOARD_CHANGE' | 'PASTE_DETECTED' | 'TAB_SWITCH' | 'KEYLOG_BATCH'
  created_at: string
  metadata: { content?: string; length?: number; keys?: { key: string; t: number }[]; [key: string]: unknown }
}

export type AdminSubmission = {
  id: number
  assignment: string
  assignment_title: string
  course_name: string
  student: number
  student_username: string
  student_full_name: string
  student_label: string
  student_label_display: string
  file_url: string | null
  text_response: string | null
  submitted_at: string
  admin_note: string
  admin_flags: string[]
  verification_payload: string | null
  verification_signature: string | null
  comments: AdminComment[]
  timing: {
    first_view_at: string | null
    first_start_at: string | null
    submit_at: string
    time_from_view_to_submit: number | null
    time_from_start_to_submit: number | null
  }
  behavior_clipboard_changes: number
  behavior_paste_count: number
  behavior_paste_chars: number
  behavior_keystrokes: number
  behavior_tab_switches: number
  behavior_gpt_score: number
  behavior_events: BehaviorEvent[]
}

export type AdminComment = {
  id: number
  author_username: string
  author_full_name: string
  text: string
  created_at: string
}

export type AdminUser = {
  id: number
  username: string
  full_name: string
  is_staff: boolean
  is_active: boolean
  label: string
  label_display: string
  totp_enabled: boolean
  submissions_count: number
  student_groups_names: string[]
  date_joined: string
}

export type AdminStats = {
  total_students: number
  total_courses: number
  total_assignments: number
  total_submissions: number
  recent_submissions: number
  submissions_by_day: { date: string; count: number }[]
  label_distribution: Record<string, number>
  top_assignments: { title: string; sub_count: number }[]
  student_labels: { code: string; name: string }[]
}
