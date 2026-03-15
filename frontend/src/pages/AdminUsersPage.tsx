import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Tag } from 'lucide-react'
import { api, type AdminUser, STUDENT_LABELS, LABEL_COLORS, parseApiError } from '../api/client'
import { useToast } from '../context/ToastContext'

function LabelSelect({ userId, currentLabel, onSaved }: {
  userId: number; currentLabel: string; onSaved: (label: string) => void
}) {
  const [value, setValue] = useState(currentLabel)
  const { toast } = useToast()

  async function save(newLabel: string) {
    setValue(newLabel)
    try {
      await api.patch(`/admin/users/${userId}/label/`, { label: newLabel })
      onSaved(newLabel)
    } catch (err) {
      toast(parseApiError(err), 'error')
      setValue(currentLabel)
    }
  }

  const color = LABEL_COLORS[value] ?? '#94a3b8'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {value && (
        <span
          style={{
            background: `${color}22`,
            color,
            border: `1px solid ${color}55`,
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: '0.72rem',
            flexShrink: 0,
          }}
        >
          {STUDENT_LABELS.find((l) => l.code === value)?.name ?? value}
        </span>
      )}
      <select
        className="admin-select"
        style={{ fontSize: '0.78rem', padding: '4px 8px' }}
        value={value}
        onChange={(e) => save(e.target.value)}
      >
        <option value="">— метка —</option>
        {STUDENT_LABELS.map((l) => (
          <option key={l.code} value={l.code}>{l.name}</option>
        ))}
      </select>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = { is_staff: 'false' }
    if (labelFilter) params.label = labelFilter
    api.get('/admin/users/', { params })
      .then((r) => setUsers(r.data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [labelFilter])

  function updateLabel(userId: number, label: string) {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, label } : u))
  }

  const filtered = search
    ? users.filter((u) =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.full_name.toLowerCase().includes(search.toLowerCase())
      )
    : users

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Студенты ({users.length})</h1>

      <div className="admin-filter-bar glass">
        <Tag size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <select
          className="admin-select"
          value={labelFilter}
          onChange={(e) => setLabelFilter(e.target.value)}
        >
          <option value="">Все метки</option>
          {STUDENT_LABELS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
        <div className="admin-search-wrap">
          <Search size={15} className="admin-search-icon" />
          <input
            type="text"
            className="admin-search"
            placeholder="Поиск по имени или логину…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '1rem' }}>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />
          ))}
        </div>
      ) : (
        <div className="glass admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Студент</th>
                <th>Группы</th>
                <th>2FA</th>
                <th>Сдач</th>
                <th>Дата рег.</th>
                <th>Метка</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <motion.tr
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                >
                  <td>
                    <div style={{ fontWeight: 500 }}>{u.full_name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{u.username}</div>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {u.student_groups_names.join(', ') || '—'}
                  </td>
                  <td>
                    <span style={{ color: u.totp_enabled ? 'var(--success)' : 'var(--danger)', fontSize: '0.8rem' }}>
                      {u.totp_enabled ? '✓ Вкл' : '✗ Выкл'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{u.submissions_count}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(u.date_joined).toLocaleDateString('ru')}
                  </td>
                  <td>
                    <LabelSelect userId={u.id} currentLabel={u.label} onSaved={(l) => updateLabel(u.id, l)} />
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    Нет студентов по выбранным фильтрам
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
