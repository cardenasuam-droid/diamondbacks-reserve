import { useEffect, useMemo, useRef, useState } from 'react'
import { TeamCrest } from '@/components/ui/TeamCrest'
import { Icon } from '@/components/ui/Icon'
import type { Team } from '@/lib/types'

export interface DrawEntry {
  position: number
  team_id: string
  team: Team | null
}

// Animación del SORTEO de orden de una categoría (0028). El resultado es
// autoritativo del servidor (drawnOrder); aquí solo se ANIMA hacia él para que
// todos "vean el sorteo en vivo", no solo el resultado. Barajea ~2.6s y se asienta.
// Se re-monta por categoría (key en el padre), así la animación corre cada vez.
export function DrawReveal({
  categoryName,
  order,
  canStart,
  starting,
  onStart,
}: {
  categoryName: string
  order: DrawEntry[]
  /** El organizador ve el botón para arrancar la categoría; el resto, un aviso. */
  canStart: boolean
  starting?: boolean
  onStart?: () => void
}) {
  const settledOrder = useMemo(() => [...order].sort((a, b) => a.position - b.position), [order])
  const [rolling, setRolling] = useState(true)
  const [shown, setShown] = useState<DrawEntry[]>(settledOrder)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (settledOrder.length === 0) return
    setRolling(true)
    // Barajeo visual rápido.
    tick.current = setInterval(() => {
      setShown((prev) => {
        const next = prev.length ? [...prev] : [...settledOrder]
        for (let i = next.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[next[i], next[j]] = [next[j], next[i]]
        }
        return next
      })
    }, 110)
    // Se asienta en el orden real.
    const stop = setTimeout(() => {
      if (tick.current) clearInterval(tick.current)
      tick.current = null
      setShown(settledOrder)
      setRolling(false)
    }, 2600)
    return () => {
      if (tick.current) clearInterval(tick.current)
      clearTimeout(stop)
    }
    // Depende del contenido del orden asentado (cambia por categoría).
  }, [settledOrder])

  return (
    <section className="rounded-3xl bg-slate-50 p-5 shadow-md">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-300">
          Sorteo de orden
        </p>
        <p className="mt-0.5 font-heading text-lg text-slate-900">{categoryName}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {rolling ? 'Sorteando el orden de elección…' : 'Orden definido'}
        </p>
      </div>

      <ol className="mt-4 space-y-1.5">
        {shown.map((e, i) => (
          <li
            key={e.team_id}
            className={
              'flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-150 ' +
              (rolling ? 'neu-raised opacity-90' : 'neu-inset')
            }
          >
            <span className={'w-6 text-center font-heading text-sm ' + (rolling ? 'text-slate-400' : 'text-gold-300')}>
              {rolling ? '·' : i + 1}
            </span>
            <TeamCrest name={e.team?.name ?? '—'} logoUrl={e.team?.logo_url} color={e.team?.color} size={24} />
            <span className="flex-1 truncate text-sm font-medium text-slate-800">{e.team?.name ?? '—'}</span>
            {!rolling && i === 0 && <Icon name="medal" size={16} className="text-gold-300" />}
          </li>
        ))}
      </ol>

      {!rolling &&
        (canStart ? (
          <button
            onClick={onStart}
            disabled={starting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-300 px-4 py-3.5 font-semibold text-[#1a1405] shadow-sm disabled:opacity-50"
          >
            <Icon name="standings" size={18} />
            {starting ? 'Empezando…' : 'Empezar categoría'}
          </button>
        ) : (
          <p className="mt-4 rounded-xl bg-brand-500/10 px-3 py-2 text-center text-xs text-brand-200">
            Esperando a que el organizador inicie la categoría…
          </p>
        ))}
    </section>
  )
}
