import type { MatchResultLite } from './types'

export interface SetScore {
  a: number
  b: number
}

// Sets jugados (set-por-set) desde la perspectiva team_a–team_b. Ignora sets nulos.
export function setScores(r: MatchResultLite): SetScore[] {
  const pairs: Array<[number | null, number | null]> = [
    [r.set1_team_a, r.set1_team_b],
    [r.set2_team_a, r.set2_team_b],
    [r.set3_team_a, r.set3_team_b],
  ]
  const out: SetScore[] = []
  for (const [a, b] of pairs) {
    if (a != null && b != null) out.push({ a, b })
  }
  return out
}

/** ¿Hay un resultado oficial que mostrar? (validado/walkover/corregido) */
export function hasOfficialResult(r: MatchResultLite | null | undefined): r is MatchResultLite {
  return Boolean(r && (r.is_walkover || ['validated', 'walkover', 'corrected'].includes(r.status)))
}

/** Texto compacto del marcador, p. ej. "6-4 4-6 6-3" o "W.O." */
export function scoreLine(r: MatchResultLite): string {
  if (r.is_walkover) return 'W.O.'
  const sets = setScores(r)
  if (sets.length === 0) return '—'
  return sets.map((s) => `${s.a}-${s.b}`).join('  ')
}

/**
 * Marcador visto DESDE un lado: con `asTeamA=false` voltea cada set para que el
 * primer número sea el del equipo propio. Para pantallas personales (historial
 * del jugador), donde "6-4" debe leerse "mi pareja 6, rival 4" sin importar si
 * su equipo quedó como A o B en el enfrentamiento.
 */
export function scoreLineFor(r: MatchResultLite, asTeamA: boolean): string {
  if (r.is_walkover) return 'W.O.'
  const sets = setScores(r)
  if (sets.length === 0) return '—'
  return sets.map((s) => (asTeamA ? `${s.a}-${s.b}` : `${s.b}-${s.a}`)).join('  ')
}
