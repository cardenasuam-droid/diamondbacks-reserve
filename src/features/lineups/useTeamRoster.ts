import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TeamPlayer } from './types'

// Roster completo del equipo del capitán (incluye teléfono privado, visible solo
// para el capitán de ese equipo por RLS: "players self read" rama capitán).
async function fetchTeamRoster(teamId: string): Promise<TeamPlayer[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, full_name, gender, category_code, team_id, is_captain, phone')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .order('full_name')
  if (error) throw error
  return (data ?? []) as TeamPlayer[]
}

export function useTeamRoster(teamId: string | undefined) {
  return useQuery({
    queryKey: ['team-roster', teamId],
    queryFn: () => fetchTeamRoster(teamId as string),
    enabled: Boolean(teamId),
  })
}
