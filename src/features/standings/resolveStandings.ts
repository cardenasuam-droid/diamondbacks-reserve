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
 * Resuelve un grupo empatado por duelo directo, RECURSIVAMENTE.
 *
 * Con 3+ equipos empatados no basta una pasada: el H2H puede separar a uno y
 * dejar a los otros dos igualados *dentro del grupo grande*, aunque entre ellos
 * dos sí haya un ganador. La forma correcta es recalcular el duelo directo
 * solo entre los que siguen empatados — que es lo que dice el reglamento
 * ("pairwise SOLO entre los empatados", CLAUDE.md §4).
 *
 * Termina siempre: si un subgrupo tiene el mismo tamaño que su grupo padre, el
 * H2H no separó nada y se marca como empate real en vez de recursar.
 */
function resolveTieGroup(
  group: StandingRow[],
  lookup: H2HLookup,
): Array<{ row: StandingRow; unresolved: boolean }> {
  if (group.length === 1) return [{ row: group[0], unresolved: false }]

  const pts = new Map(group.map((t) => [t.team_id, h2hPointsWithin(t.team_id, group, lookup)]))
  const sorted = [...group].sort(
    (a, b) =>
      (pts.get(b.team_id) ?? 0) - (pts.get(a.team_id) ?? 0) ||
      a.team_name.localeCompare(b.team_name, 'es'),
  )

  const out: Array<{ row: StandingRow; unresolved: boolean }> = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length && pts.get(sorted[j].team_id) === pts.get(sorted[i].team_id)) j++
    const sub = sorted.slice(i, j)

    if (sub.length === 1) {
      out.push({ row: sub[0], unresolved: false })
    } else if (sub.length === group.length) {
      // El duelo directo no separó a nadie: empate real, lo decide el organizador.
      for (const row of sub) out.push({ row, unresolved: true })
    } else {
      out.push(...resolveTieGroup(sub, lookup))
    }
    i = j
  }
  return out
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

    for (const { row, unresolved } of resolveTieGroup(group, lookup)) {
      // Antes de que se juegue nada, los 6 equipos están empatados a 0 y la
      // tabla se llenaba de asteriscos de "empate sin resolver". No hay nada que
      // resolver mientras nadie ha jugado: es el estado inicial, no un conflicto.
      const tiedUnresolved = unresolved && row.played > 0
      out.push({ ...row, position: out.length + 1, tiedUnresolved })
    }
    i = j
  }
  return out
}
