import { useEffect, useRef, useState } from 'react'

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function useAnimatedProgress(target: number, durationMs = 1200): number {
  const [displayed, setDisplayed] = useState(target)
  const frameRef = useRef<number | null>(null)
  const startRef = useRef({ value: target, time: 0 })

  useEffect(() => {
    const clamped = Math.max(0, Math.min(100, target))
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
    }

    const from = displayed
    if (Math.abs(from - clamped) < 0.5) {
      setDisplayed(clamped)
      return
    }

    startRef.current = { value: from, time: performance.now() }

    const tick = (now: number) => {
      const elapsed = now - startRef.current.time
      const t = Math.min(1, elapsed / durationMs)
      const next = startRef.current.value + (clamped - startRef.current.value) * easeOutCubic(t)
      setDisplayed(next)
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        frameRef.current = null
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from last rendered value
  }, [target, durationMs])

  return displayed
}
