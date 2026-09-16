// Espejo TS PURO de las vistas per_player_ind_match + ind_standings (0051).
// Las vistas SQL son la fuente de verdad (§3.4); este espejo existe para que
// las reglas del formato americano sean una especificación ejecutable con
// tests (mismo criterio que replaySeason/resolveStandings en equipos):
//   · 3/1/0 con punto de consolación por perder en 3 sets
//   · walkover = 2-0 en sets y 12-0 en juegos para la tabla
//   · penalizaciones restan puntos
//   · solo la fase 'regular' puntúa
//   · desempates (hoja de la 5a): puntos → dif. partidos → dif. sets →
//     dif. juegos → nombre
// Si cambias una regla aquí, cámbiala en la vista 0051 (con migración nueva).

import type { SetInput } from '@/features/results/resultLogic'

export type IndPhase = 'regular' | 'playoffs'

export interface IndGame {
  phase: IndPhase
  /** playerId → lado (1|2). Cuatro jugadoras, dos por lado. */
  sides: Record<string, 1 | 2>
  winnerSide: 1 | 2
  isWalkover: boolean
  /** Lado que NO se presentó (solo walkover). */
  walkoverSide?: 1 | 2
  sets: [SetInput, SetInput, SetInput]
}

export interface IndPlayerMeta {
  id: string
  fullName: string
  categoryCode: string
}

export interface IndStandingRow {
  playerId: string
  fullName: string
  categoryCode: string
  played: number
  won: number
  lost: number
  matchDiff: number
  pointsRaw: number
  penaltyPoints: number
  points: number
  setsWon: number
  setsLost: number
  setDiff: number
  gamesWon: number
  gamesLost: number
  gameDiff: number
}

interface PerPlayerLine {
  won: boolean
  points: number
  setsWon: number
  setsLost: number
  gamesWon: number
  gamesLost: number
}

function setWon(s: number | null, o: number | null): number {
  if (s == null || o == null) return 0
  return s > o ? 1 : 0
}

// Una fila por jugadora en un juego oficial (espejo de per_player_ind_match).
export function playerLineForGame(game: IndGame, playerId: string): PerPlayerLine {
  const side = game.sides[playerId]
  if (!side) throw new Error('La jugadora no está en este juego.')

  if (game.isWalkover) {
    const present = side !== game.walkoverSide
    return {
      won: present,
      points: present ? 3 : 0,
      setsWon: present ? 2 : 0,
      setsLost: present ? 0 : 2,
      gamesWon: present ? 12 : 0,
      gamesLost: present ? 0 : 12,
    }
  }

  let setsWonN = 0
  let setsLostN = 0
  let gamesWonN = 0
  let gamesLostN = 0
  for (const s of game.sets) {
    const mine = side === 1 ? s.a : s.b
    const theirs = side === 1 ? s.b : s.a
    setsWonN += setWon(mine, theirs)
    setsLostN += setWon(theirs, mine)
    gamesWonN += mine ?? 0
    gamesLostN += theirs ?? 0
  }

  const won = side === game.winnerSide
  const points = won ? 3 : setsWonN >= 1 ? 1 : 0
  return { won, points, setsWon: setsWonN, setsLost: setsLostN, gamesWon: gamesWonN, gamesLost: gamesLostN }
}

export function computeIndStandings(
  players: IndPlayerMeta[],
  games: IndGame[],
  penalties: { playerId: string; points: number }[] = []
): IndStandingRow[] {
  const rows = new Map<string, IndStandingRow>()
  for (const p of players) {
    rows.set(p.id, {
      playerId: p.id,
      fullName: p.fullName,
      categoryCode: p.categoryCode,
      played: 0, won: 0, lost: 0, matchDiff: 0,
      pointsRaw: 0, penaltyPoints: 0, points: 0,
      setsWon: 0, setsLost: 0, setDiff: 0,
      gamesWon: 0, gamesLost: 0, gameDiff: 0,
    })
  }

  for (const g of games) {
    if (g.phase !== 'regular') continue // los playoffs no puntúan en la tabla
    for (const playerId of Object.keys(g.sides)) {
      const row = rows.get(playerId)
      if (!row) continue // jugadora fuera de la tabla (p. ej. dada de baja)
      const line = playerLineForGame(g, playerId)
      row.played += 1
      row.won += line.won ? 1 : 0
      row.lost += line.won ? 0 : 1
      row.pointsRaw += line.points
      row.setsWon += line.setsWon
      row.setsLost += line.setsLost
      row.gamesWon += line.gamesWon
      row.gamesLost += line.gamesLost
    }
  }

  for (const pen of penalties) {
    const row = rows.get(pen.playerId)
    if (row) row.penaltyPoints += pen.points
  }

  const out = [...rows.values()]
  for (const r of out) {
    r.matchDiff = r.won - r.lost
    r.points = r.pointsRaw - r.penaltyPoints
    r.setDiff = r.setsWon - r.setsLost
    r.gameDiff = r.gamesWon - r.gamesLost
  }

  out.sort(
    (a, b) =>
      b.points - a.points ||
      b.matchDiff - a.matchDiff ||
      b.setDiff - a.setDiff ||
      b.gameDiff - a.gameDiff ||
      a.fullName.localeCompare(b.fullName, 'es')
  )
  return out
}
