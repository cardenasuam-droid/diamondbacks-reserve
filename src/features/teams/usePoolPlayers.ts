import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Gender } from '@/lib/types'

export interface PoolPlayer {
  id: string
  full_name: string
  phone: string | null
  gender: Gender
  category_code: string
}

function friendly(msg: string): string {
  if (/row-level security/i.test(msg)) return 'No tienes permiso (¿eres organizador?).'
  if (/foreign key|violates|referenced/i.test(msg)) return 'No se puede borrar: el jugador ya tiene datos asociados.'
  return msg
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

export interface UpdatePoolVars {
  id: string
  seasonId: string
  full_name: string
  phone: string
  gender: Gender
  category_code: string
}

// Edita un jugador del pool (nombre/teléfono/categoría; el género se deriva de la
// categoría). NO toca team_id (sigue en el pool).
export function useUpdatePoolPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: UpdatePoolVars) => {
      const { error } = await supabase
        .from('players')
        .update({
          full_name: v.full_name.trim(),
          phone: v.phone.trim() || null,
          gender: v.gender,
          category_code: v.category_code,
        })
        .eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['pool-players', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['players_public', v.seasonId] })
    },
  })
}

// Quita un jugador del pool (lo borra; aún no tiene alineaciones/resultados).
export function useDeletePoolPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; seasonId: string }) => {
      const { error } = await supabase.from('players').delete().eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['pool-players', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['players_public', v.seasonId] })
    },
  })
}
