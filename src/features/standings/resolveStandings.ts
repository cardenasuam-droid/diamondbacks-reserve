// Tabla de posiciones de equipos. La vista SQL `team_standings` ya ordena por
// (puntos, ganados, dif. sets, dif. juegos) pero NO puede resolver el criterio 5
// (enfrentamiento directo) ni el 6 (decisión del organizador). Eso se hace aquí.
//
// Criterios (CLAUDE.md §4 / spec §6.1):
//   1) puntos  2) partidos ganados  3) dif. sets  4) dif. juegos
//   5) enfrentamiento directo (pairwise SOLO entre los empatados)
//   6) decisión del organizador (manual, fuera de este cálculo)

export interface StandingRow {
  team_id: string
  season_id: string
  team_name: string
  color: string | null
  played: number
  won: number
  lost: number
  points: number
  sets_won: number
  sets_lost: number
  set_diff: number
  games_won: number
  games_lost: number
  game_diff: number
}

export interface H2HRow {
  team_id: string
  opponent_id: string
  points_vs_opponent: number
  matches_won_vs_opponent: number
}

export interface RankedTeam extends StandingRow {
  position: number
  /** true si quedó empatado con otro tras agotar todos los criterios automáticos. */
  tiedUnresolved: boolean
}

function sameBase(a: StandingRow, b: StandingRow): boolean {
  return (
    a.points === b.points &&
    a.won === b.won &&
    a.set_diff === b.set_diff &&
    a.game_diff === b.game_diff
  )
}

function baseCompare(a: StandingRow, b: StandingRow): number {
  return (
    b.points - a.points ||
    b.won - a.won ||
    b.set_diff - a.set_diff ||
    b.game_diff - a.game_diff
  )
}

type H2HLookup = Map<string, Map<string, number>>

function buildH2H(h2h: H2HRow[]): H2HLookup {
  const m: H2HLookup = new Map()
  for (const r of h2h) {
    if (!m.has(r.team_id)) m.set(r.team_id, new Map())
    m.get(r.team_id)!.set(r.opponent_id, r.points_vs_opponent)
  }
  return m
}

/** Puntos de `team` SOLO contra los rivales presentes en `group`. */
function h2hPointsWithin(teamId: string, group: StandingRow[], lookup: H2HLookup): number {
  const row = lookup.get(teamId)
  if (!row) return 0
  let sum = 0
  for (const other of group) {
    if (other.team_id === teamId) continue
    sum += row.get(other.team_id) ?? 0
  }
  return sum
}

/**
 * Ordena la tabla aplicando el desempate por enfrentamiento directo dentro de
 * cada grupo empatado en (puntos, ganados, dif. sets, dif. juegos). Si el H2H
 * tampoco rompe el empate, cae a orden alfabético y se marca `tiedUnresolved`.
 */
export function resolveStandings(rows: StandingRow[], h2h: H2HRow[]): RankedTeam[] {
  const lookup = buildH2H(h2h)
  const sorted = [...rows].sort(
    (a, b) => baseCompare(a, b) || a.team_name.localeCompare(b.team_name, 'es'),
  )

  const out: RankedTeam[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length && sameBase(sorted[i], sorted[j])) j++
    const group = sorted.slice(i, j)

    if (group.length > 1) {
      group.sort((a, b) => {
        const diff = h2hPointsWithin(b.team_id, group, lookup) - h2hPointsWithin(a.team_id, group, lookup)
        return diff || a.team_name.localeCompare(b.team_name, 'es')
      })
    }

    for (const row of group) {
      // Empate sin resolver: mismo base Y mismo H2H que algún otro del grupo.
      const tiedUnresolved =
        group.length > 1 &&
        group.some(
          (o) =>
            o.team_id !== row.team_id &&
            h2hPointsWithin(o.team_id, group, lookup) ===
              h2hPointsWithin(row.team_id, group, lookup),
        )
      out.push({ ...row, position: out.length + 1, tiedUnresolved })
    }
    i = j
  }
  return out
}
