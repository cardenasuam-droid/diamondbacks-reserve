import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { deriveResult, type SetInput } from '@/features/results/resultLogic'
import type { IndMatch, IndPenalty, IndStandingsRow, Court } from './types'

// Datos remotos del módulo americano (0051). Los nombres de jugadoras NO se
// embeben desde `players` (la tabla base está restringida por RLS: teléfono);
// las páginas los resuelven con players_public vía usePlayersMap.

export function useIndMatches(roundId: string | undefined) {
  return useQuery({
    queryKey: ['ind-matches', roundId],
    queryFn: async (): Promise<IndMatch[]> => {
      const { data, error } = await supabase
        .from('ind_matches')
        .select('*, players:ind_match_players(match_id, player_id, side, slot), result:ind_match_results(*)')
        .eq('round_id', roundId!)
      if (error) throw error
      const rows = ((data ?? []) as unknown as (Omit<IndMatch, 'result'> & { result: IndMatch['result'] | IndMatch['result'][] })[])
      // PostgREST devuelve la relación 1:1 como arreglo si no conoce el UNIQUE.
      return rows.map((r) => ({
        ...r,
        result: Array.isArray(r.result) ? (r.result[0] ?? null) : (r.result ?? null),
      })) as IndMatch[]
    },
    enabled: Boolean(roundId),
  })
}

// Mapa playerId → ficha pública de la temporada (nombre, categoría, foto).
export function usePlayersMap(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['players_public', seasonId, 'map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players_public')
        .select('id, full_name, category_code, gender, photo_url, is_waitlisted')
        .eq('season_id', seasonId!)
      if (error) throw error
      const map = new Map<string, { id: string; full_name: string; category_code: string; photo_url: string | null; is_waitlisted: boolean }>()
      for (const p of (data ?? []) as never[]) map.set((p as { id: string }).id, p as never)
      return map
    },
    enabled: Boolean(seasonId),
  })
}

export function useIndStandings(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['ind-standings', seasonId],
    queryFn: async (): Promise<IndStandingsRow[]> => {
      const { data, error } = await supabase
        .from('ind_standings')
        .select('*')
        .eq('season_id', seasonId!)
      if (error) throw error
      return (data ?? []) as IndStandingsRow[]
    },
    enabled: Boolean(seasonId),
  })
}

export function useCourts() {
  return useQuery({
    queryKey: ['courts'],
    queryFn: async (): Promise<Court[]> => {
      const { data, error } = await supabase
        .from('courts')
        .select('*')
        .eq('is_active', true)
        .order('number')
      if (error) throw error
      return (data ?? []) as Court[]
    },
    staleTime: 10 * 60_000,
  })
}

export function usePenalties(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['ind-penalties', seasonId],
    queryFn: async (): Promise<IndPenalty[]> => {
      const { data, error } = await supabase
        .from('ind_penalties')
        .select('*')
        .eq('season_id', seasonId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as IndPenalty[]
    },
    enabled: Boolean(seasonId),
  })
}

function friendly(msg: string): string {
  if (/ya está programada/i.test(msg)) return 'Esa jugadora ya está en otro juego de esta jornada.'
  if (/no pertenece a la temporada/i.test(msg)) return 'Esa jugadora no pertenece a esta edición.'
  if (/ind_matches_round_id_time_block_id_court_id|duplicate key/i.test(msg)) {
    return 'Esa cancha ya está ocupada en ese horario de la jornada.'
  }
  if (/row-level security/i.test(msg)) return 'No tienes permiso (¿eres organizador?).'
  return msg
}

export interface SaveIndMatchVars {
  matchId?: string
  seasonId: string
  roundId: string
  categoryCode: string
  courtId: string | null
  timeBlockId: string | null
  /** [lado1-slot1, lado1-slot2, lado2-slot1, lado2-slot2] */
  playerIds: [string, string, string, string]
}

// Crear/editar un juego con sus 4 jugadoras vía el RPC save_ind_match (0054):
// una sola transacción, así un candado que rechace (jugadora repetida en la
// jornada, choque de cancha) revierte TODO y la alineación previa del juego
// sobrevive. La RLS sigue mandando: el RPC es SECURITY INVOKER.
export function useSaveIndMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: SaveIndMatchVars) => {
      const distinct = new Set(v.playerIds)
      if (v.playerIds.some((p) => !p) || distinct.size !== 4) {
        throw new Error('Elige 4 jugadoras distintas.')
      }

      const { error } = await supabase.rpc('save_ind_match', {
        p_match_id: v.matchId ?? null,
        p_season_id: v.seasonId,
        p_round_id: v.roundId,
        p_category_code: v.categoryCode,
        p_court_id: v.courtId,
        p_time_block_id: v.timeBlockId,
        p_player_ids: v.playerIds,
      })
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['ind-matches', v.roundId] })
    },
  })
}

export function useDeleteIndMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { matchId: string; roundId: string }) => {
      const { error } = await supabase.from('ind_matches').delete().eq('id', v.matchId)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['ind-matches', v.roundId] })
    },
  })
}

export interface SaveIndResultVars {
  matchId: string
  roundId: string
  seasonId: string
  set1: SetInput
  set2: SetInput
  set3: SetInput
  walkover: boolean
  walkoverSide: 1 | 2 | null
  profileId: string | null
}

// Captura del organizador (espejo de useSaveResult de equipos): marcadores
// crudos + ganador + walkover; los puntos los deriva la vista (§3.4).
export function useSaveIndResult() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: SaveIndResultVars) => {
      const now = new Date().toISOString()
      let payload: Record<string, unknown>

      if (v.walkover) {
        if (!v.walkoverSide) throw new Error('Indica qué pareja no se presentó.')
        payload = {
          match_id: v.matchId,
          is_walkover: true,
          walkover_side: v.walkoverSide,
          winner_side: v.walkoverSide === 1 ? 2 : 1,
          status: 'walkover',
          set1_side1: null, set1_side2: null,
          set2_side1: null, set2_side2: null,
          set3_side1: null, set3_side2: null,
          reported_by: v.profileId,
          validated_at: now,
        }
      } else {
        const d = deriveResult([v.set1, v.set2, v.set3])
        if (d.error) throw new Error(d.error)
        if (!d.decided) throw new Error('Marcador incompleto: falta un set decisivo.')
        payload = {
          match_id: v.matchId,
          is_walkover: false,
          walkover_side: null,
          winner_side: d.winnerSide === 'a' ? 1 : 2,
          status: 'validated',
          set1_side1: v.set1.a, set1_side2: v.set1.b,
          set2_side1: v.set2.a, set2_side2: v.set2.b,
          set3_side1: v.set3.a, set3_side2: v.set3.b,
          reported_by: v.profileId,
          validated_at: now,
        }
      }

      const { error } = await supabase
        .from('ind_match_results')
        .upsert(payload, { onConflict: 'match_id' })
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['ind-matches', v.roundId] })
      void qc.invalidateQueries({ queryKey: ['ind-standings', v.seasonId] })
    },
  })
}

export function useDeleteIndResult() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { matchId: string; roundId: string; seasonId: string }) => {
      const { error } = await supabase.from('ind_match_results').delete().eq('match_id', v.matchId)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['ind-matches', v.roundId] })
      void qc.invalidateQueries({ queryKey: ['ind-standings', v.seasonId] })
    },
  })
}

// Publicar/despublicar una jornada: es el candado que abre el rol al público
// (RLS de 0051 y de rounds).
export function useSetRoundStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { roundId: string; seasonId: string; status: 'draft' | 'published' }) => {
      const { error } = await supabase.from('rounds').update({ status: v.status }).eq('id', v.roundId)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['rounds', v.seasonId] })
    },
  })
}

export function useAddPenalty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { seasonId: string; playerId: string; points: number; reason: string }) => {
      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase.from('ind_penalties').insert({
        season_id: v.seasonId,
        player_id: v.playerId,
        points: v.points,
        reason: v.reason.trim(),
        created_by: auth.user?.id ?? null,
      })
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['ind-penalties', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['ind-standings', v.seasonId] })
    },
  })
}

export function useDeletePenalty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; seasonId: string }) => {
      const { error } = await supabase.from('ind_penalties').delete().eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['ind-penalties', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['ind-standings', v.seasonId] })
    },
  })
}
