// Reproducción completa de la temporada para el rating (migración 0039).
//
// POR QUÉ COMPLETA Y NO INCREMENTAL. Los resultados se guardan con upsert sobre
// match_id (useSaveResult), así que corregir un marcador SOBRESCRIBE la fila sin
// dejar rastro del valor anterior; y las alineaciones siguen siendo editables
// después de cargado el resultado. Un motor incremental no tendría de dónde leer
// el estado viejo para revertirlo. Reproducir los 330 partidos desde las semillas
// es instantáneo y siempre da el mismo resultado con las mismas entradas.
//
// Función PURA: recibe los datos ya leídos y devuelve los eventos a escribir. No
// toca Supabase. Así se puede probar la temporada entera con Vitest.

import {
  DEFAULT_RATING_SETTINGS,
  matchDelta,
  pairRating,
  tallyMatch,
  type MatchTally,
  type RatingSettings,
  type SetScore,
} from './computeRating'

/** Estados de match_results que cuentan como resultado oficial. */
// Mismo criterio que per_team_match (0003_views.sql:27) y que hasOfficialResult
// (features/schedule/score.ts). Si el rating usara un criterio distinto,
// divergiría visiblemente de la tabla de posiciones y nadie sabría cuál creer.
export const ESTADOS_OFICIALES = ['validated', 'walkover', 'corrected'] as const

export interface RatingMatch {
  match_id: string
  season_id: string
  round_id: string
  round_number: number
  scheduled_at: string | null
  category_code: string
  team_a_id: string
  team_b_id: string
  sets: SetScore[]
  result_status: string
  is_walkover: boolean
  /**
   * Equipo que NO se presentó. Imprescindible si `count_walkovers` está activo:
   * un walkover real se guarda con los seis sets en NULL (useSaveResult), así
   * que sin este dato no hay forma de saber quién ganó.
   */
  walkover_team_id: string | null
  /** Los dos jugadores alineados por el equipo A; null si falta la alineación. */
  pair_a: readonly [string, string] | null
  pair_b: readonly [string, string] | null
}

export interface RatingAdjustment {
  player_id: string
  /** Jornada a partir de la cual aplica. null = antes de la primera. */
  round_number: number | null
  delta: number
}

export type MotivoDescarte =
  | 'no_oficial'
  | 'walkover'
  | 'walkover_sin_equipo'
  | 'sin_alineacion'
  | 'marcador_indeciso'
  | 'jugador_sin_semilla'

export interface RatingEvent {
  season_id: string
  round_id: string
  match_id: string
  player_id: string
  partner_id: string
  team_id: string
  opponent_team_id: string
  category_code: string
  sequence: number
  rating_before: number
  rating_after: number
  delta: number
  pair_rating: number
  opponent_pair_rating: number
  expected: number
  mov: number
  won: boolean
  games_for: number
  games_against: number
}

export interface ReplayInput {
  /** rating inicial por jugador (players.rating_seed). */
  seeds: Map<string, number>
  matches: RatingMatch[]
  adjustments?: RatingAdjustment[]
  settings?: RatingSettings
}

export interface ReplayResult {
  events: RatingEvent[]
  /** Estado final por jugador. Incluye a los que no jugaron (rating = semilla). */
  finales: Map<string, { rating: number; matches: number }>
  /** Partidos que NO movieron el rating, con su motivo. Se reporta, no se calla. */
  descartes: Array<{ match_id: string; motivo: MotivoDescarte }>
}

/**
 * Orden cronológico: jornada, luego horario, luego id para desempatar.
 *
 * Nunca por match_results.created_at: los resultados se capturan en desorden
 * (el organizador los mete cuando le llegan), y el ELO depende del orden en que
 * ocurrieron los partidos, no del orden en que se teclearon.
 */
export function ordenCronologico(a: RatingMatch, b: RatingMatch): number {
  if (a.round_number !== b.round_number) return a.round_number - b.round_number
  const ta = a.scheduled_at ?? ''
  const tb = b.scheduled_at ?? ''
  // Los partidos sin horario van al final de su jornada.
  if (ta !== tb) {
    if (ta === '') return 1
    if (tb === '') return -1
    return ta < tb ? -1 : 1
  }
  return a.match_id < b.match_id ? -1 : a.match_id > b.match_id ? 1 : 0
}

export function replaySeason({ seeds, matches, adjustments = [], settings }: ReplayInput): ReplayResult {
  const s = settings ?? DEFAULT_RATING_SETTINGS

  const rating = new Map<string, number>(seeds)
  const jugados = new Map<string, number>()
  const events: RatingEvent[] = []
  const descartes: ReplayResult['descartes'] = []

  const orden = [...matches].sort(ordenCronologico)

  // Los ajustes manuales se aplican al PRINCIPIO de su jornada, antes de los
  // partidos de esa jornada. Un ajuste sin jornada (null) aplica antes de todo.
  const pendientes = [...adjustments].sort((x, y) => (x.round_number ?? -1) - (y.round_number ?? -1))
  let iAjuste = 0

  function aplicarAjustesHasta(jornada: number) {
    while (iAjuste < pendientes.length && (pendientes[iAjuste].round_number ?? -1) <= jornada) {
      const aj = pendientes[iAjuste]
      const actual = rating.get(aj.player_id)
      // Un ajuste sobre alguien que no está en las semillas se ignora en silencio
      // aquí: la validación de que el jugador existe es cosa de quien lo registra.
      if (actual != null) rating.set(aj.player_id, actual + aj.delta)
      iAjuste += 1
    }
  }

  let sequence = 0

  for (const m of orden) {
    aplicarAjustesHasta(m.round_number)

    if (!ESTADOS_OFICIALES.includes(m.result_status as (typeof ESTADOS_OFICIALES)[number])) {
      descartes.push({ match_id: m.match_id, motivo: 'no_oficial' })
      continue
    }

    // Walkover: la tabla de posiciones lo cuenta 6-0 6-0 porque es reglamento,
    // pero nadie jugó. Si entrara al rating daría el mayor movimiento posible por
    // no presentarse el rival, y premiaría alineaciones que pueden estar
    // autogeneradas (useFinalizeRound) y no pisaron la cancha.
    if (m.is_walkover && !s.count_walkovers) {
      descartes.push({ match_id: m.match_id, motivo: 'walkover' })
      continue
    }

    if (!m.pair_a || !m.pair_b) {
      descartes.push({ match_id: m.match_id, motivo: 'sin_alineacion' })
      continue
    }

    // Un walkover que SÍ cuenta (count_walkovers activo) no puede leerse de los
    // sets: se guardan en NULL. Se sintetiza el 6-0 6-0 del reglamento, igual
    // que hace per_team_match (0003_views.sql) para la tabla. Sin esto el flag
    // sería mentira: el partido caería en 'marcador_indeciso' y no contaría.
    let t: MatchTally
    if (m.is_walkover) {
      if (!m.walkover_team_id) {
        descartes.push({ match_id: m.match_id, motivo: 'walkover_sin_equipo' })
        continue
      }
      const ganaA = m.walkover_team_id !== m.team_a_id
      t = {
        setsA: ganaA ? 2 : 0,
        setsB: ganaA ? 0 : 2,
        juegosA: ganaA ? 12 : 0,
        juegosB: ganaA ? 0 : 12,
        ganador: ganaA ? 'a' : 'b',
      }
    } else {
      t = tallyMatch(m.sets)
      if (t.ganador === null) {
        descartes.push({ match_id: m.match_id, motivo: 'marcador_indeciso' })
        continue
      }
    }

    const cuatro = [...m.pair_a, ...m.pair_b]
    if (cuatro.some((id) => rating.get(id) == null)) {
      descartes.push({ match_id: m.match_id, motivo: 'jugador_sin_semilla' })
      continue
    }

    const rA = pairRating(rating.get(m.pair_a[0]) as number, rating.get(m.pair_a[1]) as number)
    const rB = pairRating(rating.get(m.pair_b[0]) as number, rating.get(m.pair_b[1]) as number)

    const ganóA = t.ganador === 'a'
    const juegosGanador = ganóA ? t.juegosA : t.juegosB
    const juegosPerdedor = ganóA ? t.juegosB : t.juegosA

    const { delta, expected, mov } = matchDelta({
      ratingGanadora: ganóA ? rA : rB,
      ratingPerdedora: ganóA ? rB : rA,
      juegosGanador,
      juegosPerdedor,
      settings: s,
    })

    // Un único delta entero: +delta a los dos ganadores, -delta a los dos
    // perdedores. Ahí vive la suma cero.
    const lados = [
      {
        pareja: m.pair_a,
        team_id: m.team_a_id,
        rival_team_id: m.team_b_id,
        propio: rA,
        rival: rB,
        won: ganóA,
        games_for: t.juegosA,
        games_against: t.juegosB,
      },
      {
        pareja: m.pair_b,
        team_id: m.team_b_id,
        rival_team_id: m.team_a_id,
        propio: rB,
        rival: rA,
        won: !ganóA,
        games_for: t.juegosB,
        games_against: t.juegosA,
      },
    ]

    for (const lado of lados) {
      const cambio = lado.won ? delta : -delta
      for (let i = 0; i < 2; i++) {
        const player_id = lado.pareja[i]
        const partner_id = lado.pareja[1 - i]
        const antes = rating.get(player_id) as number
        const despues = antes + cambio

        rating.set(player_id, despues)
        jugados.set(player_id, (jugados.get(player_id) ?? 0) + 1)

        sequence += 1
        events.push({
          season_id: m.season_id,
          round_id: m.round_id,
          match_id: m.match_id,
          player_id,
          partner_id,
          team_id: lado.team_id,
          opponent_team_id: lado.rival_team_id,
          category_code: m.category_code,
          sequence,
          rating_before: antes,
          rating_after: despues,
          delta: cambio,
          pair_rating: lado.propio,
          opponent_pair_rating: lado.rival,
          // `expected` se guarda SIEMPRE desde la perspectiva de este jugador,
          // no desde la del ganador: en la ficha se lee como "el modelo te daba
          // un 23% y ganaste".
          expected: lado.won ? expected : 1 - expected,
          mov,
          won: lado.won,
          games_for: lado.games_for,
          games_against: lado.games_against,
        })
      }
    }
  }

  // Los ajustes fechados después de la última jornada jugada también cuentan.
  aplicarAjustesHasta(Number.POSITIVE_INFINITY)

  const finales = new Map<string, { rating: number; matches: number }>()
  for (const [player_id, valor] of rating) {
    finales.set(player_id, { rating: valor, matches: jugados.get(player_id) ?? 0 })
  }

  return { events, finales, descartes }
}
