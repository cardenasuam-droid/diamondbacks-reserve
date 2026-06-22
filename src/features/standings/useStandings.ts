import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { resolveStandings } from './resolveStandings'
import type { StandingRow, H2HRow, RankedTeam } from './resolveStandings'

async function fetchStandings(seasonId: string): Promise<RankedTeam[]> {
  const [standings, h2h] = await Promise.all([
    supabase.from('team_standings').select('*').eq('season_id', seasonId),
    supabase.from('head_to_head').select('*').eq('season_id', seasonId),
  ])
  if (standings.error) throw standings.error
  if (h2h.error) throw h2h.error

  return resolveStandings(
    (standings.data ?? []) as StandingRow[],
    (h2h.data ?? []) as H2HRow[],
  )
}

/** Tabla de posiciones ya ordenada (con desempate H2H) para una temporada. */
export function useStandings(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['standings', seasonId],
    queryFn: () => fetchStandings(seasonId as string),
    enabled: Boolean(seasonId),
  })
}
