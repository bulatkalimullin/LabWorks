import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { api, type Course, type CourseImage, type Assignment } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { BookOpen, Shield, FileText } from 'lucide-react'

function assignmentIsAvailable(a: Assignment): boolean {
  const now = Date.now()
  const open = new Date(a.open_time).getTime()
  const close = new Date(a.close_time).getTime()
  return now >= open && now <= close
}

const ROTATE_BG_INTERVAL_MS = 5000

function CourseCardBackground({ images, courseName }: { images: CourseImage[]; courseName: string }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (images.length <= 1) return
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), ROTATE_BG_INTERVAL_MS)
    return () => clearInterval(id)
  }, [images.length])
  if (images.length === 0) return null
  return (
    <div className="course-card-image-wrap">
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={images[index].id}
          src={images[index].image}
          alt={courseName}
          className="course-card-image"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        />
      </AnimatePresence>
      <div className="course-card-image-overlay" />
    </div>
  )
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const { isAuthenticated, user } = useAuth()
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
        <motion.div className="glass" style={{ padding: '2.5rem' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <BookOpen size={48} style={{ opacity: 0.6, marginBottom: 16 }} />
          <h1>Система лабораторных</h1>
          <p style={{ color: 'var(--text-muted)' }}>Войдите или зарегистрируйтесь</p>
          <Link to="/login" className="btn btn-primary" style={{ marginRight: 8 }}>Войти</Link>
          <Link to="/register" className="btn btn-ghost">Регистрация</Link>
        </motion.div>
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
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }} className="page-enter">
      <h1 style={{ marginBottom: '1.5rem' }}>Курсы</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {courses.map((c, i) => (
          <motion.div
            key={c.id}
            className="glass card-hover course-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
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
          </motion.div>
        ))}
      </div>
      {courses.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Курсов пока нет.</p>}
    </div>
  )
}
