import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CategoryType } from '@/lib/types'
import type { PlayerRegistration } from './types'
import { genderForCategoryType } from './category'

// Cola de inscripciones pendientes. Solo el organizador la lee (RLS de 0014):
// las más antiguas primero, para atender por orden de llegada.
export function usePendingRegistrations(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['registrations', 'pending', seasonId],
    queryFn: async (): Promise<PlayerRegistration[]> => {
      const { data, error } = await supabase
        .from('player_registrations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as PlayerRegistration[]
    },
    enabled: Boolean(seasonId),
  })
}

function friendly(msg: string): string {
  if (/one_captain_per_team/i.test(msg)) return 'Ese equipo ya tiene capitán.'
  if (/duplicate|unique/i.test(msg)) return 'Ya existe un jugador con esos datos en la temporada.'
  if (/row-level security/i.test(msg)) return 'No tienes permiso (¿eres organizador?).'
  return msg
}

export interface ApproveVars {
  registration: PlayerRegistration
  categoryCode: string
  categoryType: CategoryType
  seasonId: string
}

// Aprobar = crear la ficha en players SIN equipo (free agent del pool); el DRAFT
// asignará el equipo después. El comité confirma/ajusta la categoría; el género
// se deriva de ella.
export function useApproveRegistration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: ApproveVars) => {
      const gender = genderForCategoryType(v.categoryType)
      if (!gender) throw new Error('La categoría debe ser varonil o femenil.')

      const { data: player, error: insErr } = await supabase
        .from('players')
        .insert({
          season_id: v.seasonId,
          team_id: null, // pool: sin equipo hasta el draft
          full_name: v.registration.full_name.trim(),
          email: null,
          phone: v.registration.phone.trim(),
          gender,
          category_code: v.categoryCode,
          is_captain: false,
          is_active: true,
          photo_url: null,
        })
        .select('id')
        .single()
      if (insErr) throw new Error(friendly(insErr.message))

      const { data: auth } = await supabase.auth.getUser()
      const { error: updErr } = await supabase
        .from('player_registrations')
        .update({
          status: 'approved',
          created_player_id: player.id,
          reviewed_by: auth.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', v.registration.id)
      if (updErr) throw new Error(friendly(updErr.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['registrations'] })
      void qc.invalidateQueries({ queryKey: ['draft-pool', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['players_public', v.seasonId] })
    },
  })
}

// Rechazar = marcar la inscripción (no crea jugador). Notas opcionales del comité.
export function useRejectRegistration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; notes?: string }) => {
      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('player_registrations')
        .update({
          status: 'rejected',
          reviewed_by: auth.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          review_notes: v.notes?.trim() ? v.notes.trim() : null,
        })
        .eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['registrations'] })
    },
  })
}
