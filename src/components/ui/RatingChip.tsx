// Rating ELO del jugador (migración 0039). Dato PÚBLICO por decisión del
// organizador: aparece en la ficha, el ranking y los listados.
//
// Sigue el precedente de PositionChip: si no hay dato, no pinta nada (en vez de
// mostrar un hueco o un cero). Eso importa porque la columna es nullable hasta
// que la migración corre en producción, y porque players_public devuelve null
// para los jugadores en lista de espera.
//
// TODOS LOS RATINGS SE MUESTRAN IGUAL, por decisión del organizador. Hubo una
// versión que marcaba como "provisional" a quien llevara pocos partidos: se
// quitó porque antes de la primera jornada eso era el 100% de los jugadores, y
// una marca que aplica a todo el mundo no informa de nada. Distinguir por el
// origen de la semilla (valoración individual frente al número de la categoría)
// se descartó también: expondría públicamente a quién se valoró uno por uno.
// El número se presenta sin adjetivos; los partidos jugados van en su propia
// columna del ranking para quien quiera ponderarlo.
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
  const valor = Math.round(rating)
  const title =
    jugados === 0
      ? `Rating ${valor}`
      : `Rating ${valor} — ${jugados} ${jugados === 1 ? 'partido jugado' : 'partidos jugados'}`

  return (
    <span
      title={title}
      className={
        'inline-flex shrink-0 items-center rounded-full bg-gold-500/15 font-semibold text-gold-300 ring-1 ring-inset ring-white/10 ' +
        (size === 'lg' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs')
      }
    >
      <span className="tabular-nums">{valor}</span>
    </span>
  )
}
