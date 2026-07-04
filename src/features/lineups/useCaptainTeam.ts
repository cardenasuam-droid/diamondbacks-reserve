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
// SOLO devuelve equipo si la ficha es capitana (is_captain): un jugador normal con
// equipo NO es capitán, así que no debe habilitarse para hacer picks en el draft.
// RLS: "players self read" permite leer la propia ficha; teams es público.
async function fetchCaptainTeam(playerId: string): Promise<CaptainTeam | null> {
  const { data, error } = await supabase
    .from('players')
    .select('is_captain, team:teams(id, name, color, logo_url, season_id)')
    .eq('id', playerId)
    .maybeSingle()
  if (error) throw error
  const row = data as { is_captain: boolean; team: CaptainTeam | null } | null
  return row?.is_captain ? (row.team ?? null) : null
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
