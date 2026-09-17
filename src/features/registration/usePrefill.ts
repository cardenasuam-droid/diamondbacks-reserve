import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Gender } from '@/lib/types'
import type { PlayerPosition } from './types'

export interface PlayerPrefill {
  full_name: string | null
  phone: string | null
  gender: Gender | null
  category_code: string | null
  position: PlayerPosition | null
  shirt_size: string | null
}

// Datos de TU PROPIA ficha (RPC my_player_prefill, 0055) para precargar la
// inscripción a otra liga. Silencioso por diseño: cualquier error (sin
// sesión, cuenta de staff sin ficha, RPC aún no desplegado) devuelve null y
// el formulario simplemente arranca vacío.
export function useMyPlayerPrefill(enabled: boolean) {
  return useQuery({
    queryKey: ['my-player-prefill'],
    queryFn: async (): Promise<PlayerPrefill | null> => {
      const { data, error } = await supabase.rpc('my_player_prefill')
      if (error) return null
      const row = (Array.isArray(data) ? data[0] : data) as PlayerPrefill | undefined
      return row ?? null
    },
    enabled,
    staleTime: 5 * 60_000,
  })
}
