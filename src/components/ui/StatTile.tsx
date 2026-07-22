import type { CSSProperties } from 'react'
import { useCountUp } from '@/hooks/useCountUp'

// Separa un valor de stat en prefijo + número + sufijo para animar solo la cifra
// (p. ej. "#1" → #/1/"", "75.5%" → ""/75.5/%, "+3" → +/3/""). Si no hay número,
// el valor se muestra tal cual.
//
// El decimal es parte del patrón a propósito: antes solo capturaba la parte
// entera, así que "75.5%" animaba de 0 a 75 y remataba escribiendo "75%" — el
// .5 desaparecía. El % de victorias de la vista player_rankings viene con un
// decimal (round(…, 1)), así que ocurría en cuanto alguien no tenía un
// porcentaje redondo.
export function parseStat(value: string | number): {
  prefix: string
  n: number | null
  suffix: string
  decimals: number
} {
  if (typeof value === 'number') {
    return { prefix: '', n: value, suffix: '', decimals: Number.isInteger(value) ? 0 : 1 }
  }
  const m = value.match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/)
  if (!m) return { prefix: '', n: null, suffix: value, decimals: 0 }
  const decimals = m[2].includes('.') ? m[2].split('.')[1].length : 0
  return { prefix: m[1], n: Number(m[2]), suffix: m[3], decimals }
}

// Tile de estadística: etiqueta + valor grande en cifras tabulares que CUENTAN
// desde 0 al montar (premium, respeta reduced-motion). `accent` lo resalta en oro
// con filo dorado (cifra protagonista). `i` escalona su aparición (.rise-item).
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
  const { prefix, n, suffix, decimals } = parseStat(value)
  const animated = useCountUp(n ?? 0)
  const display = n === null ? value : `${prefix}${animated.toFixed(decimals)}${suffix}`

  return (
    <div
      className={
        'rise-item rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-100 to-slate-50 p-3.5 shadow-sm ' +
        (accent ? 'gold-edge' : '')
      }
      style={{ ['--d']: i } as CSSProperties}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={
          'mt-1.5 text-[1.7rem] font-bold leading-none tabular-nums ' +
          (accent ? 'text-gold-300' : 'text-slate-900')
        }
      >
        {display}
      </p>
    </div>
  )
}
