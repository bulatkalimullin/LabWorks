import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import { api, parseApiError } from '../api/client'
import { useToast } from '../context/ToastContext'

type AdminSettings = { registration_open: boolean }

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    api.get<AdminSettings>('/admin/settings/')
      .then((r) => setSettings(r.data))
      .catch(() => setSettings({ registration_open: true }))
      .finally(() => setLoading(false))
  }, [])

  async function toggleRegistration(checked: boolean) {
    if (settings == null || saving) return
    setSaving(true)
    try {
      const { data } = await api.patch<AdminSettings>('/admin/settings/', { registration_open: checked })
      setSettings(data)
      toast(checked ? 'Регистрация открыта' : 'Регистрация закрыта', 'success')
    } catch (err) {
      toast(parseApiError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading || settings == null) {
    return (
      <div className="admin-page">
        <div className="skeleton" style={{ height: 32, width: 220, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
      </div>
    )
  }

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">
        <Settings size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />
        Настройки
      </h1>

      <div className="glass" style={{ padding: '1.5rem', maxWidth: 480 }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Логика сайта</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.registration_open}
            onChange={(e) => toggleRegistration(e.target.checked)}
            disabled={saving}
          />
          <span>Регистрация открыта</span>
        </label>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          При выключении регистрация через сайт недоступна; новых пользователей добавляет только администратор (Django admin или импорт). Новые пользователи требуют активации.
        </p>
      </div>
    </div>
  )
}
