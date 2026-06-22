import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Round } from './types'

// Jornadas de la temporada. El público solo ve las publicadas (RLS); el
// organizador ve también borradores.
async function fetchRounds(seasonId: string): Promise<Round[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, season_id, round_number, name, round_date, status')
    .eq('season_id', seasonId)
    .order('round_number')
  if (error) throw error
  return (data ?? []) as Round[]
}

export function useRounds(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['rounds', seasonId],
    queryFn: () => fetchRounds(seasonId as string),
    enabled: Boolean(seasonId),
  })
}
