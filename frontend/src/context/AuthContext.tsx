import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { api } from '../api/client'

export type User = {
  id: number
  username: string
  full_name: string
  is_staff: boolean
  totp_enabled?: boolean
  label?: string
}

type AuthContextType = {
  user: User | null
  isLoading: boolean
  setTokens: (access: string, refresh: string) => void
  setUser: (u: User | null) => void
  refreshUser: () => Promise<User | null>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

function clearAuthStorage() {
  localStorage.removeItem('access')
  localStorage.removeItem('refresh')
  localStorage.removeItem('user')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(() => !!localStorage.getItem('access'))

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!localStorage.getItem('access')) {
      setUser(null)
      return null
    }
    try {
      const { data } = await api.get<User>('/auth/me/')
      setUser(data)
      return data
    } catch {
      clearAuthStorage()
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    localStorage.removeItem('user')
    const access = localStorage.getItem('access')
    if (!access) {
      setIsLoading(false)
      return
    }
    refreshUser().finally(() => setIsLoading(false))
  }, [refreshUser])

  const setTokens = useCallback((access: string, refresh: string) => {
    localStorage.setItem('access', access)
    localStorage.setItem('refresh', refresh)
  }, [])

  const logout = useCallback(() => {
    clearAuthStorage()
    setUser(null)
  }, [])

  // Single-session: hidden auth check every 5s; on 401 (e.g. new login elsewhere) logout
  useEffect(() => {
    if (!user || !localStorage.getItem('access')) return
    const id = setInterval(() => {
      const refresh = localStorage.getItem('refresh')
      if (!refresh) return
      api.post('/auth/sync/', { r: refresh }).catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 401) {
          logout()
          window.location.replace('/login')
        }
      })
    }, 5000)
    return () => clearInterval(id)
  }, [user, logout])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        setTokens,
        setUser,
        refreshUser,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}

export async function loginApi(username: string, password: string, totpCode?: string) {
  const body: Record<string, string> = { username, password }
  if (totpCode) body.totp_code = totpCode
  const { data } = await api.post('/auth/login/', body)
  return data as { access: string; refresh: string; user: User }
}

export async function registerApi(body: {
  username: string
  full_name: string
  password: string
  student_group_id?: number | null
}) {
  const { data } = await api.post('/auth/register/', body)
  return data as { access: string; refresh: string; user: User }
}
