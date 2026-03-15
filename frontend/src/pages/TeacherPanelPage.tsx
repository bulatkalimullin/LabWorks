import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, type Course } from '../api/client'
import TabPanel from '../components/TabPanel'
import Modal from '../components/Modal'
import { FileArchive, Plus } from 'lucide-react'

type Group = { id: number; name: string; course: number; course_name?: string }
type Assignment = {
  id: string
  title: string
  course: number
  course_name?: string
  open_time: string
  close_time: string
}

export default function TeacherPanelPage() {
  const { user, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const [courses, setCourses] = useState<Course[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [modal, setModal] = useState<'course' | 'group' | 'assignment' | null>(null)
  const base = import.meta.env.VITE_API_URL || '/api/v1'

  const [courseName, setCourseName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupCourseId, setGroupCourseId] = useState<number | ''>('')
  const [asgTitle, setAsgTitle] = useState('')
  const [asgDesc, setAsgDesc] = useState('')
  const [asgCourse, setAsgCourse] = useState<number | ''>('')
  const [asgExt, setAsgExt] = useState('pdf,docx')
  const [asgOpen, setAsgOpen] = useState('')
  const [asgClose, setAsgClose] = useState('')
  const [asgGroups, setAsgGroups] = useState<number[]>([])
  const [asgFile, setAsgFile] = useState<File | null>(null)

  function loadAll() {
    api.get('/courses/').then((r) => setCourses(r.data))
    api.get('/groups/').then((r) => setGroups(r.data)).catch(() => {})
    api.get('/assignments/').then((r) => setAssignments(r.data)).catch(() => {})
  }

  useEffect(() => {
    if (user?.is_staff) loadAll()
  }, [user])

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.is_staff) return <Navigate to="/" replace />

  async function createCourse(e: React.FormEvent) {
    e.preventDefault()
    await api.post('/courses/', { name: courseName })
    toast('Направление создано', 'success')
    setCourseName('')
    setModal(null)
    loadAll()
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault()
    if (groupCourseId === '') return
    await api.post('/groups/', { name: groupName, course: groupCourseId })
    toast('Группа создана', 'success')
    setGroupName('')
    setModal(null)
    loadAll()
  }

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (asgCourse === '' || !asgOpen || !asgClose) return
    const basePayload = {
      title: asgTitle,
      description: asgDesc,
      course: asgCourse,
      allowed_extensions: asgExt,
      open_time: new Date(asgOpen).toISOString(),
      close_time: new Date(asgClose).toISOString(),
      student_groups: asgGroups,
    }
    if (asgFile) {
      const form = new FormData()
      form.append('title', basePayload.title)
      form.append('description', basePayload.description)
      form.append('course', String(basePayload.course))
      form.append('allowed_extensions', basePayload.allowed_extensions)
      form.append('open_time', basePayload.open_time)
      form.append('close_time', basePayload.close_time)
      basePayload.student_groups.forEach((id) => {
        form.append('student_groups', String(id))
      })
      form.append('files', asgFile)
      await api.post('/assignments/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    } else {
      await api.post('/assignments/', basePayload)
    }
    toast('Задание создано', 'success')
    setAsgTitle('')
    setAsgDesc('')
    setAsgCourse('')
    setAsgExt('pdf,docx')
    setAsgOpen('')
    setAsgClose('')
    setAsgGroups([])
    setAsgFile(null)
    setModal(null)
    loadAll()
  }

  function exportCourse(id: number, name: string) {
    fetch(`${base}/export/course/${id}/`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access')}` },
    })
      .then((r) => r.blob())
      .then((b) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = `${name}_submissions.zip`
        a.click()
      })
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1000, margin: '0 auto' }} className="page-enter">
      <Link to="/" style={{ color: 'var(--text-muted)' }}>На главную</Link>
      <h1>Панель преподавателя</h1>

      <TabPanel
        tabs={[
          {
            id: 'courses',
            label: 'Направления',
            content: (
              <>
                <button type="button" className="btn btn-primary" onClick={() => setModal('course')} style={{ marginBottom: '1rem' }}>
                  <Plus size={18} /> Создать направление
                </button>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {courses.map((c) => (
                    <li key={c.id} className="glass" style={{ padding: '1rem', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{c.name}</span>
                      <button type="button" className="btn btn-ghost" onClick={() => exportCourse(c.id, c.name)}><FileArchive size={18} /> ZIP</button>
                    </li>
                  ))}
                </ul>
              </>
            ),
          },
          {
            id: 'groups',
            label: 'Группы',
            content: (
              <>
                <button type="button" className="btn btn-primary" onClick={() => setModal('group')} style={{ marginBottom: '1rem' }}>
                  <Plus size={18} /> Создать группу
                </button>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {groups.map((g) => (
                    <li key={g.id} className="glass" style={{ padding: '0.75rem 1rem', marginBottom: 6 }}>
                      {g.name} — {g.course_name || `курс #${g.course}`}
                    </li>
                  ))}
                </ul>
              </>
            ),
          },
          {
            id: 'assignments',
            label: 'Задания',
            content: (
              <>
                <button type="button" className="btn btn-primary" onClick={() => setModal('assignment')} style={{ marginBottom: '1rem' }}>
                  <Plus size={18} /> Создать задание
                </button>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Название</th><th>Курс</th><th></th></tr>
                    </thead>
                    <tbody>
                      {assignments.map((a) => (
                        <tr key={a.id}>
                          <td>{a.title}</td>
                          <td>{a.course_name || a.course}</td>
                          <td>
                            <Link to={`/assignment/${a.id}`} className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem' }}>Открыть</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ),
          },
        ]}
      />

      <Modal open={modal === 'course'} onClose={() => setModal(null)} title="Новое направление">
        <form onSubmit={createCourse}>
          <label>Название</label>
          <input className="input" value={courseName} onChange={(e) => setCourseName(e.target.value)} required />
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Создать</button>
        </form>
      </Modal>

      <Modal open={modal === 'group'} onClose={() => setModal(null)} title="Новая группа">
        <form onSubmit={createGroup}>
          <label>Название</label>
          <input className="input" value={groupName} onChange={(e) => setGroupName(e.target.value)} required />
          <label style={{ marginTop: '0.75rem' }}>Направление</label>
          <select className="input" value={groupCourseId} onChange={(e) => setGroupCourseId(e.target.value ? Number(e.target.value) : '')} required>
            <option value="">Выберите</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Создать</button>
        </form>
      </Modal>

      <Modal open={modal === 'assignment'} onClose={() => setModal(null)} title="Новое задание">
        <form onSubmit={createAssignment}>
          <label>Название</label>
          <input className="input" value={asgTitle} onChange={(e) => setAsgTitle(e.target.value)} required />
          <label style={{ marginTop: '0.75rem' }}>Описание</label>
          <textarea className="input" rows={3} value={asgDesc} onChange={(e) => setAsgDesc(e.target.value)} required />
          <label style={{ marginTop: '0.75rem' }}>Курс</label>
          <select className="input" value={asgCourse} onChange={(e) => setAsgCourse(e.target.value ? Number(e.target.value) : '')} required>
            <option value="">Выберите</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label style={{ marginTop: '0.75rem' }}>Расширения</label>
          <input className="input" value={asgExt} onChange={(e) => setAsgExt(e.target.value)} />
          <label style={{ marginTop: '0.75rem' }}>Файл задания (опционально)</label>
          <input
            className="input"
            type="file"
            onChange={(e) => setAsgFile(e.target.files?.[0] || null)}
          />
          <label style={{ marginTop: '0.75rem' }}>Открытие</label>
          <input className="input" type="datetime-local" value={asgOpen} onChange={(e) => setAsgOpen(e.target.value)} required />
          <label style={{ marginTop: '0.75rem' }}>Закрытие</label>
          <input className="input" type="datetime-local" value={asgClose} onChange={(e) => setAsgClose(e.target.value)} required />
          <label style={{ marginTop: '0.75rem' }}>Группы (Ctrl+клик)</label>
          <select
            className="input"
            multiple
            size={4}
            value={asgGroups.map(String)}
            onChange={(e) => setAsgGroups(Array.from(e.target.selectedOptions, (o) => Number(o.value)))}
          >
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Создать</button>
        </form>
      </Modal>
    </div>
  )
}
