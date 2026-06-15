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
        localStorage.removeItem('user')
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
  effective_close_time?: string
  student_groups?: number[]
  files?: string | null
  file_url?: string | null
  auto_deploy?: boolean
}

export type DeadlineOverride = {
  id: number
  assignment: string
  close_time: string
  user: number | null
  student_group: number | null
  user_username?: string
  group_name?: string
  updated_at?: string
}

export type AdminUser = {
  id: number
  username: string
  full_name: string
  is_staff: boolean
  is_active: boolean
  label?: string
  totp_enabled?: boolean
  student_groups?: number[]
}
