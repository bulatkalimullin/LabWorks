import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' }

const ToastContext = createContext<{
  toast: (message: string, type?: Toast['type']) => void
} | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast outside ToastProvider')
  return ctx
}
