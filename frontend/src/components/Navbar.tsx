import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePublicSettings } from '../context/PublicSettingsContext'
import { BarChart2, BookOpen, Clock, LogOut, User, Shield } from 'lucide-react'

function getTokenExpirySeconds(): number | null {
  try {
    const token = localStorage.getItem('access')
    if (!token) return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    ) as { exp?: number }
    if (typeof payload.exp !== 'number') return null
    const remaining = payload.exp - Math.floor(Date.now() / 1000)
    return Math.max(0, remaining)
  } catch {
    return null
  }
}

function formatRemaining(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${m}:${pad(s)}`
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const { registration_open } = usePublicSettings()
  const [sessionRemaining, setSessionRemaining] = useState<number | null>(() => getTokenExpirySeconds())

  useEffect(() => {
    if (!isAuthenticated) {
      setSessionRemaining(null)
      return
    }
    const tick = () => {
      const sec = getTokenExpirySeconds()
      setSessionRemaining(sec)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isAuthenticated])

  return (
    <nav className="nav-bar">
      <Link to="/" className="nav-brand">
        <BookOpen size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
        Лабораторные
      </Link>
      <div className="nav-links">
        {isAuthenticated ? (
          <>
            {sessionRemaining !== null && (
              <span className="nav-session-remaining" title="До конца сессии">
                <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {sessionRemaining > 0 ? formatRemaining(sessionRemaining) : '0:00'}
              </span>
            )}
            {user?.is_staff && (
              <>
                <Link to="/admin"><BarChart2 size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />Админ</Link>
                <Link to="/teacher"><Shield size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />Панель</Link>
              </>
            )}
            <Link to="/submissions"><User size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />Мои работы</Link>
            <Link to="/account">Аккаунт</Link>
            <button type="button" onClick={logout}><LogOut size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />Выйти</button>
          </>
        ) : (
          <>
            <Link to="/login">Войти</Link>
            {registration_open && <Link to="/register">Регистрация</Link>}
          </>
        )}
      </div>
    </nav>
  )
}
