import { resolveStandings } from '@/features/standings/resolveStandings'
import type { StandingRow, H2HRow } from '@/features/standings/resolveStandings'

// Helper para construir filas sin repetir todos los campos.
function row(p: Partial<StandingRow> & { team_id: string; team_name: string }): StandingRow {
  return {
    season_id: 's1',
    color: null,
    played: 0,
    won: 0,
    lost: 0,
    points: 0,
    sets_won: 0,
    sets_lost: 0,
    set_diff: 0,
    games_won: 0,
    games_lost: 0,
    game_diff: 0,
    ...p,
  }
}

describe('resolveStandings', () => {
  it('ordena por criterios base sin empates', () => {
    const rows = [
      row({ team_id: 'a', team_name: 'A', points: 6, won: 2, set_diff: 4, game_diff: 10 }),
      row({ team_id: 'b', team_name: 'B', points: 9, won: 3, set_diff: 6, game_diff: 12 }),
      row({ team_id: 'c', team_name: 'C', points: 3, won: 1, set_diff: 1, game_diff: 2 }),
    ]
    const out = resolveStandings(rows, [])
    expect(out.map((r) => r.team_id)).toEqual(['b', 'a', 'c'])
    expect(out.map((r) => r.position)).toEqual([1, 2, 3])
    expect(out.every((r) => !r.tiedUnresolved)).toBe(true)
  })

  it('rompe empate de 2 equipos por enfrentamiento directo', () => {
    // A y B empatados en base; en su duelo, B le ganó a A (3 vs 0).
    const rows = [
      row({ team_id: 'a', team_name: 'Alfa', points: 9, won: 3, set_diff: 5, game_diff: 8 }),
      row({ team_id: 'b', team_name: 'Bravo', points: 9, won: 3, set_diff: 5, game_diff: 8 }),
    ]
    const h2h: H2HRow[] = [
      { team_id: 'a', opponent_id: 'b', points_vs_opponent: 0, matches_won_vs_opponent: 0 },
      { team_id: 'b', opponent_id: 'a', points_vs_opponent: 3, matches_won_vs_opponent: 1 },
    ]
    const out = resolveStandings(rows, h2h)
    expect(out.map((r) => r.team_id)).toEqual(['b', 'a'])
    expect(out.every((r) => !r.tiedUnresolved)).toBe(true)
  })

  it('resuelve empate triple con mini-tabla de H2H', () => {
    // A, B, C empatados en base. Puntos H2H solo entre ellos:
    //   A: vs B=3, vs C=3 => 6   B: vs A=0, vs C=3 => 3   C: vs A=0, vs B=0 => 0
    const rows = [
      row({ team_id: 'a', team_name: 'A', points: 12, won: 4, set_diff: 6, game_diff: 9 }),
      row({ team_id: 'b', team_name: 'B', points: 12, won: 4, set_diff: 6, game_diff: 9 }),
      row({ team_id: 'c', team_name: 'C', points: 12, won: 4, set_diff: 6, game_diff: 9 }),
    ]
    const h2h: H2HRow[] = [
      { team_id: 'a', opponent_id: 'b', points_vs_opponent: 3, matches_won_vs_opponent: 1 },
      { team_id: 'a', opponent_id: 'c', points_vs_opponent: 3, matches_won_vs_opponent: 1 },
      { team_id: 'b', opponent_id: 'a', points_vs_opponent: 0, matches_won_vs_opponent: 0 },
      { team_id: 'b', opponent_id: 'c', points_vs_opponent: 3, matches_won_vs_opponent: 1 },
      { team_id: 'c', opponent_id: 'a', points_vs_opponent: 0, matches_won_vs_opponent: 0 },
      { team_id: 'c', opponent_id: 'b', points_vs_opponent: 0, matches_won_vs_opponent: 0 },
    ]
    const out = resolveStandings(rows, h2h)
    expect(out.map((r) => r.team_id)).toEqual(['a', 'b', 'c'])
  })

  it('marca empate no resuelto cuando el H2H tampoco distingue', () => {
    // Empate perfecto y sin datos de H2H => alfabético + tiedUnresolved.
    const rows = [
      row({ team_id: 'b', team_name: 'Bravo', points: 6, won: 2, set_diff: 2, game_diff: 4 }),
      row({ team_id: 'a', team_name: 'Alfa', points: 6, won: 2, set_diff: 2, game_diff: 4 }),
    ]
    const out = resolveStandings(rows, [])
    expect(out.map((r) => r.team_id)).toEqual(['a', 'b']) // alfabético
    expect(out.every((r) => r.tiedUnresolved)).toBe(true)
  })
})
