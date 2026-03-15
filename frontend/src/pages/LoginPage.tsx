import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth, loginApi } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { parseApiError } from '../api/client'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [needTotp, setNeedTotp] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const { setTokens, setUser } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const data = await loginApi(username, password, needTotp ? totpCode : undefined)
      setTokens(data.access, data.refresh)
      setUser(data.user)
      toast('Вход выполнен', 'success')
      navigate('/')
    } catch (err: unknown) {
      const d = (err as { response?: { data?: Record<string, string[]> } })?.response?.data
      if (d?.totp_code) {
        setNeedTotp(true)
        setError('Введите код из Google Authenticator')
      } else {
        setError(parseApiError(err) || 'Неверное имя пользователя или пароль.')
        setShake(true)
        setTimeout(() => setShake(false), 500)
      }
    }
  }

  return (
    <motion.div
      className="container-narrow page-enter"
      style={{ paddingTop: '3rem' }}
      animate={shake ? { x: [0, -6, 6, -6, 6, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      <div className="glass" style={{ padding: '2rem' }}>
        <h1 style={{ marginTop: 0 }}>Вход</h1>
        {error && <div className="form-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label>Имя пользователя</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>Пароль</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {needTotp && (
            <div style={{ marginBottom: '1rem' }}>
              <label>Код Google Authenticator</label>
              <input className="input" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="000000" autoComplete="one-time-code" />
            </div>
          )}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Войти</button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link to="/register">Регистрация</Link>
          {' · '}
          <Link to="/forgot-password">Сброс пароля</Link>
        </p>
      </div>
    </motion.div>
  )
}
