import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Puente Realtime → TanStack Query: suscribe los cambios de la fila del draft y
// de los picks (publicación supabase_realtime, migración 0015) e invalida las
// queries para que TODOS los clientes (capitanas, organizador, público) vean lo
// mismo al instante. También refresca players_public (un jugador drafteado deja
// el pool al asignársele team_id).
export function useDraftRealtime(draftId: string | undefined, seasonId: string | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!draftId || !seasonId) return
    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: ['draft', seasonId] })
      void qc.invalidateQueries({ queryKey: ['draft-board', draftId] })
      void qc.invalidateQueries({ queryKey: ['draft-teams', draftId] })
      void qc.invalidateQueries({ queryKey: ['players_public', seasonId] })
    }
    const channel = supabase
      .channel(`draft:${draftId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drafts', filter: `id=eq.${draftId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'draft_picks', filter: `draft_id=eq.${draftId}` },
        invalidate,
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [draftId, seasonId, qc])
}
