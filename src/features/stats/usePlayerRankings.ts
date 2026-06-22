import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { rankPlayers } from './rankPlayers'
import type { PlayerRanking, RankedPlayer } from './rankPlayers'

const COLUMNS =
  'player_id, full_name, team_id, category_code, matches_played, matches_won, matches_lost, win_percentage, points_contributed, sets_won, sets_lost, set_diff, games_won, games_lost, game_diff'

// La vista player_rankings no expone season_id; se scopea por los equipos de la
// temporada. Solo jugadores con al menos un partido (spec §7.1).
async function fetchPlayerRankings(teamIds: string[]): Promise<RankedPlayer[]> {
  const { data, error } = await supabase
    .from('player_rankings')
    .select(COLUMNS)
    .in('team_id', teamIds)
    .gt('matches_played', 0)
  if (error) throw error

  // Postgres puede devolver bigint/numeric como string: forzamos número.
  const rows = (data ?? []).map((r) => {
    const o = r as Record<string, unknown>
    const num = (k: string) => Number(o[k] ?? 0)
    return {
      player_id: String(o.player_id),
      full_name: String(o.full_name),
      team_id: String(o.team_id),
      category_code: String(o.category_code),
      matches_played: num('matches_played'),
      matches_won: num('matches_won'),
      matches_lost: num('matches_lost'),
      win_percentage: num('win_percentage'),
      points_contributed: num('points_contributed'),
      sets_won: num('sets_won'),
      sets_lost: num('sets_lost'),
      set_diff: num('set_diff'),
      games_won: num('games_won'),
      games_lost: num('games_lost'),
      game_diff: num('game_diff'),
    } satisfies PlayerRanking
  })

  return rankPlayers(rows)
}

export function usePlayerRankings(teamIds: string[] | undefined) {
  return useQuery({
    queryKey: ['player-rankings', teamIds?.slice().sort()],
    queryFn: () => fetchPlayerRankings(teamIds as string[]),
    enabled: Boolean(teamIds && teamIds.length > 0),
  })
}
