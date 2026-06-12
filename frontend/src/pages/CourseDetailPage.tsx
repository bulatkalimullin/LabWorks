import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Assignment, type Course } from '../api/client'
import { useAuth } from '../context/AuthContext'
import AssignmentCourseRow from '../components/AssignmentCourseRow'
import { assignmentRealtimeStore } from '../lib/assignmentRealtimeStore'
import { ArrowLeft, ChevronLeft, ChevronRight, Shield } from 'lucide-react'

const ROTATE_BG_INTERVAL_MS = 5500

function CoursePageBackground({ images }: { images: NonNullable<Course['images']> }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (images.length <= 1) return
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), ROTATE_BG_INTERVAL_MS)
    return () => clearInterval(id)
  }, [images.length])
  if (images.length === 0) return null
  return (
    <div className="course-page-bg" aria-hidden>
      <div
        key={images[index].id}
        className="course-page-bg-slide"
        style={{ backgroundImage: `url(${images[index].image})` }}
      />
    </div>
  )
}

function CourseGallery({ images }: { images: NonNullable<Course['images']> }) {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % images.length)
    }, 4000)
  }

  useEffect(() => {
    if (images.length > 1) startTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [images.length])

  const goTo = (idx: number) => {
    setCurrent(idx)
    startTimer()
  }
  const prev = () => goTo((current - 1 + images.length) % images.length)
  const next = () => goTo((current + 1) % images.length)

  if (images.length === 0) return null

  return (
    <div className="course-gallery">
      <div className="course-gallery-main">
        <img
          key={images[current].id}
          src={images[current].image}
          alt={images[current].title || ''}
          className="course-gallery-img"
        />
        {images[current].title && (
          <div className="course-gallery-caption">{images[current].title}</div>
        )}
        {images.length > 1 && (
          <>
            <button type="button" className="course-gallery-arrow course-gallery-arrow-left" onClick={prev} aria-label="Предыдущее">
              <ChevronLeft size={20} />
            </button>
            <button type="button" className="course-gallery-arrow course-gallery-arrow-right" onClick={next} aria-label="Следующее">
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="course-gallery-dots">
          {images.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`course-gallery-dot${idx === current ? ' active' : ''}`}
              onClick={() => goTo(idx)}
              aria-label={`Фото ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!courseId) return
    api.get(`/courses/${courseId}/`)
      .then((r) => setCourse(r.data))
      .catch(() => {})
    api.get('/assignments/')
      .then((r) => {
        const list = (r.data as Assignment[]).filter(
          (a) => a.course === Number(courseId) || a.course_id === Number(courseId)
        )
        setAssignments(list)
        list.forEach((a) => assignmentRealtimeStore.mergeAssignment(a))
      })
      .catch(() => setAssignments([]))
  }, [courseId])

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
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
        <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 1.5rem' }}>
          Для доступа к курсам необходимо подключить двухфакторную аутентификацию.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/account')}>
          Подключить 2FA
        </button>
      </div>
    )
  }

  const images = course?.images ?? []

  return (
    <div className="course-detail-wrap page-enter">
      {images.length > 0 && <CoursePageBackground images={images} />}
      <div className="course-detail-content" style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1rem' }}>
        <ArrowLeft size={18} /> К курсам
      </Link>

      <h1 style={{ marginBottom: images.length > 0 ? '1rem' : '1.5rem' }}>
        {course?.name ?? 'Задания'}
      </h1>

      {images.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <CourseGallery images={images} />
        </div>
      )}

      <h2 style={{ marginBottom: '0.75rem', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Задания</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {assignments.map((a) => (
          <AssignmentCourseRow key={a.id} assignment={a} />
        ))}
      </ul>
      {assignments.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Нет доступных заданий.</p>}
      </div>
    </div>
  )
}
