import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Filter, KeyRound, Search } from 'lucide-react'
import { api, type AdminSubmission, type Course, type Assignment, LABEL_COLORS, STUDENT_LABELS, SUBMISSION_FLAGS } from '../api/client'

function LabelBadge({ code, display }: { code: string; display: string }) {
  if (!code) return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
  const color = LABEL_COLORS[code] ?? '#94a3b8'
  return (
    <span
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: '0.75rem',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {display || code}
    </span>
  )
}

function FlagChips({ flags }: { flags: string[] }) {
  if (!flags?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {flags.map((f) => {
        const fl = SUBMISSION_FLAGS.find((x) => x.code === f)
        return (
          <span key={f} className="flag-chip flag-chip-sm">{fl?.name ?? f}</span>
        )
      })}
    </div>
  )
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ course: '', assignment: '', label: '', search: '' })
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/courses/').then((r) => setCourses(r.data)).catch(() => {})
    api.get('/assignments/').then((r) => setAssignments(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (filters.course) params.course = filters.course
    if (filters.assignment) params.assignment = filters.assignment
    if (filters.label) params.label = filters.label
    api.get('/admin/submissions/', { params })
      .then((r) => setSubmissions(r.data))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false))
  }, [filters.course, filters.assignment, filters.label])

  const filteredAssignments = filters.course
    ? assignments.filter((a) => a.course === Number(filters.course) || a.course_id === Number(filters.course))
    : assignments

  const displayedSubs = filters.search
    ? submissions.filter((s) =>
        s.student_username.toLowerCase().includes(filters.search.toLowerCase()) ||
        s.student_full_name.toLowerCase().includes(filters.search.toLowerCase()) ||
        s.assignment_title.toLowerCase().includes(filters.search.toLowerCase())
      )
    : submissions

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Сдачи ({submissions.length})</h1>

      <div className="admin-filter-bar glass">
        <Filter size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <select
          className="admin-select"
          value={filters.course}
          onChange={(e) => setFilters((f) => ({ ...f, course: e.target.value, assignment: '' }))}
        >
          <option value="">Все курсы</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          className="admin-select"
          value={filters.assignment}
          onChange={(e) => setFilters((f) => ({ ...f, assignment: e.target.value }))}
        >
          <option value="">Все задания</option>
          {filteredAssignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
        <select
          className="admin-select"
          value={filters.label}
          onChange={(e) => setFilters((f) => ({ ...f, label: e.target.value }))}
        >
          <option value="">Все метки</option>
          {STUDENT_LABELS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
        <div className="admin-search-wrap">
          <Search size={15} className="admin-search-icon" />
          <input
            type="text"
            className="admin-search"
            placeholder="Поиск по студенту или заданию…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem' }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />
          ))}
        </div>
      ) : (
        <div className="glass admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Студент</th>
                <th>Метка</th>
                <th>Задание</th>
                <th>Курс</th>
                <th>Дата</th>
                <th>Флаги</th>
                <th>Ключ</th>
              </tr>
            </thead>
            <tbody>
              {displayedSubs.map((s, i) => (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className="admin-table-row"
                  onClick={() => navigate(`/admin/submissions/${s.id}`)}
                >
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.student_full_name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.student_username}</div>
                  </td>
                  <td>
                    <LabelBadge code={s.student_label} display={s.student_label_display} />
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.assignment_title}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.course_name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {new Date(s.submitted_at).toLocaleString('ru')}
                  </td>
                  <td><FlagChips flags={s.admin_flags} /></td>
                  <td>
                    {s.verification_signature && (
                      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <KeyRound size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                        {s.verification_signature.slice(0, 10)}…
                      </span>
                    )}
                  </td>
                </motion.tr>
              ))}
              {displayedSubs.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    Нет сдач по выбранным фильтрам
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
