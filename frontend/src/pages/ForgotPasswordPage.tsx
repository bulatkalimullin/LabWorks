import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { KeyRound } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1)
  const [username, setUsername] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const { toast } = useToast()

  async function requestToken(e: React.FormEvent) {
    e.preventDefault()
    try {
      const { data } = await api.post('/auth/password-reset/request/', { username })
      setResetToken(data.reset_token)
      setStep(2)
      toast('Токен получен — сохраните его', 'success')
    } catch {
      toast('Пользователь не найден', 'error')
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post('/auth/password-reset/confirm/', {
        username,
        reset_token: resetToken,
        new_password: newPassword,
      })
      toast('Пароль обновлён', 'success')
      setStep(1)
      setUsername('')
      setResetToken('')
      setNewPassword('')
    } catch {
      toast('Неверный токен или срок истёк', 'error')
    }
  }

  return (
    <motion.div className="container-narrow page-enter" style={{ paddingTop: '3rem' }}>
      <div className="glass" style={{ padding: '2rem' }}>
        <h1 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <KeyRound size={28} /> Сброс пароля по логину
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Без email: запросите токен по username, затем введите токен и новый пароль (токен действует 15 мин).
        </p>
        {step === 1 && (
          <form onSubmit={requestToken}>
            <label>Имя пользователя</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
              Получить токен
            </button>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={confirm}>
            <label>Токен (скопируйте сразу)</label>
            <input className="input" value={resetToken} onChange={(e) => setResetToken(e.target.value)} required />
            <label style={{ marginTop: '1rem' }}>Новый пароль</label>
            <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
              Сменить пароль
            </button>
          </form>
        )}
        <p style={{ marginTop: '1.5rem' }}>
          <Link to="/login">Назад к входу</Link>
        </p>
      </div>
    </motion.div>
  )
}
