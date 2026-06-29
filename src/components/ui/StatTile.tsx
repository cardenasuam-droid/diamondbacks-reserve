import type { CSSProperties } from 'react'

// Tile de estadística: etiqueta + valor grande en cifras tabulares. `accent` lo
// resalta en oro (cifra protagonista). `i` escalona su aparición (.rise-item).
// Lenguaje único de stats en toda la app (perfil del jugador y dashboard).
export function StatTile({
  label,
  value,
  accent,
  i = 0,
}: {
  label: string
  value: string | number
  accent?: boolean
  i?: number
}) {
  return (
    <div
      className="rise-item rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-100 to-slate-50 p-3 shadow-sm"
      style={{ ['--d']: i } as CSSProperties}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={'mt-1 text-2xl font-bold tabular-nums ' + (accent ? 'text-gold-400' : 'text-slate-900')}>
        {value}
      </p>
    </div>
  )
}
