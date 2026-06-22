// Ranking individual. Orden (spec §7.1):
//   1) puntos aportados  2) % victorias  3) partidos ganados  4) dif. sets
//   5) dif. juegos  6) menos derrotas  7) alfabético

export interface PlayerRanking {
  player_id: string
  full_name: string
  team_id: string
  category_code: string
  matches_played: number
  matches_won: number
  matches_lost: number
  win_percentage: number
  points_contributed: number
  sets_won: number
  sets_lost: number
  set_diff: number
  games_won: number
  games_lost: number
  game_diff: number
}

export interface RankedPlayer extends PlayerRanking {
  position: number
}

export function rankPlayers(rows: PlayerRanking[]): RankedPlayer[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.points_contributed - a.points_contributed ||
        b.win_percentage - a.win_percentage ||
        b.matches_won - a.matches_won ||
        b.set_diff - a.set_diff ||
        b.game_diff - a.game_diff ||
        a.matches_lost - b.matches_lost ||
        a.full_name.localeCompare(b.full_name, 'es'),
    )
    .map((r, i) => ({ ...r, position: i + 1 }))
}
