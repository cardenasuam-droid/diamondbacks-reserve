import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { recomputeRatings, invalidateRating } from './useRecomputeRatings'

// Gestión del rating por el organizador (migración 0039).
//
// El organizador NUNCA escribe el rating vigente: escribe la SEMILLA o un AJUSTE
// con motivo. El rating se recalcula a partir de ellos, así que cualquier cambio
// dispara un recálculo completo. Esa es la razón de que estas mutaciones no
// terminen al guardar: guardar y no recalcular dejaría la ficha pública mostrando
// un número que ya no corresponde a sus entradas.

export interface RatingRosterRow {
  id: string
  full_name: string
  category_code: string
  team_id: string | null
  is_active: boolean
  is_waitlisted: boolean
  rating_seed: number | null
  rating_seed_source: 'dictado' | 'categoria' | null
  rating: number | null
  rating_matches: number
}

/**
 * Roster con los datos de rating. Lee `players` DIRECTO y no `players_public`,
 * porque la semilla y su origen son datos de gestión que la vista no expone (y
 * porque la vista oculta el rating de quien está en lista de espera). La RLS
 * "organizer all" es la que decide quién puede leer esto.
 */
export function useRatingRoster(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['rating-roster', seasonId],
    enabled: Boolean(seasonId),
    queryFn: async (): Promise<RatingRosterRow[]> => {
      const { data, error } = await supabase
        .from('players')
        .select(
          'id, full_name, category_code, team_id, is_active, is_waitlisted, rating_seed, rating_seed_source, rating, rating_matches',
        )
        .eq('season_id', seasonId as string)
        .eq('is_active', true)
        .order('full_name')
      if (error) throw error
      // Postgres serializa numeric como string.
      return (data ?? []).map((p) => ({
        ...(p as RatingRosterRow),
        rating_seed: p.rating_seed == null ? null : Number(p.rating_seed),
        rating: p.rating == null ? null : Number(p.rating),
        rating_matches: Number(p.rating_matches ?? 0),
      }))
    },
  })
}

export interface RatingAdjustmentRow {
  id: string
  player_id: string
  round_id: string | null
  delta: number
  reason: string
  created_at: string
}

export function useRatingAdjustments(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['rating-adjustments', seasonId],
    enabled: Boolean(seasonId),
    queryFn: async (): Promise<RatingAdjustmentRow[]> => {
      const { data, error } = await supabase
        .from('player_rating_adjustments')
        .select('id, player_id, round_id, delta, reason, created_at')
        .eq('season_id', seasonId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((a) => ({ ...(a as RatingAdjustmentRow), delta: Number(a.delta) }))
    },
  })
}

function friendly(message: string): string {
  if (/row-level security/i.test(message)) return 'No tienes permiso (¿eres organizador?).'
  if (/Solo el organizador/i.test(message)) return 'No tienes permiso para recalcular el rating.'
  return message
}

export function useSetRatingSeed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { playerId: string; seed: number; seasonId: string }) => {
      // No se mandan rating_seed_at/by: los sella el trigger en el servidor.
      // Tampoco `rating`: si el jugador aún no tiene partidos lo arrastra el
      // trigger, y si los tiene lo manda el recálculo de abajo.
      const { error } = await supabase
        .from('players')
        .update({ rating_seed: vars.seed })
        .eq('id', vars.playerId)
      if (error) throw new Error(friendly(error.message))
      return recomputeRatings(vars.seasonId)
    },
    onSuccess: (_r, vars) => {
      void qc.invalidateQueries({ queryKey: ['rating-roster', vars.seasonId] })
      invalidateRating(qc)
    },
  })
}

export function useAddRatingAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      playerId: string
      seasonId: string
      roundId: string | null
      delta: number
      reason: string
    }) => {
      const { error } = await supabase.from('player_rating_adjustments').insert({
        player_id: vars.playerId,
        season_id: vars.seasonId,
        round_id: vars.roundId,
        delta: vars.delta,
        reason: vars.reason,
        // created_by lo pone el cliente aquí porque la tabla no tiene trigger de
        // auditoría: es una fila nueva por definición, no una edición.
        created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      })
      if (error) throw new Error(friendly(error.message))
      return recomputeRatings(vars.seasonId)
    },
    onSuccess: (_r, vars) => {
      void qc.invalidateQueries({ queryKey: ['rating-adjustments', vars.seasonId] })
      void qc.invalidateQueries({ queryKey: ['rating-roster', vars.seasonId] })
      invalidateRating(qc)
    },
  })
}

export function useDeleteRatingAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; seasonId: string }) => {
      const { error } = await supabase.from('player_rating_adjustments').delete().eq('id', vars.id)
      if (error) throw new Error(friendly(error.message))
      return recomputeRatings(vars.seasonId)
    },
    onSuccess: (_r, vars) => {
      void qc.invalidateQueries({ queryKey: ['rating-adjustments', vars.seasonId] })
      void qc.invalidateQueries({ queryKey: ['rating-roster', vars.seasonId] })
      invalidateRating(qc)
    },
  })
}
