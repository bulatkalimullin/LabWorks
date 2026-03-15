import { NavLink, useNavigate } from 'react-router-dom'
import { BookOpen, FileText, Home, LogOut, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

const navItems = [
  { to: '/admin', label: 'Дашборд', icon: Home, exact: true },
  { to: '/admin/submissions', label: 'Сдачи', icon: FileText, exact: false },
  { to: '/admin/users', label: 'Студенты', icon: Users, exact: false },
  { to: '/', label: 'К пользователю', icon: BookOpen, exact: false },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button
          type="button"
          className="admin-sidebar-brand"
          onClick={() => navigate('/')}
        >
          <BookOpen size={20} />
          <span>FileComp</span>
        </button>
        <nav className="admin-sidebar-nav">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `admin-nav-item${isActive ? ' active' : ''}`
              }
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <span className="admin-sidebar-avatar">
              {user?.username?.[0]?.toUpperCase()}
            </span>
            <div className="admin-sidebar-userinfo">
              <div className="admin-sidebar-username">{user?.username}</div>
              <div className="admin-sidebar-role">Администратор</div>
            </div>
          </div>
          <button
            type="button"
            className="admin-sidebar-logout"
            onClick={handleLogout}
          >
            <LogOut size={14} />
            <span>Выйти</span>
          </button>
        </div>
      </aside>
      <main className="admin-content">
        {children}
      </main>
    </div>
  )
}