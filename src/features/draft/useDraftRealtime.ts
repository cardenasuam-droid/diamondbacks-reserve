import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PublicPlayer } from '@/lib/types'
import type { DraftPick } from './types'

// Realtime del draft por BROADCAST desde la BD (migración 0033), en vez de
// postgres_changes. Motivo: postgres_changes reevalúa RLS por conexión y no
// escala con espectadores; broadcast emite un mensaje por evento a un topic y
// Realtime lo reparte. Requiere que 0033 esté aplicada (trigger + policy de
// recepción para anon). Desplegar cliente y migración JUNTOS.
//
// Estrategia de caché (idéntica a la versión anterior, para no refetchear de más):
//  · PARCHE QUIRÚRGICO del team_id del jugador drafteado en players_public (sale
//    del pool) — evita refetchear el roster completo en cada pick.
//  · invalidaciones LIGERAS con debounce (draft + draft-board).
//  · RED DE SEGURIDAD: un refetch ligero cada SAFETY_MS por si un cliente perdió
//    algún mensaje (o si la entrega a anon fallara en algún dispositivo), para que
//    igual se ponga al día sin depender al 100% del broadcast.
const FLUSH_MS = 350
const SAFETY_MS = 20_000

interface DraftBroadcast {
  op: 'INSERT' | 'UPDATE' | 'DELETE'
  table: 'drafts' | 'draft_picks' | 'draft_category_orders'
  record: (Partial<DraftPick> & { status?: string }) | null
  old: Partial<DraftPick> | null
}

export function useDraftRealtime(draftId: string | undefined, seasonId: string | undefined) {
  const qc = useQueryClient()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<Map<string, readonly unknown[]>>(new Map())

  useEffect(() => {
    if (!draftId || !seasonId) return
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

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

    const handle = (b: DraftBroadcast) => {
      if (b.table === 'draft_picks') {
        const row = b.record ?? {}
        // Un jugador recién drafteado debe SALIR del pool. players_public no
        // recibe broadcasts (players no está en el trigger), así que parcheamos
        // su team_id aquí en vez de refetchear todo el roster.
        if (row.player_id && row.team_id) patchPlayerTeam(qc, seasonId, row.player_id, row.team_id)
        scheduleInvalidate(['draft-board', draftId])
        scheduleInvalidate(['draft', seasonId])
      } else if (b.table === 'drafts') {
        scheduleInvalidate(['draft', seasonId])
        // Reinicio (setup) o fin: el pool cambia en bloque; resincroniza el roster
        // (transición rara, fuera del camino caliente del pick).
        const status = b.record?.status
        if (status === 'setup' || status === 'finished') {
          scheduleInvalidate(['players_public', seasonId])
          scheduleInvalidate(['pool-players', seasonId])
        }
      } else {
        scheduleInvalidate(['draft-category-orders', draftId])
        scheduleInvalidate(['draft', seasonId])
      }
    }

    // Adjunta el token actual (sesión de capitana/organizador, o anon del
    // espectador) a la conexión Realtime para la autorización RLS del canal
    // privado, y recién entonces suscribe.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      void supabase.realtime.setAuth(data.session?.access_token ?? null)
      channel = supabase
        .channel(`draft:${draftId}`, { config: { private: true } })
        .on('broadcast', { event: 'draft_change' }, (msg) => handle(msg.payload as DraftBroadcast))
        .subscribe()
    })

    // Red de seguridad: refetch ligero periódico (cubre mensajes perdidos).
    const safety = setInterval(() => {
      void qc.invalidateQueries({ queryKey: ['draft', seasonId] })
      void qc.invalidateQueries({ queryKey: ['draft-board', draftId] })
    }, SAFETY_MS)

    return () => {
      cancelled = true
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
      pending.current.clear()
      clearInterval(safety)
      if (channel) void supabase.removeChannel(channel)
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
