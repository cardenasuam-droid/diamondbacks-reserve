import { useMemo } from 'react'
import { useTeams } from '@/features/teams/useTeams'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import type { PublicPlayer, Team } from '@/lib/types'
import { useDraft, useDraftBoard, useDraftTeams, currentOpenPick } from './queries'
import { useDraftRealtime } from './useDraftRealtime'

// Arma TODA la vista del draft de una temporada y la mantiene en vivo (Realtime).
// Reutiliza usePublicPlayers (players_public) como única fuente de nombres + pool.
export function useDraftView(seasonId: string | undefined) {
  const draftQ = useDraft(seasonId)
  const draftId = draftQ.data?.id
  const boardQ = useDraftBoard(draftId)
  const orderQ = useDraftTeams(draftId)
  const teamsQ = useTeams(seasonId)
  const playersQ = usePublicPlayers(seasonId)
  useDraftRealtime(draftId, seasonId)

  const teamsById = useMemo(
    () => new Map<string, Team>((teamsQ.data ?? []).map((t) => [t.id, t])),
    [teamsQ.data],
  )
  const playersById = useMemo(
    () => new Map<string, PublicPlayer>((playersQ.data ?? []).map((p) => [p.id, p])),
    [playersQ.data],
  )
  // Pool = jugadores activos sin equipo (free agents) de la temporada.
  const pool = useMemo(
    () => (playersQ.data ?? []).filter((p) => p.team_id === null && p.is_active),
    [playersQ.data],
  )

  const board = boardQ.data ?? []

  return {
    draft: draftQ.data ?? null,
    draftId,
    order: orderQ.data ?? [],
    teams: teamsQ.data ?? [],
    board,
    current: currentOpenPick(board),
    teamsById,
    playersById,
    pool,
    isLoading: draftQ.isLoading || teamsQ.isLoading || playersQ.isLoading,
    isError: draftQ.isError || boardQ.isError,
  }
}
