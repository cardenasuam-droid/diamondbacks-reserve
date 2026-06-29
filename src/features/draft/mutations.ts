import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Draft } from './types'

function friendly(msg: string): string {
  if (/does not exist|schema cache|could not find/i.test(msg)) {
    return 'El draft aún no está habilitado (falta aplicar la migración 0015 en Supabase).'
  }
  if (/no es tu turno/i.test(msg)) return 'No es tu turno.'
  if (/ya tiene equipo/i.test(msg)) return 'Ese jugador ya fue elegido.'
  if (/no elegible/i.test(msg)) return 'Ese jugador no es elegible para este pick.'
  if (/row-level security|solo el organizador/i.test(msg)) return 'No tienes permiso para esa acción.'
  return msg
}

// Crea el draft de la temporada (organizador). Estado inicial 'setup'.
export function useCreateDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (seasonId: string): Promise<Draft> => {
      const { data, error } = await supabase
        .from('drafts')
        .insert({ season_id: seasonId })
        .select('*')
        .single()
      if (error) throw new Error(friendly(error.message))
      return data as Draft
    },
    onSuccess: (d) => void qc.invalidateQueries({ queryKey: ['draft', d.season_id] }),
  })
}

// Ajusta los segundos por pick (antes de iniciar). Update directo (RLS organizador).
export function useUpdateDraftSeconds() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { draftId: string; seasonId: string; seconds: number }) => {
      const { error } = await supabase.from('drafts').update({ pick_seconds: v.seconds }).eq('id', v.draftId)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => void qc.invalidateQueries({ queryKey: ['draft', v.seasonId] }),
  })
}

// Fija el orden de elección (antes de iniciar). order = [{team_id, pick_number}].
export function useSetDraftOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { draftId: string; order: { team_id: string; pick_number: number }[] }) => {
      const { error } = await supabase.rpc('set_draft_order', { p_draft_id: v.draftId, p_order: v.order })
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => void qc.invalidateQueries({ queryKey: ['draft-teams', v.draftId] }),
  })
}

export function useStartDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { draftId: string; seasonId: string }) => {
      const { error } = await supabase.rpc('start_draft', { p_draft_id: v.draftId })
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['draft', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['draft-board', v.draftId] })
    },
  })
}

export function useMakePick() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { draftId: string; seasonId: string; playerId: string }) => {
      const { error } = await supabase.rpc('make_pick', { p_draft_id: v.draftId, p_player_id: v.playerId })
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['draft', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['draft-board', v.draftId] })
      void qc.invalidateQueries({ queryKey: ['players_public', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['pool-players', v.seasonId] })
    },
  })
}

// Auto-pick por tiempo. Idempotente en el servidor (no-op si el reloj no venció).
// El llamador (timer anfitrión / fallback) ignora errores transitorios.
export function useAutoPick() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { draftId: string; seasonId: string }) => {
      const { error } = await supabase.rpc('auto_pick', { p_draft_id: v.draftId })
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['draft', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['draft-board', v.draftId] })
      void qc.invalidateQueries({ queryKey: ['players_public', v.seasonId] })
      void qc.invalidateQueries({ queryKey: ['pool-players', v.seasonId] })
    },
  })
}

export function usePauseDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { draftId: string; seasonId: string }) => {
      const { error } = await supabase.rpc('pause_draft', { p_draft_id: v.draftId })
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => void qc.invalidateQueries({ queryKey: ['draft', v.seasonId] }),
  })
}

export function useResumeDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { draftId: string; seasonId: string }) => {
      const { error } = await supabase.rpc('resume_draft', { p_draft_id: v.draftId })
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => void qc.invalidateQueries({ queryKey: ['draft', v.seasonId] }),
  })
}
