import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, Plus, Trash2, Users, User } from 'lucide-react'
import {
  api,
  type Assignment,
  type DeadlineOverride,
  type AdminUser,
  parseApiError,
} from '../api/client'
import { useToast } from '../context/ToastContext'
import StudentAutocomplete from './StudentAutocomplete'

type Group = { id: number; name: string; course: number }
type Mode = 'extend' | 'absolute'
type TimeUnit = 'minutes' | 'hours'

function toTotalMinutes(amount: number, unit: TimeUnit): number {
  const n = Math.max(0, Math.floor(amount))
  return unit === 'hours' ? n * 60 : n
}

function formatDuration(amount: number, unit: TimeUnit): string {
  if (unit === 'hours') {
    const h = amount
    if (h === 1) return '1 час'
    if (h >= 2 && h <= 4) return `${h} часа`
    return `${h} часов`
  }
  const m = amount
  if (m === 1) return '1 минута'
  if (m >= 2 && m <= 4) return `${m} минуты`
  return `${m} минут`
}

export default function AssignmentDeadlinePanel({
  assignment,
}: {
  assignment: Assignment
}) {
  const { toast } = useToast()
  const [groups, setGroups] = useState<Group[]>([])
  const [students, setStudents] = useState<AdminUser[]>([])
  const [overrides, setOverrides] = useState<DeadlineOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [targetType, setTargetType] = useState<'group' | 'user'>('group')
  const [targetGroupId, setTargetGroupId] = useState<number | ''>('')
  const [targetUserId, setTargetUserId] = useState<number | ''>('')
  const [mode, setMode] = useState<Mode>('extend')
  const [addAmount, setAddAmount] = useState(30)
  const [addUnit, setAddUnit] = useState<TimeUnit>('minutes')
  const [closeTime, setCloseTime] = useState('')
  const [saving, setSaving] = useState(false)

  const assignmentGroupIds = useMemo(
    () => new Set(assignment.student_groups ?? []),
    [assignment.student_groups],
  )

  const assignmentGroups = useMemo(
    () => groups.filter((g) => assignmentGroupIds.has(g.id)),
    [groups, assignmentGroupIds],
  )

  const totalAddMinutes = toTotalMinutes(addAmount, addUnit)

  const loadOverrides = useCallback(() => {
    setLoading(true)
    api.get(`/assignments/${assignment.id}/deadline-overrides/`)
      .then((r) => setOverrides(r.data))
      .catch(() => setOverrides([]))
      .finally(() => setLoading(false))
  }, [assignment.id])

  useEffect(() => {
    api.get('/groups/').then((r) => setGroups(r.data)).catch(() => setGroups([]))
    api.get('/admin/users/', { params: { is_staff: 'false' } })
      .then((r) => setStudents(r.data))
      .catch(() => setStudents([]))
    loadOverrides()
  }, [loadOverrides])

  const eligibleStudents = useMemo(() => {
    if (assignmentGroupIds.size === 0) return students
    return students.filter((s) =>
      (s.student_groups ?? []).some((gid) => assignmentGroupIds.has(gid)),
    )
  }, [students, assignmentGroupIds])

  function applyPreset(amount: number, unit: TimeUnit) {
    setMode('extend')
    setAddAmount(amount)
    setAddUnit(unit)
  }

  async function saveOverride(e: React.FormEvent) {
    e.preventDefault()
    const payload: Record<string, unknown> = { assignment: assignment.id }

    if (targetType === 'group') {
      if (!targetGroupId) {
        toast('Выберите группу', 'error')
        return
      }
      payload.student_group = targetGroupId
      payload.user = null
    } else {
      if (!targetUserId) {
        toast('Введите ФИО и выберите студента из подсказок', 'error')
        return
      }
      payload.user = targetUserId
      payload.student_group = null
    }

    if (mode === 'extend') {
      if (totalAddMinutes < 1) {
        toast('Укажите время больше нуля', 'error')
        return
      }
      payload.add_minutes = totalAddMinutes
    } else {
      if (!closeTime) {
        toast('Укажите время закрытия', 'error')
        return
      }
      payload.close_time = new Date(closeTime).toISOString()
    }

    setSaving(true)
    try {
      await api.post(`/assignments/${assignment.id}/deadline-overrides/`, payload)
      toast(mode === 'extend' ? `Добавлено: ${formatDuration(addAmount, addUnit)}` : 'Дедлайн установлен', 'success')
      setCloseTime('')
      loadOverrides()
    } catch (err) {
      toast(parseApiError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function removeOverride(id: number) {
    try {
      await api.delete(`/deadline-overrides/${id}/`)
      toast('Переопределение сброшено', 'success')
      setOverrides((prev) => prev.filter((o) => o.id !== id))
    } catch (err) {
      toast(parseApiError(err), 'error')
    }
  }

  return (
    <div className="deadline-panel glass">
      <div className="deadline-panel__header">
        <Clock size={18} />
        <div>
          <h3 className="deadline-panel__title">Таймеры сдачи</h3>
          <p className="deadline-panel__meta">
            Базовый дедлайн: {new Date(assignment.close_time).toLocaleString('ru')}
          </p>
        </div>
      </div>

      <form className="deadline-panel__form" onSubmit={saveOverride}>
        <div className="deadline-panel__section">
          <span className="deadline-panel__label">Кому</span>
          <div className="deadline-segment">
            <button
              type="button"
              className={`deadline-segment__btn${targetType === 'group' ? ' active' : ''}`}
              onClick={() => setTargetType('group')}
            >
              <Users size={14} /> Группа
            </button>
            <button
              type="button"
              className={`deadline-segment__btn${targetType === 'user' ? ' active' : ''}`}
              onClick={() => setTargetType('user')}
            >
              <User size={14} /> Студент
            </button>
          </div>
          {targetType === 'group' ? (
            <select
              className="input deadline-panel__select"
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Выберите группу</option>
              {assignmentGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          ) : (
            <StudentAutocomplete
              students={eligibleStudents}
              value={targetUserId}
              onChange={setTargetUserId}
            />
          )}
        </div>

        <div className="deadline-panel__section">
          <span className="deadline-panel__label">Способ</span>
          <div className="deadline-segment">
            <button
              type="button"
              className={`deadline-segment__btn${mode === 'extend' ? ' active' : ''}`}
              onClick={() => setMode('extend')}
            >
              Добавить время
            </button>
            <button
              type="button"
              className={`deadline-segment__btn${mode === 'absolute' ? ' active' : ''}`}
              onClick={() => setMode('absolute')}
            >
              Точный конец
            </button>
          </div>

          {mode === 'extend' ? (
            <>
              <div className="deadline-duration">
                <input
                  type="number"
                  className="input deadline-duration__amount"
                  min={1}
                  max={addUnit === 'hours' ? 72 : 9999}
                  value={addAmount || ''}
                  onChange={(e) => setAddAmount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="30"
                  aria-label="Количество"
                />
                <div className="deadline-segment deadline-segment--compact">
                  <button
                    type="button"
                    className={`deadline-segment__btn${addUnit === 'minutes' ? ' active' : ''}`}
                    onClick={() => setAddUnit('minutes')}
                  >
                    мин
                  </button>
                  <button
                    type="button"
                    className={`deadline-segment__btn${addUnit === 'hours' ? ' active' : ''}`}
                    onClick={() => setAddUnit('hours')}
                  >
                    ч
                  </button>
                </div>
              </div>
              <p className="deadline-panel__hint">
                {totalAddMinutes > 0
                  ? `Будет добавлено: ${formatDuration(addAmount, addUnit)}`
                  : 'Укажите, сколько времени добавить'}
              </p>
              <div className="deadline-presets">
                <span className="deadline-presets__label">Быстро:</span>
                <button type="button" className="deadline-preset" onClick={() => applyPreset(5, 'minutes')}>5 мин</button>
                <button type="button" className="deadline-preset" onClick={() => applyPreset(15, 'minutes')}>15 мин</button>
                <button type="button" className="deadline-preset" onClick={() => applyPreset(30, 'minutes')}>30 мин</button>
                <button type="button" className="deadline-preset" onClick={() => applyPreset(1, 'hours')}>1 ч</button>
                <button type="button" className="deadline-preset" onClick={() => applyPreset(2, 'hours')}>2 ч</button>
                <button type="button" className="deadline-preset" onClick={() => applyPreset(5, 'hours')}>5 ч</button>
              </div>
            </>
          ) : (
            <input
              type="datetime-local"
              className="input deadline-panel__datetime"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
            />
          )}
        </div>

        <button type="submit" className="btn btn-primary deadline-panel__submit" disabled={saving}>
          <Plus size={16} />
          {saving ? 'Сохранение…' : mode === 'extend' ? 'Добавить время' : 'Установить дедлайн'}
        </button>
      </form>

      <div className="deadline-panel__overrides">
        <h4 className="deadline-panel__subtitle">Активные переопределения</h4>
        {loading ? (
          <p className="deadline-panel__empty">Загрузка…</p>
        ) : overrides.length === 0 ? (
          <p className="deadline-panel__empty">Пока нет — используется базовый дедлайн.</p>
        ) : (
          <ul className="deadline-override-list">
            {overrides.map((o) => (
              <li key={o.id} className="deadline-override-item">
                <div className="deadline-override-item__info">
                  <span className="deadline-override-item__target">
                    {o.user_username ? (
                      <><User size={13} /> {o.user_username}</>
                    ) : (
                      <><Users size={13} /> {o.group_name}</>
                    )}
                  </span>
                  <span className="deadline-override-item__time">
                    {new Date(o.close_time).toLocaleString('ru')}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost deadline-override-item__remove"
                  onClick={() => removeOverride(o.id)}
                  title="Сбросить"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
