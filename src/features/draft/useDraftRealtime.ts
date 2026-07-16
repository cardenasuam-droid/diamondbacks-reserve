import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { PublicPlayer } from '@/lib/types'
import type { DraftPick } from './types'

// Puente Realtime → TanStack Query. Mantiene el estado del draft en vivo para
// TODOS los clientes (capitanas, organizador, público) sin ahogar el backend.
//
// Por qué así (aprendido en un draft real con tráfico alto):
//  · Cada pick escribe en draft_picks + players + drafts, generando 2 eventos
//    postgres_changes. Antes, cada cliente reaccionaba invalidando 6 queries por
//    evento → con N clientes = ~12N refetches por pick, DOS de ellos el roster
//    completo (players_public). Eso saturaba la API y los picks tardaban en verse.
//  · Ahora:
//     1) DEBOUNCE: los eventos de un mismo pick (y ráfagas como begin_category) se
//        juntan en un solo flush de invalidaciones LIGERAS (draft + draft-board).
//     2) PARCHE QUIRÚRGICO: al draftearse un jugador, se actualiza SOLO su team_id
//        en la caché players_public (sale del pool) en vez de refetchear todo el
//        roster. players es la tabla pesada y NO está en la publicación Realtime,
//        por eso antes se refetcheaba entera; el parche evita esa petición.
const FLUSH_MS = 350

export function useDraftRealtime(draftId: string | undefined, seasonId: string | undefined) {
  const qc = useQueryClient()
  // Debounce compartido por todos los eventos del canal.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<Map<string, readonly unknown[]>>(new Map())

  useEffect(() => {
    if (!draftId || !seasonId) return

    const scheduleInvalidate = (key: readonly unknown[]) => {
      pending.current.set(JSON.stringify(key), key)
      if (timer.current) return
      timer.current = setTimeout(() => {
        timer.current = null
        const keys = [...pending.current.values()]
        pending.current.clear()
        for (const key of keys) void qc.invalidateQueries({ queryKey: key as unknown[] })
      }, FLUSH_MS)
    }

    const onPickChange = (payload: RealtimePostgresChangesPayload<DraftPick>) => {
      // Un jugador recién drafteado debe SALIR del pool. players_public no recibe
      // eventos (players no está publicada), así que parcheamos su team_id aquí.
      const row = (payload.new ?? {}) as Partial<DraftPick>
      if (row.player_id && row.team_id) {
        patchPlayerTeam(qc, seasonId, row.player_id, row.team_id)
      }
      scheduleInvalidate(['draft-board', draftId])
      scheduleInvalidate(['draft', seasonId])
    }

    const onDraftChange = (payload: RealtimePostgresChangesPayload<{ status?: string }>) => {
      scheduleInvalidate(['draft', seasonId])
      // Al reiniciar (setup) o terminar, el pool cambia en bloque: resincroniza
      // el roster completo (transición rara, no en el camino caliente del pick).
      const status = (payload.new as { status?: string } | null)?.status
      if (status === 'setup' || status === 'finished') {
        scheduleInvalidate(['players_public', seasonId])
        scheduleInvalidate(['pool-players', seasonId])
      }
    }

    const channel = supabase
      .channel(`draft:${draftId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drafts', filter: `id=eq.${draftId}` },
        onDraftChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'draft_picks', filter: `draft_id=eq.${draftId}` },
        onPickChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'draft_category_orders', filter: `draft_id=eq.${draftId}` },
        () => {
          scheduleInvalidate(['draft-category-orders', draftId])
          scheduleInvalidate(['draft', seasonId])
        },
      )
      .subscribe()

    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
      pending.current.clear()
      void supabase.removeChannel(channel)
    }
  }, [draftId, seasonId, qc])
}

// Marca a un jugador con su nuevo equipo en la caché players_public sin refetchear.
// Al fijar team_id != null, el pool (que filtra team_id === null) lo excluye.
function patchPlayerTeam(qc: QueryClient, seasonId: string, playerId: string, teamId: string) {
  qc.setQueryData<PublicPlayer[]>(['players_public', seasonId], (old) =>
    old ? old.map((p) => (p.id === playerId ? { ...p, team_id: teamId } : p)) : old,
  )
}
