import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { uploadMedia } from '@/features/news/contentMutations'
import type { Gender } from '@/lib/types'

export interface SavePlayerVars {
  id?: string
  season_id: string
  team_id: string
  full_name: string
  email: string
  phone: string
  gender: Gender
  category_code: string
  is_captain: boolean
  is_active: boolean
  photo_url: string
}

function friendly(msg: string): string {
  if (/row-level security/i.test(msg)) return 'No tienes permiso (¿eres organizador?).'
  if (/one_captain_per_team/i.test(msg)) return 'Ese equipo ya tiene un capitán.'
  if (/duplicate|unique/i.test(msg)) return 'Ya existe un jugador con ese email en la temporada.'
  if (/foreign key|violates|referenced/i.test(msg)) {
    return 'No se puede borrar: el jugador tiene alineaciones o resultados. Desactívalo en su lugar.'
  }
  return msg
}

function invalidate(qc: ReturnType<typeof useQueryClient>, v: { team_id: string; season_id: string }) {
  void qc.invalidateQueries({ queryKey: ['manage-roster', v.team_id] })
  void qc.invalidateQueries({ queryKey: ['teams', v.season_id] })
  void qc.invalidateQueries({ queryKey: ['players_public', v.season_id] })
}

export function useSavePlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: SavePlayerVars) => {
      const row = {
        full_name: v.full_name.trim(),
        email: v.email.trim() || null,
        phone: v.phone.trim() || null,
        gender: v.gender,
        category_code: v.category_code,
        is_captain: v.is_captain,
        is_active: v.is_active,
        photo_url: v.photo_url.trim() || null,
      }
      if (v.id) {
        const { error } = await supabase.from('players').update(row).eq('id', v.id)
        if (error) throw new Error(friendly(error.message))
      } else {
        const { error } = await supabase
          .from('players')
          .insert({ ...row, team_id: v.team_id, season_id: v.season_id })
        if (error) throw new Error(friendly(error.message))
      }
    },
    onSuccess: (_d, v) => invalidate(qc, v),
  })
}

export function useTogglePlayerActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; is_active: boolean; team_id: string; season_id: string }) => {
      const { error } = await supabase.from('players').update({ is_active: v.is_active }).eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => invalidate(qc, v),
  })
}

// El propio jugador sube su foto desde "Mi cuenta": sube al bucket y la RPC
// set_my_photo (0013) actualiza solo su ficha. Devuelve la URL pública.
export function useSetMyPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const url = await uploadMedia(file, 'players')
      const { error } = await supabase.rpc('set_my_photo', { p_url: url })
      if (error) throw new Error(friendly(error.message))
      return url
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['players_public'] })
      void qc.invalidateQueries({ queryKey: ['player-rankings'] })
    },
  })
}

export function useDeletePlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; team_id: string; season_id: string }) => {
      const { error } = await supabase.from('players').delete().eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => invalidate(qc, v),
  })
}

export interface AssignTeamVars {
  playerId: string
  /** Equipo destino; null regresa al jugador al pool (sin equipo). */
  teamId: string | null
  seasonId: string
  /** Equipo de origen (si lo movemos de un equipo), para refrescar su roster. */
  fromTeamId?: string | null
}

// Asignación MANUAL de equipo (organizador), independiente del draft: pone
// players.team_id directo. Sirve para sacar del pool, mover entre equipos o
// regresar al pool (teamId = null). El draft usa make_pick (turnos); esto NO.
export function useAssignPlayerTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: AssignTeamVars) => {
      const { error } = await supabase.from('players').update({ team_id: v.teamId }).eq('id', v.playerId)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['pool-players', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['pool-registrations', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['players_public', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['teams', v.seasonId] })
      if (v.teamId) void qc.invalidateQueries({ queryKey: ['manage-roster', v.teamId] })
      if (v.fromTeamId) void qc.invalidateQueries({ queryKey: ['manage-roster', v.fromTeamId] })
    },
  })
}
