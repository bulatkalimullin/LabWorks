import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="page-enter error-page-wrap">
      <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '999px',
              border: '1px solid var(--border)',
              background:
                'radial-gradient(circle at 30% 20%, rgba(96,165,250,0.6), rgba(15,23,42,0.9))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Search size={38} style={{ color: 'var(--text)' }} />
          </div>
        </div>
        <h1 className="error-title">Страница не найдена (404)</h1>
        <p className="error-subtitle">
          Мы не нашли то, что вы искали. Возможно, ссылка устарела или была введена с опечаткой.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-primary">
            На главную
          </Link>
        </div>
      </div>
    </div>
  )
}

