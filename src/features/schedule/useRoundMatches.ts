import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ScheduledMatch } from './types'

// Partidos de una jornada con cancha, horario, categoría, enfrentamiento
// (ambos equipos) y resultado, todo en una sola consulta con embeds.
const SELECT = `
  id, scheduled_at, status, category_code,
  time_block:time_blocks(label, sort_order),
  court:courts(name, number),
  category:match_categories(name, type, sort_order, match_sort_order),
  matchup:team_matchups(
    id,
    team_a:teams!team_a_id(id, name, color, logo_url),
    team_b:teams!team_b_id(id, name, color, logo_url)
  ),
  result:match_results(status, set1_team_a, set1_team_b, set2_team_a, set2_team_b, set3_team_a, set3_team_b, winner_team_id, is_walkover)
`

async function fetchRoundMatches(roundId: string): Promise<ScheduledMatch[]> {
  const { data, error } = await supabase.from('matches').select(SELECT).eq('round_id', roundId)
  if (error) throw error
  return (data ?? []) as unknown as ScheduledMatch[]
}

export function useRoundMatches(roundId: string | undefined) {
  return useQuery({
    queryKey: ['round-matches', roundId],
    queryFn: () => fetchRoundMatches(roundId as string),
    enabled: Boolean(roundId),
  })
}
