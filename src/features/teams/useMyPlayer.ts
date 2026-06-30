import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ShirtSize } from '@/lib/shirtSize'

// Ficha PROPIA del jugador leída desde la tabla players (no la vista pública).
// La RLS "players self read" deja que cada quien lea su propia fila, así puede
// ver datos que NO son públicos (p. ej. su talla de playera).
export interface MyPlayer {
  id: string
  shirt_size: ShirtSize | null
}

export function useMyPlayer(playerId: string | undefined) {
  return useQuery({
    queryKey: ['my-player', playerId],
    queryFn: async (): Promise<MyPlayer | null> => {
      const { data, error } = await supabase
        .from('players')
        .select('id, shirt_size')
        .eq('id', playerId as string)
        .maybeSingle()
      if (error) throw error
      return (data as MyPlayer | null) ?? null
    },
    enabled: Boolean(playerId),
  })
}
