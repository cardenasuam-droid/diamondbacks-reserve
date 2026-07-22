import type { ScheduledMatch, TeamLite } from './types'

export interface MatchupGroup {
  matchupId: string
  teamA: TeamLite | null
  teamB: TeamLite | null
  matches: ScheduledMatch[] // ordenados por HORA, luego categoría
}

/** Orden del turno: sort_order del bloque horario y, si falta, el scheduled_at. */
function horaDe(m: ScheduledMatch): number {
  if (m.time_block?.sort_order != null) return m.time_block.sort_order
  if (m.scheduled_at) return new Date(m.scheduled_at).getTime()
  return Number.POSITIVE_INFINITY // sin horario, al final
}

// Agrupa los partidos de una jornada por enfrentamiento. Los grupos se ordenan
// alfabéticamente por equipo A.
//
// Dentro de cada grupo manda la HORA y no la categoría: un enfrentamiento son 11
// partidos repartidos en tres turnos, y el día de juego lo que se busca es "qué
// se juega ahora". Ordenando por categoría, el primer turno (10:15) aparecía al
// final de la lista. La categoría sigue siendo el desempate dentro del turno,
// así que el orden oficial se conserva donde importa.
export function groupByMatchup(matches: ScheduledMatch[]): MatchupGroup[] {
  const groups = new Map<string, MatchupGroup>()

  for (const m of matches) {
    const id = m.matchup?.id
    if (!id) continue
    let g = groups.get(id)
    if (!g) {
      g = { matchupId: id, teamA: m.matchup?.team_a ?? null, teamB: m.matchup?.team_b ?? null, matches: [] }
      groups.set(id, g)
    }
    g.matches.push(m)
  }

  const result = [...groups.values()]
  for (const g of result) {
    // 1) turno horario · 2) categoría de PARTIDO (0029: match_sort_order, cae a
    //    sort_order) como desempate dentro del mismo turno.
    g.matches.sort(
      (a, b) =>
        horaDe(a) - horaDe(b) ||
        (a.category?.match_sort_order ?? a.category?.sort_order ?? 99) -
          (b.category?.match_sort_order ?? b.category?.sort_order ?? 99),
    )
  }
  result.sort((a, b) => (a.teamA?.name ?? '').localeCompare(b.teamA?.name ?? '', 'es'))
  return result
}
