import { useEffect, useRef, useState } from 'react'

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Cuenta animada de 0 → `target` con ease-out (sensación premium en cifras
// deportivas). Respeta prefers-reduced-motion (salta al valor final, sin animar).
// Solo para enteros; el llamador decide el formato (p. ej. añadir "%").
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(() => (prefersReduced() ? target : 0))
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (prefersReduced() || durationMs <= 0) {
      setValue(target)
      return
    }
    const start = performance.now()
    const from = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cúbico
      setValue(from + (target - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setValue(target)
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, durationMs])

  return value
}
