import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Search, User, X } from 'lucide-react'
import type { AdminUser } from '../api/client'

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function matchStudent(student: AdminUser, query: string): boolean {
  const q = normalize(query)
  if (!q) return true
  const full = normalize(student.full_name || '')
  const user = normalize(student.username || '')
  return full.includes(q) || user.includes(q)
}

function displayName(student: AdminUser): string {
  return student.full_name?.trim() || student.username
}

export default function StudentAutocomplete({
  students,
  value,
  onChange,
  placeholder = 'Введите ФИО или логин…',
}: {
  students: AdminUser[]
  value: number | ''
  onChange: (userId: number | '') => void
  placeholder?: string
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const selected = useMemo(
    () => (value !== '' ? students.find((s) => s.id === value) : undefined),
    [students, value],
  )

  useEffect(() => {
    if (value === '') return
    const match = students.find((s) => s.id === value)
    if (match) setQuery(displayName(match))
  }, [value, students])

  const suggestions = useMemo(() => {
    if (!query.trim()) return students.slice(0, 12)
    return students.filter((s) => matchStudent(s, query)).slice(0, 12)
  }, [students, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, suggestions.length])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function pick(student: AdminUser) {
    onChange(student.id)
    setQuery(displayName(student))
    setOpen(false)
  }

  function clear() {
    onChange('')
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function onInputChange(text: string) {
    setQuery(text)
    onChange('')
    setOpen(true)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' && suggestions[activeIndex]) {
      e.preventDefault()
      pick(suggestions[activeIndex])
    }
  }

  return (
    <div className="student-autocomplete" ref={rootRef}>
      <div className="student-autocomplete__field">
        <Search size={16} className="student-autocomplete__icon" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          className="input student-autocomplete__input"
          value={query}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="student-autocomplete__clear"
            onClick={clear}
            aria-label="Очистить"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul id={listId} className="student-autocomplete__list" role="listbox">
          {suggestions.map((s, idx) => (
            <li key={s.id} role="option" aria-selected={idx === activeIndex}>
              <button
                type="button"
                className={`student-autocomplete__option${idx === activeIndex ? ' active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <User size={14} className="student-autocomplete__option-icon" />
                <span className="student-autocomplete__option-text">
                  <span className="student-autocomplete__name">{displayName(s)}</span>
                  {s.full_name && s.username !== s.full_name && (
                    <span className="student-autocomplete__login">@{s.username}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && query.trim() && suggestions.length === 0 && (
        <div className="student-autocomplete__empty">Никого не найдено</div>
      )}

      {value !== '' && selected && (
        <p className="student-autocomplete__selected">
          Выбран: <strong>{displayName(selected)}</strong>
        </p>
      )}
    </div>
  )
}
