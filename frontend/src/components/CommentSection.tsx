import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Send } from 'lucide-react'

type Comment = {
  id: number
  author_username: string
  author_full_name: string
  text: string
  created_at: string
}

export default function CommentSection({ submissionId }: { submissionId: number }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)

  function load() {
    api.get(`/submissions/${submissionId}/comments/`)
      .then((r) => setComments(r.data))
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [submissionId])

  async function send() {
    if (!text.trim() || !user?.is_staff) return
    await api.post(`/submissions/${submissionId}/comments/`, { text: text.trim() })
    setText('')
    load()
  }

  if (!user?.is_staff) return null

  return (
    <div className="glass" style={{ padding: '1rem', marginTop: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>Комментарии</h3>
      {loading ? <p style={{ color: 'var(--text-muted)' }}>Загрузка...</p> : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
          {comments.map((c) => (
            <li key={c.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
              <strong>{c.author_full_name || c.author_username}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>
                {new Date(c.created_at).toLocaleString()}
              </span>
              <p style={{ margin: '0.25rem 0 0' }}>{c.text}</p>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          placeholder="Комментарий..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button type="button" className="btn btn-primary" onClick={send}><Send size={18} /></button>
      </div>
    </div>
  )
}
