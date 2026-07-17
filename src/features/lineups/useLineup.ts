import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { StoredLineup } from './types'

// Alineación ya guardada de este equipo para este enfrentamiento (con sus
// entradas). null si el capitán aún no ha empezado.
async function fetchLineup(
  teamMatchupId: string,
  teamId: string,
): Promise<StoredLineup | null> {
  const { data, error } = await supabase
    .from('lineups')
    .select(
      'id, status, submitted_at, change_count_used, entries:lineup_entries(id, match_id, category_code, player_1_id, player_2_id, is_exception)',
    )
    .eq('team_matchup_id', teamMatchupId)
    .eq('team_id', teamId)
    .maybeSingle()
  if (error) throw error
  return (data as StoredLineup | null) ?? null
}

export function lineupQueryKey(teamMatchupId: string | undefined, teamId: string | undefined) {
  return ['lineup', teamMatchupId, teamId]
}

export function useLineup(teamMatchupId: string | undefined, teamId: string | undefined) {
  return useQuery({
    queryKey: lineupQueryKey(teamMatchupId, teamId),
    queryFn: () => fetchLineup(teamMatchupId as string, teamId as string),
    enabled: Boolean(teamMatchupId && teamId),
  })
}
