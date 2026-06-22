import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface SaveTeamVars {
  id?: string
  season_id: string
  name: string
  color: string
  logo_url: string
  slogan: string
}

function friendly(msg: string): string {
  if (/row-level security/i.test(msg)) return 'No tienes permiso (¿eres organizador?).'
  if (/duplicate|unique/i.test(msg)) return 'Ya existe un equipo con ese nombre.'
  if (/foreign key|violates|referenced/i.test(msg)) {
    return 'No se puede borrar: el equipo tiene partidos o jugadores asociados.'
  }
  return msg
}

export function useSaveTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: SaveTeamVars) => {
      const row = {
        name: v.name.trim(),
        color: v.color.trim() || null,
        logo_url: v.logo_url.trim() || null,
        slogan: v.slogan.trim() || null,
      }
      if (v.id) {
        const { error } = await supabase.from('teams').update(row).eq('id', v.id)
        if (error) throw new Error(friendly(error.message))
      } else {
        const { error } = await supabase.from('teams').insert({ ...row, season_id: v.season_id })
        if (error) throw new Error(friendly(error.message))
      }
    },
    onSuccess: (_d, v) => void qc.invalidateQueries({ queryKey: ['teams', v.season_id] }),
  })
}

export function useDeleteTeam(seasonId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['teams', seasonId] }),
  })
}
