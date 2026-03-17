import { X } from 'lucide-react'

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <>
      {open && (
        <div
          className="modal-overlay"
          onClick={onClose}
        >
          <div
            className="modal-content glass"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h2>
              <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  )
}
