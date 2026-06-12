import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePublicSettings } from '../context/PublicSettingsContext'
import { getSessionEndLabel, isSessionExpired } from '../lib/sessionExpiry'
import { BookOpen, Clock, ExternalLink, LogOut, User } from 'lucide-react'

export default function Navbar() {
  const { user, isAuthenticated, logout, isLoading } = useAuth()
  const { registration_open } = usePublicSettings()
  const [sessionEndLabel, setSessionEndLabel] = useState<string | null>(() => getSessionEndLabel())

  useEffect(() => {
    if (!isAuthenticated) {
      setSessionEndLabel(null)
      return
    }
    const sync = () => setSessionEndLabel(getSessionEndLabel())
    sync()
    const id = setInterval(() => {
      if (isSessionExpired()) {
        logout()
        window.location.replace('/login')
        return
      }
      sync()
    }, 60_000)
    return () => clearInterval(id)
  }, [isAuthenticated, logout])

  return (
    <nav className="nav-bar">
      <Link to="/" className="nav-brand">
        <BookOpen size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
        Лабораторные
      </Link>
      <div className="nav-links">
        {isLoading ? (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>…</span>
        ) : isAuthenticated ? (
          <>
            {sessionEndLabel && (
              <span className="nav-session-remaining" title="Сессия истечёт в">
                <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Сессия до {sessionEndLabel}
              </span>
            )}
            {user?.is_staff && (
              <a href="/admin/" target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Django Admin
              </a>
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
