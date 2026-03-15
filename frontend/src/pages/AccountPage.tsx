import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, parseApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'

export default function AccountPage() {
  const { user, isAuthenticated, setUser } = useAuth()
  const { toast } = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [setupSecret, setSetupSecret] = useState('')
  const [otpauthUrl, setOtpauthUrl] = useState('')
  const [enableCode, setEnableCode] = useState('')
  const [disablePassword, setDisablePassword] = useState('')
  const [activeTab, setActiveTab] = useState<'password' | 'security'>('security')
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)

  if (!isAuthenticated) return <Navigate to="/login" replace />

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post('/auth/password-change/', { current_password: currentPassword, new_password: newPassword })
      toast('Пароль изменён', 'success')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      toast(parseApiError(err), 'error')
    }
  }

  async function setup2fa() {
    try {
      const { data } = await api.post('/auth/2fa/setup/')
      setSetupSecret(data.secret)
      setOtpauthUrl(data.otpauth_url)
      toast('Секрет сгенерирован — добавьте в приложение', 'success')
      setWizardStep(2)
    } catch (err: unknown) {
      toast(parseApiError(err), 'error')
    }
  }

  async function enable2fa(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post('/auth/2fa/enable/', { code: enableCode })
      toast('2FA включена', 'success')
      setUser({ ...user!, totp_enabled: true })
      setEnableCode('')
      setSetupSecret('')
      setWizardStep(1)
    } catch (err) {
      toast(parseApiError(err), 'error')
    }
  }

  async function disable2fa(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post('/auth/2fa/disable/', { password: disablePassword })
      toast('2FA отключена', 'success')
      setUser({ ...user!, totp_enabled: false })
      setDisablePassword('')
      setWizardStep(1)
    } catch (err) {
      toast(parseApiError(err), 'error')
    }
  }

  const avatarLetter = user?.username?.[0]?.toUpperCase() || '?'
  const isStaff = !!user?.is_staff

  return (
    <motion.div className="page-enter" style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Аккаунт</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Управление паролем и двухфакторной аутентификацией.
      </p>

      <div className="account-layout">
        <div className="glass profile-card">
          <div className="avatar-circle">
            <span>{avatarLetter}</span>
          </div>
          <div>
            <div className="profile-username">{user?.username}</div>
            <div className="profile-fullname">{user?.full_name}</div>
          </div>
          <div className="profile-badges">
            <span className={`badge ${user?.totp_enabled ? 'badge-success' : 'badge-danger'}`}>
              {user?.totp_enabled ? '2FA включена' : '2FA не подключена'}
            </span>
            <span className="badge badge-ghost">
              {isStaff ? 'Администратор / Преподаватель' : 'Студент'}
            </span>
          </div>
        </div>

        <div className="glass" style={{ padding: '1.5rem' }}>
          <div className="account-tabs">
            <button
              type="button"
              className={`tab ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => setActiveTab('password')}
            >
              Пароль
            </button>
            <button
              type="button"
              className={`tab ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              Безопасность (2FA)
            </button>
          </div>

          {activeTab === 'password' && (
            <form onSubmit={changePassword}>
              <label>Текущий пароль</label>
              <input
                className="input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <label style={{ marginTop: '0.75rem' }}>Новый пароль</label>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Рекомендуем использовать длинный пароль c буквами, цифрами и символами.
              </p>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Сохранить пароль
              </button>
            </form>
          )}

          {activeTab === 'security' && (
            <>
              <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.1rem' }}>
                <Shield size={22} /> Google Authenticator
              </h2>

              {user?.totp_enabled ? (
                <form onSubmit={disable2fa} style={{ marginTop: '0.75rem' }}>
                  <p style={{ color: 'var(--text-muted)' }}>
                    Двухфакторная аутентификация уже включена. Для отключения введите пароль.
                  </p>
                  <label>Пароль</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="Пароль"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-danger" style={{ marginTop: '0.75rem' }}>
                    Отключить 2FA
                  </button>
                </form>
              ) : (
                <div className="security-steps">
                  {wizardStep === 1 && (
                    <div className="security-step">
                      <p style={{ color: 'var(--text-muted)' }}>
                        Подключите Google Authenticator, чтобы защитить аккаунт от взлома. После входа вам нужно
                        будет вводить одноразовый код из приложения.
                      </p>
                      <button type="button" className="btn btn-primary" onClick={setup2fa}>
                        Сгенерировать секрет и QR-код
                      </button>
                    </div>
                  )}

                  {wizardStep >= 2 && (
                    <div className="security-step">
                      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Шаг 2. Добавьте аккаунт в приложение</h3>
                      {otpauthUrl && (
                        <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(
                              otpauthUrl,
                            )}`}
                            alt="QR для Google Authenticator"
                            style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'white' }}
                          />
                        </div>
                      )}
                      <label>Секрет для резервного копирования</label>
                      <div className="copy-field">
                        <span>{setupSecret}</span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                        Храните секрет в надёжном месте. Он понадобится, если вы потеряете устройство.
                      </p>
                      {wizardStep === 2 && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ marginTop: '0.75rem' }}
                          onClick={() => setWizardStep(3)}
                        >
                          Далее
                        </button>
                      )}
                    </div>
                  )}

                  {wizardStep === 3 && (
                    <form onSubmit={enable2fa} className="security-step">
                      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Шаг 3. Подтвердите код</h3>
                      <label>Введите код из приложения</label>
                      <input
                        className="input"
                        value={enableCode}
                        onChange={(e) => setEnableCode(e.target.value)}
                        placeholder="000000"
                        required
                      />
                      <button type="submit" className="btn btn-primary" style={{ marginTop: '0.75rem' }}>
                        Включить 2FA
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
