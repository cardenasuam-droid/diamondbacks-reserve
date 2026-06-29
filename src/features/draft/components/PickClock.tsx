import { useEffect, useState } from 'react'
import { remainingMs } from '../clock'
import type { DraftStatus } from '../types'

// Cuenta regresiva del pick. El `deadline` (server) es la verdad compartida; aquí
// solo re-renderizamos cada 250ms para mostrar el tiempo local restante. Cambia a
// rojo en los últimos 15s. Muestra "Pausado"/"Finalizado"/"Sin iniciar" según estado.
export function PickClock({
  deadline,
  status,
  pickSeconds,
}: {
  deadline: string | null
  status: DraftStatus
  pickSeconds: number
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (status !== 'active') return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [status])

  let value = '—'
  let label = 'Sin iniciar'
  let frac = 0
  let low = false
  if (status === 'paused') {
    value = '❚❚'
    label = 'Pausado'
  } else if (status === 'finished') {
    value = '✓'
    label = 'Finalizado'
  } else if (status === 'active') {
    const ms = remainingMs(deadline, now)
    const secs = Math.ceil(ms / 1000)
    value = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`
    label = 'Tiempo'
    frac = pickSeconds > 0 ? Math.max(0, Math.min(1, ms / (pickSeconds * 1000))) : 0
    low = secs <= 15
  }

  const barColor = low ? '#ef4444' : '#e9c14e' // rojo en los últimos 15s, oro normal
  const numColor = low ? '#fca5a5' : '#f1f6f0'

  return (
    <div className="neu-inset rounded-2xl px-5 py-4 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p
        className="mt-1 font-heading text-4xl tabular-nums"
        style={{ color: numColor }}
        aria-live="polite"
      >
        {value}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-linear"
          style={{ width: `${Math.round(frac * 100)}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}
