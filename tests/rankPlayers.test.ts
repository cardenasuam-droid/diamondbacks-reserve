import { rankPlayers } from '@/features/stats/rankPlayers'
import type { PlayerRanking } from '@/features/stats/rankPlayers'

function p(o: Partial<PlayerRanking> & { player_id: string; full_name: string }): PlayerRanking {
  return {
    team_id: 't',
    category_code: 'VAR_5',
    matches_played: 0,
    matches_won: 0,
    matches_lost: 0,
    win_percentage: 0,
    points_contributed: 0,
    sets_won: 0,
    sets_lost: 0,
    set_diff: 0,
    games_won: 0,
    games_lost: 0,
    game_diff: 0,
    ...o,
  }
}

// Criterios 4, 5 y 6 del reglamento (dif. sets, dif. juegos, menos derrotas).
// Nunca se habían ejercitado: los tests existentes se resuelven en los tres
// primeros criterios. Importan en las jornadas finales, que es justo cuando el
// orden del ranking deja de ser anecdótico.
describe('rankPlayers — criterios de desempate 4-6', () => {
  // Base empatada en puntos, % victorias y ganados: fuerza a llegar al criterio 4.
  const base = { points_contributed: 9, win_percentage: 75, matches_won: 3, matches_played: 4, matches_lost: 1 }

  it('4) a igual base, desempata por diferencia de sets', () => {
    const out = rankPlayers([
      p({ player_id: 'a', full_name: 'Ana', ...base, set_diff: 2 }),
      p({ player_id: 'b', full_name: 'Bea', ...base, set_diff: 5 }),
    ])
    expect(out.map((r) => r.player_id)).toEqual(['b', 'a'])
  })

  it('5) a igual dif. de sets, desempata por diferencia de juegos', () => {
    const out = rankPlayers([
      p({ player_id: 'a', full_name: 'Ana', ...base, set_diff: 3, game_diff: 4 }),
      p({ player_id: 'b', full_name: 'Bea', ...base, set_diff: 3, game_diff: 11 }),
    ])
    expect(out.map((r) => r.player_id)).toEqual(['b', 'a'])
  })

  it('6) a igual todo lo anterior, va primero quien tiene MENOS derrotas', () => {
    // Mismos puntos y % con distinto número de partidos: quien perdió menos sube.
    const out = rankPlayers([
      p({ player_id: 'a', full_name: 'Ana', points_contributed: 9, win_percentage: 50,
          matches_won: 3, matches_lost: 3, set_diff: 1, game_diff: 1 }),
      p({ player_id: 'b', full_name: 'Bea', points_contributed: 9, win_percentage: 50,
          matches_won: 3, matches_lost: 1, set_diff: 1, game_diff: 1 }),
    ])
    expect(out.map((r) => r.player_id)).toEqual(['b', 'a'])
  })

  it('7) empate absoluto: alfabético en español (la Ñ va entre N y O)', () => {
    const out = rankPlayers([
      p({ player_id: 'c', full_name: 'Oscar', ...base }),
      p({ player_id: 'a', full_name: 'Ñoño', ...base }),
      p({ player_id: 'b', full_name: 'Nadia', ...base }),
    ])
    expect(out.map((r) => r.full_name)).toEqual(['Nadia', 'Ñoño', 'Oscar'])
  })

  it('respeta el ORDEN de prioridad: una dif. de juegos enorme no gana a un set más', () => {
    // El criterio 4 (sets) manda sobre el 5 (juegos), pase lo que pase.
    const out = rankPlayers([
      p({ player_id: 'a', full_name: 'Ana', ...base, set_diff: 1, game_diff: 99 }),
      p({ player_id: 'b', full_name: 'Bea', ...base, set_diff: 2, game_diff: -99 }),
    ])
    expect(out.map((r) => r.player_id)).toEqual(['b', 'a'])
  })
})

describe('rankPlayers', () => {
  it('ordena por puntos aportados primero', () => {
    const out = rankPlayers([
      p({ player_id: 'a', full_name: 'A', points_contributed: 5 }),
      p({ player_id: 'b', full_name: 'B', points_contributed: 12 }),
      p({ player_id: 'c', full_name: 'C', points_contributed: 9 }),
    ])
    expect(out.map((r) => r.player_id)).toEqual(['b', 'c', 'a'])
    expect(out.map((r) => r.position)).toEqual([1, 2, 3])
  })

  it('a igualdad de puntos, usa % de victorias y luego desempates', () => {
    const out = rankPlayers([
      p({ player_id: 'a', full_name: 'A', points_contributed: 9, win_percentage: 50, matches_won: 3 }),
      p({ player_id: 'b', full_name: 'B', points_contributed: 9, win_percentage: 75, matches_won: 3 }),
      p({ player_id: 'c', full_name: 'C', points_contributed: 9, win_percentage: 75, matches_won: 5 }),
    ])
    // b y c empatan en puntos y %; c gana por más partidos ganados. a queda último.
    expect(out.map((r) => r.player_id)).toEqual(['c', 'b', 'a'])
  })

  it('último criterio: alfabético', () => {
    const out = rankPlayers([
      p({ player_id: 'z', full_name: 'Zoe', points_contributed: 3 }),
      p({ player_id: 'a', full_name: 'Ana', points_contributed: 3 }),
    ])
    expect(out.map((r) => r.full_name)).toEqual(['Ana', 'Zoe'])
  })
})
