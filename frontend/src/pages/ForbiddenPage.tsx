import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'

export default function ForbiddenPage() {
  return (
    <div className="page-enter error-page-wrap">
      <motion.div
        className="glass"
        style={{ padding: '2rem', textAlign: 'center' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '999px',
              border: '1px solid var(--border)',
              background:
                'radial-gradient(circle at 30% 20%, rgba(59,130,246,0.5), rgba(15,23,42,0.9))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={40} style={{ color: '#fbbf24' }} />
          </div>
        </div>
        <h1 className="error-title">Доступ запрещён (403)</h1>
        <p className="error-subtitle">
          У вас нет прав для просмотра этой страницы. Если вы считаете, что это ошибка, обратитесь
          к преподавателю или администратору.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-primary">
            На главную
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

