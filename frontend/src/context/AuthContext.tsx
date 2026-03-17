import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { api } from '../api/client'

export type User = { id: number; username: string; full_name: string; is_staff: boolean; totp_enabled?: boolean }

type AuthContextType = {
  user: User | null
  setTokens: (access: string, refresh: string) => void
  setUser: (u: User | null) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('user')
    if (raw) try { return JSON.parse(raw) } catch {}
    return null
  })

  const setTokens = useCallback((access: string, refresh: string) => {
    localStorage.setItem('access', access)
    localStorage.setItem('refresh', refresh)
  }, [])

  const setUserPersist = useCallback((u: User | null) => {
    setUser(u)
    if (u) localStorage.setItem('user', JSON.stringify(u))
    else localStorage.removeItem('user')
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  // Single-session: hidden auth check every 5s; on 401 (e.g. new login elsewhere) logout
  useEffect(() => {
    const hasAuth = !!user && !!localStorage.getItem('access')
    if (!hasAuth) return
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
        setTokens,
        setUser: setUserPersist,
        logout,
        isAuthenticated: !!user && !!localStorage.getItem('access'),
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
