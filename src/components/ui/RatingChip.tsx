// Rating ELO del jugador (migración 0039). Dato PÚBLICO por decisión del
// organizador: aparece en la ficha, el ranking y los listados.
//
// Sigue el precedente de PositionChip: si no hay dato, no pinta nada (en vez de
// mostrar un hueco o un cero). Eso importa porque la columna es nullable hasta
// que la migración corre en producción.
//
// PROVISIONAL: mientras el jugador no acumule partidos, su número es la semilla
// —dictada por el organizador o la de su categoría— y no lo ha movido la cancha.
// En la jornada 1 eso vale para TODOS los varones, que arrancan con el valor
// idéntico de su categoría. Marcarlo evita que se lea como un empate real o como
// un error de la app. El umbral son 6 partidos: por debajo de eso el ruido de un
// ELO sobre dobles pesa más que la señal (ver 0039 y la calibración).
const PROVISIONAL_HASTA = 6

export function RatingChip({
  rating,
  matches,
  size = 'sm',
}: {
  rating: number | null | undefined
  matches?: number | null
  size?: 'sm' | 'lg'
}) {
  if (rating == null) return null

  const jugados = matches ?? 0
  const provisional = jugados < PROVISIONAL_HASTA
  const valor = Math.round(rating)

  const title = provisional
    ? jugados === 0
      ? `Rating ${valor} — inicial, aún sin partidos jugados`
      : `Rating ${valor} — provisional (${jugados} ${jugados === 1 ? 'partido' : 'partidos'} de ${PROVISIONAL_HASTA})`
    : `Rating ${valor} — ${jugados} partidos jugados`

  return (
    <span
      title={title}
      className={
        'inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ring-1 ring-inset ring-white/10 ' +
        (size === 'lg' ? 'px-2.5 py-1 text-sm ' : 'px-2 py-0.5 text-xs ') +
        (provisional ? 'bg-slate-200/70 text-slate-600' : 'bg-gold-500/15 text-gold-300')
      }
    >
      <span className="tabular-nums">{valor}</span>
      {provisional && <span aria-hidden className="text-[0.85em] opacity-70">·</span>}
    </span>
  )
}
