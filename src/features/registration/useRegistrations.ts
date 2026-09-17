import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CategoryType } from '@/lib/types'
import type { PlayerRegistration } from './types'
import { genderForCategoryType } from './category'

// Cola de inscripciones pendientes DE UNA EDICIÓN. Solo el organizador la lee
// (RLS de 0014): las más antiguas primero, para atender por orden de llegada.
// El filtro por season_id es imprescindible desde 0049: hay más de una bandeja
// abierta a la vez (Reserve y Femenil) y no deben mezclarse.
export function usePendingRegistrations(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['registrations', 'pending', seasonId],
    queryFn: async (): Promise<PlayerRegistration[]> => {
      const { data, error } = await supabase
        .from('player_registrations')
        .select('*')
        .eq('status', 'pending')
        .eq('season_id', seasonId!)
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
          shirt_size: v.registration.shirt_size ?? null,
          // El lado de juego declarado se copia a la ficha (0026): así lo ven
          // capitanas y el sitio público, no solo el organizador en la bandeja.
          position: v.registration.position,
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
      void qc.invalidateQueries({ queryKey: ['pool-players', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['players_public', v.seasonId] })
    },
  })
}

// Verificar (o quitar la verificación de) el pago de una inscripción, con
// sello de quién y cuándo (0050). No toca el status: pagar y ser aprobada son
// decisiones separadas del comité.
export function useVerifyPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; verified: boolean }) => {
      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('player_registrations')
        .update({
          payment_verified_at: v.verified ? new Date().toISOString() : null,
          payment_verified_by: v.verified ? (auth.user?.id ?? null) : null,
        })
        .eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['registrations'] })
    },
  })
}

// URL firmada (10 min) para ver un comprobante del bucket privado 'receipts'.
// Solo organizador/viewer pasan la policy de lectura (0050).
export async function receiptSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 600)
  if (error || !data?.signedUrl) throw new Error('No se pudo abrir el comprobante.')
  return data.signedUrl
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
