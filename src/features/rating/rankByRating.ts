// Ranking global por rating ELO (migración 0039).
//
// Función PURA y con tests, como el resto de la lógica de cálculo (CLAUDE.md §1).
// Ordena a TODOS los jugadores de la temporada en una sola tabla, mezclando
// categorías: eso es legítimo porque la escalera de siembra es una escala
// absoluta entre géneros y categorías (FEM_5 y VAR_6 arrancan ambos en 1500), y
// porque el ELO es de suma cero, así que la media de cada bloque de categorías
// que comparten cancha queda congelada y no deriva con el tiempo.

export interface RatedPlayer {
  id: string
  full_name: string
  category_code: string
  team_id: string | null
  rating: number | null
  rating_matches: number
}

export interface RatingRow {
  id: string
  full_name: string
  category_code: string
  team_id: string | null
  rating: number
  rating_matches: number
  position: number
}

/**
 * Ordena por rating descendente y asigna posición.
 *
 * Los empates COMPARTEN posición (ranking de competición: 1, 2, 2, 4). No es un
 * detalle cosmético: en la jornada 1 los 30 jugadores de 5a varonil comparten
 * exactamente el mismo rating —su semilla de categoría— y numerarlos del 1 al 30
 * inventaría un orden que no existe. El desempate para ORDENAR (no para numerar)
 * es: más partidos jugados primero (su número está más asentado) y luego
 * alfabético en español.
 *
 * Quien no tiene rating queda fuera: la vista players_public devuelve null para
 * los jugadores en lista de espera, que por decisión del organizador no salen en
 * el ranking público.
 */
export function rankByRating(players: RatedPlayer[]): RatingRow[] {
  const conRating = players.filter(
    (p): p is RatedPlayer & { rating: number } => typeof p.rating === 'number' && Number.isFinite(p.rating),
  )

  const ordenados = [...conRating].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating
    const pa = a.rating_matches ?? 0
    const pb = b.rating_matches ?? 0
    if (pb !== pa) return pb - pa
    return a.full_name.localeCompare(b.full_name, 'es')
  })

  const filas: RatingRow[] = []
  let posicion = 0
  let ratingPrevio: number | null = null

  ordenados.forEach((p, i) => {
    // Solo el rating define el empate. Dos jugadores con el mismo rating comparten
    // posición aunque uno haya jugado más partidos que el otro.
    if (ratingPrevio === null || p.rating !== ratingPrevio) {
      posicion = i + 1
      ratingPrevio = p.rating
    }
    filas.push({
      id: p.id,
      full_name: p.full_name,
      category_code: p.category_code,
      team_id: p.team_id,
      rating: Math.round(p.rating),
      rating_matches: p.rating_matches ?? 0,
      position: posicion,
    })
  })

  return filas
}
