import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { KeyRound, Shield } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1)
  const [username, setUsername] = useState('')
  const [totpRequired, setTotpRequired] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const { toast } = useToast()

  async function requestStep(e: React.FormEvent) {
    e.preventDefault()
    try {
      const { data } = await api.post<{ totp_required: boolean; detail?: string }>(
        '/auth/password-reset/request/',
        { username }
      )
      setTotpRequired(!!data.totp_required)
      setStep(2)
      if (data.totp_required) {
        toast('Введите код из Google Authenticator и новый пароль', 'success')
      } else if (data.detail) {
        toast(data.detail, 'info')
      }
    } catch {
      toast('Пользователь не найден', 'error')
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post('/auth/password-reset/confirm/', {
        username,
        totp_code: totpCode,
        new_password: newPassword,
      })
      toast('Пароль обновлён', 'success')
      setStep(1)
      setUsername('')
      setTotpCode('')
      setNewPassword('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast(msg || 'Неверный код или ошибка', 'error')
    }
  }

  return (
    <motion.div className="container-narrow page-enter" style={{ paddingTop: '3rem' }}>
      <div className="glass" style={{ padding: '2rem' }}>
        <h1 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <KeyRound size={28} /> Сброс пароля
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Введите имя пользователя. Если у вас включён Google Authenticator — понадобится код из приложения и новый пароль.
        </p>
        {step === 1 && (
          <form onSubmit={requestStep}>
            <label>Имя пользователя</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
              Далее
            </button>
          </form>
        )}
        {step === 2 && totpRequired && (
          <form onSubmit={confirm}>
            <label>Код из Google Authenticator</label>
            <input
              className="input"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="000000"
              autoComplete="one-time-code"
              required
            />
            <label style={{ marginTop: '1rem' }}>Новый пароль</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
              Сменить пароль
            </button>
          </form>
        )}
        {step === 2 && !totpRequired && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Shield size={20} style={{ opacity: 0.8 }} />
              <strong>Обратитесь к администратору</strong>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Для сброса пароля без двухфакторной аутентификации администратор может сбросить пароль в панели управления.
            </p>
          </div>
        )}
        <p style={{ marginTop: '1.5rem' }}>
          <Link to="/login">Назад к входу</Link>
        </p>
      </div>
    </motion.div>
  )
}
