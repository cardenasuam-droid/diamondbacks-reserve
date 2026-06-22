import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Cambios de alineación usados por el equipo en la temporada (tope 5, spec §9).
// Cuenta filas de lineup_change_logs vía la temporada de su round.
async function fetchChangeCount(teamId: string, seasonId: string): Promise<number> {
  const { count, error } = await supabase
    .from('lineup_change_logs')
    .select('id, round:rounds!inner(season_id)', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('round.season_id', seasonId)
  if (error) throw error
  return count ?? 0
}

export function useChangeCount(teamId: string | undefined, seasonId: string | undefined) {
  return useQuery({
    queryKey: ['change-count', teamId, seasonId],
    queryFn: () => fetchChangeCount(teamId as string, seasonId as string),
    enabled: Boolean(teamId && seasonId),
  })
}
