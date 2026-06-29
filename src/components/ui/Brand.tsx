import { useState } from 'react'

// Marca de la liga: logo (escudo Diamondbacks Reserve) + wordmark. Cae a un
// monograma "DR" si el logo no carga. `size` escala el lockup: 'md' = chrome
// normal (headers/drawer), 'lg' = presencia destacada (p. ej. la inscripción).
const SIZES = {
  md: { gap: 'gap-2', box: 'h-9 w-9 rounded-lg', word: 'text-sm', mono: 'text-xs' },
  lg: { gap: 'gap-3', box: 'h-14 w-14 rounded-xl', word: 'text-lg leading-tight', mono: 'text-base' },
} as const

export function Brand({
  compact = false,
  size = 'md',
}: {
  compact?: boolean
  size?: keyof typeof SIZES
}) {
  const [logoOk, setLogoOk] = useState(true)
  const s = SIZES[size]

  return (
    <span className={`flex items-center ${s.gap}`}>
      {logoOk ? (
        <img
          src="/logo-mark.png"
          alt="Diamondbacks Reserve"
          onError={() => setLogoOk(false)}
          className={`${s.box} object-contain ring-1 ring-gold-500/30`}
        />
      ) : (
        <span
          className={`grid ${s.box} place-items-center bg-stone-900 font-heading ${s.mono} tracking-wider text-gold-400 ring-1 ring-gold-500/40`}
        >
          DR
        </span>
      )}
      {!compact && (
        <span className={`font-heading ${s.word} tracking-wide text-slate-900`}>
          Diamondbacks Reserve
        </span>
      )}
    </span>
  )
}
