import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Draft, DraftPick, DraftTeam, DraftCategoryOrder } from './types'

// El draft de la temporada (uno por temporada). null si aún no se ha creado.
export function useDraft(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['draft', seasonId],
    queryFn: async (): Promise<Draft | null> => {
      const { data, error } = await supabase
        .from('drafts')
        .select('*')
        .eq('season_id', seasonId as string)
        .maybeSingle()
      if (error) throw error
      return (data as Draft | null) ?? null
    },
    enabled: Boolean(seasonId),
  })
}

// Orden de elección (snake), por pick_number.
export function useDraftTeams(draftId: string | undefined) {
  return useQuery({
    queryKey: ['draft-teams', draftId],
    queryFn: async (): Promise<DraftTeam[]> => {
      const { data, error } = await supabase
        .from('draft_teams')
        .select('*')
        .eq('draft_id', draftId as string)
        .order('pick_number')
      if (error) throw error
      return (data ?? []) as DraftTeam[]
    },
    enabled: Boolean(draftId),
  })
}

// El board completo (todos los slots), por pick_number.
export function useDraftBoard(draftId: string | undefined) {
  return useQuery({
    queryKey: ['draft-board', draftId],
    queryFn: async (): Promise<DraftPick[]> => {
      const { data, error } = await supabase
        .from('draft_picks')
        .select('*')
        .eq('draft_id', draftId as string)
        .order('pick_number')
      if (error) throw error
      return (data ?? []) as DraftPick[]
    },
    enabled: Boolean(draftId),
  })
}

// Órdenes sorteadas por categoría (0028). Base de la animación del sorteo.
export function useDraftCategoryOrders(draftId: string | undefined) {
  return useQuery({
    queryKey: ['draft-category-orders', draftId],
    queryFn: async (): Promise<DraftCategoryOrder[]> => {
      const { data, error } = await supabase
        .from('draft_category_orders')
        .select('*')
        .eq('draft_id', draftId as string)
        .order('category_code')
        .order('position')
      if (error) throw error
      return (data ?? []) as DraftCategoryOrder[]
    },
    enabled: Boolean(draftId),
  })
}

// El slot actual = el de menor pick_number sin jugador, IGNORANDO los "no pick"
// de capitana (is_skip), que el motor salta y nunca se llenan.
export function currentOpenPick(board: DraftPick[]): DraftPick | null {
  return board.find((p) => p.player_id === null && !p.is_skip) ?? null
}
