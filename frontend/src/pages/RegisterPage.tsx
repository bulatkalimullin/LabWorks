import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, CheckCircle2 } from 'lucide-react'
import { useAuth, registerApi } from '../context/AuthContext'
import { api, parseApiError } from '../api/client'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'

type Group = { id: number; name: string; course: number }

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [groupId, setGroupId] = useState<number | ''>('')
  const [groups, setGroups] = useState<Group[]>([])
  const [show2faModal, setShow2faModal] = useState(false)
  const { setTokens, setUser } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    api.get('/public/groups/').then((r) => setGroups(r.data)).catch(() => setGroups([]))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = await registerApi({
        username,
        full_name: fullName,
        password,
        student_group_id: groupId === '' ? undefined : groupId,
      })
      setTokens(data.access, data.refresh)
      setUser(data.user)
      toast('Регистрация успешна', 'success')
      setShow2faModal(true)
    } catch (err) {
      toast(parseApiError(err), 'error')
    }
  }

  return (
    <>
      <motion.div className="container-narrow page-enter" style={{ paddingTop: '2rem' }}>
        <div className="glass" style={{ padding: '2rem' }}>
          <h1 style={{ marginTop: 0 }}>Регистрация</h1>
          <form onSubmit={handleSubmit}>
            <label>Имя пользователя</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <label style={{ marginTop: '0.75rem' }}>ФИО</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <label style={{ marginTop: '0.75rem' }}>Пароль</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <label style={{ marginTop: '0.75rem' }}>Группа</label>
            <select
              className="input"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Выберите группу</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '1.25rem', width: '100%' }}>
              Зарегистрироваться
            </button>
          </form>
          <p style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Link to="/login">Уже есть аккаунт</Link>
          </p>
        </div>
      </motion.div>

      <Modal open={show2faModal} onClose={() => { setShow2faModal(false); navigate('/') }} title="Защитите аккаунт">
        <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
          <Shield size={48} style={{ color: 'var(--primary)', marginBottom: 16 }} />
          <h3 style={{ margin: '0 0 0.75rem' }}>Подключите двухфакторную аутентификацию</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Для доступа к курсам необходима двухфакторная аутентификация (Google Authenticator).
            Настройте её сейчас в разделе «Аккаунт».
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { setShow2faModal(false); navigate('/account') }}
            >
              <CheckCircle2 size={18} /> Настроить сейчас
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setShow2faModal(false); navigate('/') }}
            >
              Позже
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
