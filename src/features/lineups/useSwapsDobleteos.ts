import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { SeasonEntry } from './dobleteos'

// Datos de la pantalla de Swaps y dobleteos (migración 0047).

export interface TeamSwap {
  id: string
  team_id: string
  round_number: number
  category_code: string | null
  created_at: string
  player_out_id: string | null
  player_in_id: string | null
}

/**
 * Swaps contados de TODOS los equipos (vista team_swaps, solo authenticated).
 * El CONTEO por equipo es por log distinto (ids únicos): un cambio de pareja
 * completa emite dos filas de detalle pero cuenta como un solo swap, igual que
 * lo cuenta el tope del servidor.
 */
export function useTeamSwaps(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['team-swaps', seasonId],
    enabled: Boolean(seasonId),
    queryFn: async (): Promise<TeamSwap[]> => {
      const { data, error } = await supabase
        .from('team_swaps')
        .select('*')
        .eq('season_id', seasonId as string)
        .order('round_number')
      if (error) throw error
      return (data ?? []) as TeamSwap[]
    },
  })
}

export function swapCountByTeam(swaps: TeamSwap[]): Map<string, number> {
  const vistos = new Map<string, Set<string>>()
  for (const s of swaps) {
    const set = vistos.get(s.team_id) ?? new Set<string>()
    set.add(s.id)
    vistos.set(s.team_id, set)
  }
  return new Map([...vistos].map(([team, ids]) => [team, ids.size]))
}

/**
 * Todas las entradas de alineación PUBLICADAS de la temporada, para derivar los
 * dobleteos. Datos públicos (la RLS de 0036 ya los expone publicados).
 */
export function useSeasonEntries(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['season-entries', seasonId],
    enabled: Boolean(seasonId),
    queryFn: async (): Promise<SeasonEntry[]> => {
      const { data, error } = await supabase
        .from('lineup_entries')
        .select(
          `category_code, player_1_id, player_2_id,
           lineup:lineups!inner(team_id, locked_at,
             matchup:team_matchups!inner(round:rounds!inner(round_number, season_id)))`,
        )
        .eq('lineup.matchup.round.season_id', seasonId as string)
        .not('lineup.locked_at', 'is', null)
      if (error) throw error

      interface Raw {
        category_code: string
        player_1_id: string | null
        player_2_id: string | null
        lineup: { team_id: string; matchup: { round: { round_number: number } } | null } | null
      }
      return ((data ?? []) as unknown as Raw[])
        .filter((r) => r.lineup?.matchup?.round)
        .map((r) => ({
          round_number: r.lineup!.matchup!.round.round_number,
          team_id: r.lineup!.team_id,
          category_code: r.category_code,
          player_1_id: r.player_1_id,
          player_2_id: r.player_2_id,
        }))
    },
  })
}

export interface RegisterSwapVars {
  roundId: string
  playerOut: string
  playerIn: string
  /** Solo lo manda el organizador al registrar por otro equipo. */
  teamId?: string | null
  /** Solo si el que sale está en más de una categoría esa jornada. */
  categoryCode?: string | null
  seasonId: string
}

export function useRegisterSwap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: RegisterSwapVars) => {
      const { data, error } = await supabase.rpc('register_swap', {
        p_round_id: vars.roundId,
        p_player_out: vars.playerOut,
        p_player_in: vars.playerIn,
        p_team_id: vars.teamId ?? null,
        p_category_code: vars.categoryCode ?? null,
      })
      if (error) throw new Error(error.message)
      return data as { ok: boolean; swaps_usados: number; limite: number }
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['team-swaps', vars.seasonId] })
      void qc.invalidateQueries({ queryKey: ['season-entries', vars.seasonId] })
      // La alineación cambió: el rol público, el detalle del partido y el
      // contador de swaps del editor deben refrescarse.
      void qc.invalidateQueries({ queryKey: ['published-lineups'] })
      void qc.invalidateQueries({ queryKey: ['round-matches'] })
      void qc.invalidateQueries({ queryKey: ['change-count'] })
      void qc.invalidateQueries({ queryKey: ['captain-round-matchup'] })
    },
  })
}
