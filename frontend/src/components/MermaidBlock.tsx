import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react'

const MIN_SCALE = 0.05
const MAX_SCALE = 6
const ZOOM_STEP = 0.15
const FIT_RETRIES = 12

let mermaidReady: Promise<typeof import('mermaid').default> | null = null

function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        flowchart: {
          useMaxWidth: false,
          htmlLabels: true,
          nodeSpacing: 50,
          rankSpacing: 60,
        },
        sequence: { useMaxWidth: false },
        er: { useMaxWidth: false },
      })
      return mod.default
    })
  }
  return mermaidReady
}

function measureSvg(svgEl: SVGSVGElement): { width: number; height: number } | null {
  svgEl.style.maxWidth = 'none'
  svgEl.style.width = ''
  svgEl.style.height = ''
  svgEl.style.display = 'block'

  try {
    const box = svgEl.getBBox()
    if (box.width > 1 && box.height > 1) {
      return { width: box.width, height: box.height }
    }
  } catch {
    /* not ready */
  }

  const viewBox = svgEl.viewBox?.baseVal
  if (viewBox && viewBox.width > 1 && viewBox.height > 1) {
    return { width: viewBox.width, height: viewBox.height }
  }

  const rect = svgEl.getBoundingClientRect()
  if (rect.width > 1 && rect.height > 1) {
    return { width: rect.width, height: rect.height }
  }

  return null
}

/** Обрезает viewBox до реального содержимого — у Mermaid часто большие пустые поля */
function trimSvgViewBox(svgEl: SVGSVGElement): void {
  try {
    const box = svgEl.getBBox()
    if (box.width <= 1 || box.height <= 1) return
    const pad = 12
    svgEl.setAttribute(
      'viewBox',
      `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`,
    )
    svgEl.removeAttribute('width')
    svgEl.removeAttribute('height')
    svgEl.style.width = '100%'
    svgEl.style.height = 'auto'
    svgEl.style.display = 'block'
  } catch {
    /* ignore */
  }
}

function MermaidPreview({
  svg,
  loading,
  error,
  chart,
  onOpen,
}: {
  svg: string | null
  loading: boolean
  error: boolean
  chart: string
  onOpen: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const content = contentRef.current
    if (!content || !svg) return

    content.innerHTML = svg
    const svgEl = content.querySelector('svg')
    if (!svgEl) return

    requestAnimationFrame(() => trimSvgViewBox(svgEl))
  }, [svg])

  return (
    <div className="mermaid-preview">
      <div className="mermaid-preview-bar">
        <span className="mermaid-preview-label">Диаграмма</span>
        <button
          type="button"
          className="btn btn-ghost mermaid-preview-open"
          onClick={onOpen}
          disabled={loading || error || !svg}
        >
          <Maximize2 size={14} /> Открыть схему
        </button>
      </div>

      <button
        type="button"
        className="mermaid-preview-frame"
        onClick={onOpen}
        disabled={loading || error || !svg}
        aria-label="Открыть схему"
      >
        {loading && <span className="mermaid-preview-status">Загрузка…</span>}
        {error && <pre className="mermaid-fallback">{chart}</pre>}
        {!loading && !error && svg && (
          <div ref={contentRef} className="mermaid-preview-content" />
        )}
      </button>

      <p className="mermaid-preview-hint">Нажмите для просмотра с зумом и перемещением</p>
    </div>
  )
}

function MermaidInteractiveViewer({
  chart,
  svg: initialSvg,
  onClose,
}: {
  chart: string
  svg: string | null
  onClose: () => void
}) {
  const reactId = useId()
  const contentRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(!initialSvg)
  const [renderError, setRenderError] = useState(false)
  const dragging = useRef(false)
  const dragOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  const fitToViewport = useCallback(() => {
    const svgEl = contentRef.current?.querySelector('svg')
    const viewport = viewportRef.current
    if (!svgEl || !viewport) return false

    const size = measureSvg(svgEl)
    if (!size) return false

    const vpWidth = viewport.clientWidth - 40
    const vpHeight = viewport.clientHeight - 40
    const fitScale = Math.min(vpWidth / size.width, vpHeight / size.height)
    setScale(Math.max(MIN_SCALE, fitScale))
    setPan({ x: 0, y: 0 })
    return true
  }, [])

  const mountSvg = useCallback((svg: string) => {
    if (!contentRef.current) return
    contentRef.current.innerHTML = svg

    let attempt = 0
    const tryFit = () => {
      if (fitToViewport()) {
        setLoading(false)
        return
      }
      attempt += 1
      if (attempt < FIT_RETRIES) {
        requestAnimationFrame(tryFit)
      } else {
        setScale(0.5)
        setPan({ x: 0, y: 0 })
        setLoading(false)
      }
    }
    requestAnimationFrame(tryFit)
  }, [fitToViewport])

  useEffect(() => {
    if (initialSvg) {
      mountSvg(initialSvg)
      return
    }

    let cancelled = false
    loadMermaid()
      .then(async (mermaid) => {
        if (cancelled) return
        const id = `mermaid-${reactId.replace(/:/g, '')}-${Date.now()}`
        const { svg } = await mermaid.render(id, chart)
        if (cancelled) return
        mountSvg(svg)
      })
      .catch(() => {
        if (!cancelled) {
          setRenderError(true)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [chart, initialSvg, mountSvg, reactId])

  const zoom = useCallback((delta: number) => {
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)))
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    zoom(e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)
  }, [zoom])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || loading) return
    dragging.current = true
    dragOrigin.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.style.cursor = 'grabbing'
  }, [loading, pan])

  const stopDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    e.currentTarget.style.cursor = 'grab'
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    setPan({
      x: dragOrigin.current.panX + (e.clientX - dragOrigin.current.x),
      y: dragOrigin.current.panY + (e.clientY - dragOrigin.current.y),
    })
  }, [])

  return (
    <div className="mermaid-modal">
      <div className="mermaid-modal-toolbar">
        <span className="mermaid-modal-title">Схема</span>
        <div className="mermaid-modal-controls">
          <button type="button" className="mermaid-viewer-btn" onClick={() => zoom(ZOOM_STEP)} title="Увеличить">
            <Plus size={16} />
          </button>
          <button type="button" className="mermaid-viewer-btn" onClick={() => zoom(-ZOOM_STEP)} title="Уменьшить">
            <Minus size={16} />
          </button>
          <button type="button" className="mermaid-viewer-btn" onClick={fitToViewport} title="Вписать в окно">
            <RotateCcw size={16} />
          </button>
          <button type="button" className="mermaid-viewer-btn" onClick={onClose} title="Закрыть">
            <X size={16} />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="mermaid-modal-viewport"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        {loading && !renderError && <p className="mermaid-preview-status">Загрузка…</p>}
        {renderError ? (
          <pre className="mermaid-fallback">{chart}</pre>
        ) : (
          <div
            className="mermaid-viewer-stage"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              opacity: loading ? 0 : 1,
            }}
          >
            <div ref={contentRef} className="mermaid-viewer-content" />
          </div>
        )}
      </div>

      <p className="mermaid-modal-hint">Колёсико — масштаб · перетаскивание — перемещение · Esc — закрыть</p>
    </div>
  )
}

export default function MermaidBlock({ chart }: { chart: string }) {
  const reactId = useId()
  const [svg, setSvg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setSvg(null)

    loadMermaid()
      .then(async (mermaid) => {
        if (cancelled) return
        const id = `mermaid-${reactId.replace(/:/g, '')}-${Date.now()}`
        const result = await mermaid.render(id, chart)
        if (!cancelled) {
          setSvg(result.svg)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [chart, reactId])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <MermaidPreview
        svg={svg}
        loading={loading}
        error={error}
        chart={chart}
        onOpen={() => setOpen(true)}
      />
      {open && (
        <div className="mermaid-viewer-overlay" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <MermaidInteractiveViewer chart={chart} svg={svg} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
