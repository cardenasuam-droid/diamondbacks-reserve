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
