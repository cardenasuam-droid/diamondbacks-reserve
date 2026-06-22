import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Team } from '@/lib/types'

async function fetchTeams(seasonId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('season_id', seasonId)
    .order('name')
  if (error) throw error
  return (data ?? []) as Team[]
}

export function useTeams(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['teams', seasonId],
    queryFn: () => fetchTeams(seasonId as string),
    enabled: Boolean(seasonId),
  })
}
