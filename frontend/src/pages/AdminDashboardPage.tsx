import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, FileText, TrendingUp, Users } from 'lucide-react'
import { api, type AdminStats, LABEL_COLORS } from '../api/client'

function StatCard({ label, value, sub, icon: Icon }: {
  label: string; value: number; sub?: string; icon: React.ElementType
}) {
  return (
    <motion.div
      className="glass admin-stat-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="admin-stat-icon"><Icon size={20} /></div>
      <div className="admin-stat-body">
        <div className="admin-stat-label">{label}</div>
        <div className="admin-stat-value">{value.toLocaleString('ru')}</div>
        {sub && <div className="admin-stat-sub">{sub}</div>}
      </div>
    </motion.div>
  )
}

function BarChart({ data, maxVal }: { data: { date: string; count: number }[]; maxVal: number }) {
  const m = maxVal || 1
  return (
    <div className="admin-bar-chart">
      {data.map((d) => (
        <div key={d.date} className="admin-bar-wrap">
          <div className="admin-bar-count">{d.count || ''}</div>
          <div
            className="admin-bar"
            style={{ height: `${Math.max((d.count / m) * 100, d.count ? 3 : 0)}%` }}
            title={`${d.date}: ${d.count}`}
          />
          <div className="admin-bar-label">{d.date}</div>
        </div>
      ))}
    </div>
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)

  useEffect(() => {
    api.get('/admin/stats/').then((r) => setStats(r.data)).catch(() => {})
  }, [])

  if (!stats) {
    return (
      <div style={{ padding: '2rem' }}>
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 90 }} />
          ))}
        </div>
      </div>
    )
  }

  const maxDay = Math.max(...stats.submissions_by_day.map((d) => d.count), 1)
  const labelEntries = Object.entries(stats.label_distribution)
  const maxLabelCount = labelEntries.length > 0 ? Math.max(...labelEntries.map(([, v]) => v)) : 1

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Дашборд</h1>

      <div className="admin-stats-grid">
        <StatCard label="Студентов" value={stats.total_students} icon={Users} />
        <StatCard label="Курсов" value={stats.total_courses} icon={BookOpen} />
        <StatCard label="Заданий" value={stats.total_assignments} icon={FileText} />
        <StatCard
          label="Всего сдач"
          value={stats.total_submissions}
          sub={`${stats.recent_submissions} за 30 дней`}
          icon={TrendingUp}
        />
      </div>

      <div className="glass admin-chart-card">
        <h3 className="admin-chart-title">Сдачи по дням (14 дней)</h3>
        <BarChart data={stats.submissions_by_day} maxVal={maxDay} />
      </div>

      <div className="admin-two-col">
        <div className="glass admin-chart-card">
          <h3 className="admin-chart-title">Метки студентов</h3>
          {labelEntries.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Нет меток</p>
          )}
          {labelEntries.map(([name, count]) => {
            const code = stats.student_labels.find((l) => l.name === name)?.code ?? ''
            const color = LABEL_COLORS[code] ?? 'var(--primary)'
            return (
              <div key={name} className="admin-label-row">
                <span className="admin-label-name">{name}</span>
                <div
                  className="admin-label-bar"
                  style={{ width: `${(count / maxLabelCount) * 140}px`, background: color }}
                />
                <span className="admin-label-count">{count}</span>
              </div>
            )
          })}
        </div>

        <div className="glass admin-chart-card">
          <h3 className="admin-chart-title">Топ заданий по сдачам</h3>
          {stats.top_assignments.map((a, i) => (
            <div key={i} className="admin-label-row">
              <span className="admin-label-name" title={a.title}>{a.title}</span>
              <span className="admin-label-count">{a.sub_count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
