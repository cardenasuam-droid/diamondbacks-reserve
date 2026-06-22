import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PublicPlayer } from '@/lib/types'

// Todos los jugadores públicos de la temporada (sin teléfono ni correo).
// Una sola consulta cacheada que alimenta tanto el listado de equipos
// (conteos) como cada roster (filtrando por team_id).
async function fetchPublicPlayers(seasonId: string): Promise<PublicPlayer[]> {
  const { data, error } = await supabase
    .from('players_public')
    .select('*')
    .eq('season_id', seasonId)
  if (error) throw error
  return (data ?? []) as PublicPlayer[]
}

export function usePublicPlayers(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['players_public', seasonId],
    queryFn: () => fetchPublicPlayers(seasonId as string),
    enabled: Boolean(seasonId),
  })
}
