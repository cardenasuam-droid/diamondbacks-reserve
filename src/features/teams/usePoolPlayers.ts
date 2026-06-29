import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Gender } from '@/lib/types'

export interface PoolPlayer {
  id: string
  full_name: string
  phone: string | null
  gender: Gender
  category_code: string
}

// El POOL: jugadores aprobados aún SIN equipo (free agents), de la temporada.
// Lo lee el organizador (RLS organizer all sobre players) — incluye teléfono.
export function usePoolPlayers(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['pool-players', seasonId],
    queryFn: async (): Promise<PoolPlayer[]> => {
      const { data, error } = await supabase
        .from('players')
        .select('id, full_name, phone, gender, category_code')
        .eq('season_id', seasonId as string)
        .is('team_id', null)
        .eq('is_active', true)
        .order('full_name')
      if (error) throw error
      return (data ?? []) as PoolPlayer[]
    },
    enabled: Boolean(seasonId),
  })
}
