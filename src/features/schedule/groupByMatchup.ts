import type { ScheduledMatch, TeamLite } from './types'

export interface MatchupGroup {
  matchupId: string
  teamA: TeamLite | null
  teamB: TeamLite | null
  matches: ScheduledMatch[] // ordenados por categoría (sort_order)
}

// Agrupa los partidos de una jornada por enfrentamiento. Dentro de cada grupo,
// ordena por categoría. Los grupos se ordenan alfabéticamente por equipo A.
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
    g.matches.sort((a, b) => (a.category?.sort_order ?? 99) - (b.category?.sort_order ?? 99))
  }
  result.sort((a, b) => (a.teamA?.name ?? '').localeCompare(b.teamA?.name ?? '', 'es'))
  return result
}
