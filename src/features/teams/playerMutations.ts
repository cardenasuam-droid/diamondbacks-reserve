import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { uploadMedia } from '@/features/news/contentMutations'
import type { Gender } from '@/lib/types'
import type { ShirtSize } from '@/lib/shirtSize'

export interface SavePlayerVars {
  id?: string
  season_id: string
  team_id: string
  full_name: string
  email: string
  phone: string
  gender: Gender
  category_code: string
  shirt_size: ShirtSize | null
  is_captain: boolean
  is_active: boolean
  is_paid: boolean
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

function invalidate(qc: ReturnType<typeof useQueryClient>, v: { team_id: string | null; season_id: string }) {
  if (v.team_id) void qc.invalidateQueries({ queryKey: ['manage-roster', v.team_id] })
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
        shirt_size: v.shirt_size,
        is_captain: v.is_captain,
        is_active: v.is_active,
        is_paid: v.is_paid,
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
    mutationFn: async (v: { id: string; is_active: boolean; team_id: string | null; season_id: string }) => {
      // Al inhabilitar, regresa al pool (team_id null): de lo contrario
      // players_public (is_active=false) lo esconde de TODAS las pantallas,
      // incluido el pool, y queda invisible salvo en este roster.
      const patch: { is_active: boolean; team_id?: null } = { is_active: v.is_active }
      if (!v.is_active) patch.team_id = null
      const { error } = await supabase.from('players').update(patch).eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      invalidate(qc, v)
      void qc.invalidateQueries({ queryKey: ['pool-players', v.season_id] })
      void qc.invalidateQueries({ queryKey: ['inactive-pool-players', v.season_id] })
    },
  })
}

// Marca/desmarca a un jugador como "Pagó su inscripción". Solo el organizador
// (RLS "organizer all" de players). paid_at/paid_by los sella el trigger del
// servidor (0022). Sirve tanto para el pool (team_id null) como para asignados.
export function useSetPlayerPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; is_paid: boolean; season_id: string; team_id: string | null }) => {
      const { error } = await supabase.from('players').update({ is_paid: v.is_paid }).eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      invalidate(qc, v)
      void qc.invalidateQueries({ queryKey: ['pool-paid', v.season_id] })
    },
  })
}

// Mueve un jugador entre el POOL y la LISTA DE ESPERA (bidireccional). Solo el
// organizador (RLS "organizer all" de players). No toca team_id: el jugador sigue
// sin equipo; solo cambia si cuenta como pool (elegible en draft) o está apartado.
// waitlisted_at lo sella el trigger del servidor (0023).
export function useSetWaitlisted() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; is_waitlisted: boolean; season_id: string }) => {
      const { error } = await supabase.from('players').update({ is_waitlisted: v.is_waitlisted }).eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['pool-players', v.season_id] })
      void qc.invalidateQueries({ queryKey: ['waitlist-players', v.season_id] })
      void qc.invalidateQueries({ queryKey: ['waitlist-meta', v.season_id] })
      void qc.invalidateQueries({ queryKey: ['players_public', v.season_id] })
    },
  })
}

// El propio jugador sube su foto desde "Mi cuenta": sube al bucket y la RPC
// set_my_photo (0013) actualiza solo su ficha. Devuelve la URL pública.
export function useSetMyPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      // La foto va a players/<uid>/ para que la policy de Storage (0018) la ligue a
      // la identidad: nadie puede escribir en la carpeta de otro usuario.
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
      if (!uid) throw new Error('Sesión no válida. Vuelve a iniciar sesión.')
      const url = await uploadMedia(file, `players/${uid}`, 'image')
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

// El propio jugador fija SU talla de playera desde "Mi cuenta" (RPC set_my_shirt_size,
// 0017), sin abrir un UPDATE general sobre players.
export function useSetMyShirtSize() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (size: ShirtSize) => {
      const { error } = await supabase.rpc('set_my_shirt_size', { p_size: size })
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-player'] })
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
      void qc.invalidateQueries({ queryKey: ['inactive-pool-players', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['pool-registrations', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['players_public', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['teams', v.seasonId] })
      if (v.teamId) void qc.invalidateQueries({ queryKey: ['manage-roster', v.teamId] })
      if (v.fromTeamId) void qc.invalidateQueries({ queryKey: ['manage-roster', v.fromTeamId] })
    },
  })
}
