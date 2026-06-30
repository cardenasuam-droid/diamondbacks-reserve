import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/context'

export interface CaptainTeam {
  id: string
  name: string
  color: string | null
  logo_url: string | null
  season_id: string
}

// El equipo del capitán, derivado de su ficha de jugador (profile.player_id).
// RLS: "players self read" permite leer la propia ficha; teams es público.
async function fetchCaptainTeam(playerId: string): Promise<CaptainTeam | null> {
  const { data, error } = await supabase
    .from('players')
    .select('team:teams(id, name, color, logo_url, season_id)')
    .eq('id', playerId)
    .maybeSingle()
  if (error) throw error
  const team = (data as { team: CaptainTeam | null } | null)?.team
  return team ?? null
}

export function useCaptainTeam() {
  const { profile } = useAuth()
  const playerId = profile?.player_id ?? undefined
  return useQuery({
    queryKey: ['captain-team', playerId],
    queryFn: () => fetchCaptainTeam(playerId as string),
    enabled: Boolean(playerId),
  })
}
