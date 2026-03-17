import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Course, type CourseImage, type Assignment } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { usePublicSettings } from '../context/PublicSettingsContext'
import { BookOpen, Shield, FileText } from 'lucide-react'

function assignmentIsAvailable(a: Assignment): boolean {
  const now = Date.now()
  const open = new Date(a.open_time).getTime()
  const close = new Date(a.close_time).getTime()
  return now >= open && now <= close
}

const ROTATE_BG_INTERVAL_MS = 5000

function CourseCardBackground({ images, courseName }: { images: CourseImage[]; courseName: string }) {
  const n = images.length
  const [state, setState] = useState(() => ({
    showFirst: true,
    slot1Index: 0,
    slot2Index: n > 1 ? 1 : 0,
  }))
  useEffect(() => {
    if (n <= 1) return
    const id = setInterval(() => {
      setState((prev) => {
        const newShowFirst = !prev.showFirst
        if (newShowFirst === false) {
          return { ...prev, showFirst: false, slot1Index: (prev.slot2Index + 1) % n }
        }
        return { ...prev, showFirst: true, slot2Index: (prev.slot1Index + 1) % n }
      })
    }, ROTATE_BG_INTERVAL_MS)
    return () => clearInterval(id)
  }, [n])
  if (n === 0) return null
  const stacked = n > 1
  return (
    <div className={`course-card-image-wrap${stacked ? ' course-card-image-wrap--stacked' : ''}`}>
      <img
        src={images[state.slot1Index].image}
        alt={courseName}
        className="course-card-image course-card-image--crossfade"
        style={{ opacity: state.showFirst ? 1 : 0 }}
      />
      {stacked && (
        <img
          src={images[state.slot2Index].image}
          alt=""
          aria-hidden
          className="course-card-image course-card-image--crossfade"
          style={{ opacity: state.showFirst ? 0 : 1 }}
        />
      )}
      <div className="course-card-image-overlay" />
    </div>
  )
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const { isAuthenticated, user } = useAuth()
  const { registration_open } = usePublicSettings()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated && (user?.is_staff || user?.totp_enabled)) {
      api.get('/courses/').then((r) => setCourses(r.data)).catch(() => setCourses([]))
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    if (!isAuthenticated || !(user?.is_staff || user?.totp_enabled)) return
    api.get('/assignments/').then((r) => setAssignments(r.data || [])).catch(() => setAssignments([]))
  }, [isAuthenticated, user])

  const availableCountByCourse = useMemo(() => {
    const map: Record<number, number> = {}
    for (const a of assignments) {
      const cid = a.course_id ?? a.course
      if (cid == null) continue
      if (user?.is_staff) {
        if (assignmentIsAvailable(a)) map[cid] = (map[cid] ?? 0) + 1
      } else {
        map[cid] = (map[cid] ?? 0) + 1
      }
    }
    return map
  }, [assignments, user?.is_staff])

  if (!isAuthenticated) {
    return (
      <div className="container-narrow page-enter" style={{ paddingTop: '4rem', textAlign: 'center' }}>
        <div className="glass" style={{ padding: '2.5rem' }}>
          <BookOpen size={48} style={{ opacity: 0.6, marginBottom: 16 }} />
          <h1>Система лабораторных</h1>
          <p style={{ color: 'var(--text-muted)' }}>Войдите или зарегистрируйтесь</p>
          <Link to="/login" className="btn btn-primary" style={{ marginRight: 8 }}>Войти</Link>
          {registration_open && <Link to="/register" className="btn btn-ghost">Регистрация</Link>}
        </div>
      </div>
    )
  }

  if (!user?.is_staff && !user?.totp_enabled) {
    return (
      <div className="twofa-gate page-enter">
        <Shield size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
        <h2>Требуется двухфакторная аутентификация</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 1.5rem' }}>
          Для доступа к курсам необходимо подключить двухфакторную аутентификацию (Google Authenticator).
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/account')}>
          Подключить 2FA
        </button>
      </div>
    )
  }

  return (
    <div className="courses-page-wrap page-enter">
      <h1 style={{ marginBottom: '1.5rem' }}>Курсы</h1>
      <div className="courses-grid">
        {courses.map((c) => (
          <div
            key={c.id}
            className="glass card-hover course-card"
          >
            {availableCountByCourse[c.id] != null && availableCountByCourse[c.id] > 0 && (
              <span className="course-card-badge-corner" title="Доступны задания для сдачи">
                <FileText size={14} />
                Есть задание
              </span>
            )}
            {c.images && c.images.length > 0 ? (
              <CourseCardBackground images={c.images} courseName={c.name} />
            ) : c.cover_image ? (
              <div className="course-card-image-wrap">
                <img src={c.cover_image} alt={c.name} className="course-card-image" />
                <div className="course-card-image-overlay" />
              </div>
            ) : null}
            <div className="course-card-body">
              <h3 style={{ margin: '0 0 0.75rem' }}>{c.name}</h3>
              <Link to={`/course/${c.id}`} className="btn btn-primary">Открыть</Link>
            </div>
          </div>
        ))}
      </div>
      {courses.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Курсов пока нет.</p>}
    </div>
  )
}
