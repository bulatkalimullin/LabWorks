import { useCallback, useRef, useState } from 'react'
import { File as FileIcon, Upload, X } from 'lucide-react'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FileDropzone({
  onFile,
  onError,
  allowedExtensions,
}: {
  onFile: (f: File | null) => void
  onError?: (message: string) => void
  allowedExtensions?: string[]
}) {
  const [drag, setDrag] = useState(false)
  const [selected, setSelected] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = allowedExtensions
    ? allowedExtensions.map((ext) => `.${ext.trim().toLowerCase()}`).join(',')
    : undefined

  const validate = useCallback(
    (f: File): boolean => {
      if (!allowedExtensions || allowedExtensions.length === 0) return true
      const nameParts = f.name.split('.')
      const ext = nameParts.length > 1 ? nameParts[nameParts.length - 1].toLowerCase() : ''
      const allowed = allowedExtensions.map((e) => e.trim().toLowerCase())
      if (!allowed.includes(ext)) {
        const list = allowed.map((e) => `.${e}`).join(', ')
        onError?.(`Недопустимый формат файла. Разрешены: ${list}`)
        return false
      }
      return true
    },
    [allowedExtensions, onError],
  )

  const handleFile = useCallback(
    (f: File | null) => {
      if (!f) {
        setSelected(null)
        onFile(null)
        return
      }
      if (!validate(f)) return
      setSelected(f)
      onFile(f)
    },
    [validate, onFile],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDrag(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile],
  )

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(null)
    onFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      className="dropzone-root"
      data-drag={drag}
      data-filled={!!selected}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => !selected && inputRef.current?.click()}
    >
      {selected ? (
        <div className="dropzone-file-info">
          <FileIcon size={32} className="dropzone-file-icon" />
          <div className="dropzone-file-meta">
            <span className="dropzone-filename">{selected.name}</span>
            <span className="dropzone-filesize">{formatBytes(selected.size)}</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost dropzone-clear"
            onClick={clear}
            aria-label="Удалить файл"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <>
          <Upload size={36} className="dropzone-upload-icon" />
          <p className="dropzone-hint">Перетащите файл или нажмите для выбора</p>
          {accept && (
            <p className="dropzone-accept-hint">
              Разрешены: {accept.replace(/\./g, ' ').trim()}
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
        </>
      )}
    </div>
  )
}
