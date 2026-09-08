import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CategoryType } from '@/lib/types'
import type { MatchResultLite, TeamLite } from '@/features/schedule/types'
import { hasOfficialResult } from '@/features/schedule/score'

// Historial COMPLETO de juegos de un jugador para su ficha pública: cada partido
// donde aparece en una alineación PUBLICADA, con su pareja, la pareja rival y el
// resultado (si ya es oficial). Mismo criterio que useMyUpcomingMatches: la línea
// pública es la PUBLICACIÓN (lineups.locked_at, 0036), filtrada explícitamente y
// no confiada solo a la RLS — a un capitán la política "captain read own" le
// dejaría ver entradas sin publicar de su equipo.

export interface PlayerHistoryItem {
  matchId: string
  roundNumber: number
  roundDate: string | null
  categoryCode: string
  categoryType: CategoryType | null
  /** La pareja del jugador se armó con excepción a la regla (⚠️). */
  isException: boolean
  teamId: string
  opponent: TeamLite
  /** Compañero de pareja; null si el hueco quedó vacío. */
  partnerId: string | null
  /** La pareja rival publicada (0..2 ids). Vacía si el rival no publicó/llenó. */
  rivalIds: string[]
  result: MatchResultLite | null
  /** true ganó, false perdió, null sin resultado oficial todavía. */
  won: boolean | null
  /** Su equipo es el A del enfrentamiento (para leer el marcador de su lado). */
  isTeamA: boolean
}

interface RawRow {
  player_1_id: string | null
  player_2_id: string | null
  is_exception: boolean
  match: {
    id: string
    category_code: string
    category: { type: CategoryType } | null
    round: { id: string; round_number: number; round_date: string | null; season_id: string } | null
    result: MatchResultLite | null
  } | null
  lineup: {
    team_id: string
    locked_at: string | null
    matchup: {
      team_a_id: string
      team_b_id: string
      team_a: TeamLite | null
      team_b: TeamLite | null
    } | null
  } | null
}

const SELECT = `
  player_1_id, player_2_id, is_exception,
  match:matches!inner(
    id, category_code,
    category:match_categories(type),
    round:rounds!inner(id, round_number, round_date, season_id),
    result:match_results(status, is_walkover, set1_team_a, set1_team_b, set2_team_a, set2_team_b, set3_team_a, set3_team_b, winner_team_id, walkover_team_id)
  ),
  lineup:lineups!inner(
    team_id, locked_at,
    matchup:team_matchups(
      team_a_id, team_b_id,
      team_a:teams!team_a_id(id, name, color, logo_url),
      team_b:teams!team_b_id(id, name, color, logo_url)
    )
  )
`

interface RivalRow {
  match_id: string
  player_1_id: string | null
  player_2_id: string | null
  lineup: { team_id: string; locked_at: string | null } | null
}

async function fetchPlayerHistory(playerId: string, seasonId: string): Promise<PlayerHistoryItem[]> {
  const { data, error } = await supabase
    .from('lineup_entries')
    .select(SELECT)
    .or(`player_1_id.eq.${playerId},player_2_id.eq.${playerId}`)
    .eq('match.round.season_id', seasonId)
    .not('lineup.locked_at', 'is', null)
  if (error) throw error

  const rows = ((data ?? []) as unknown as RawRow[]).filter((r) => r.match && r.lineup)
  if (rows.length === 0) return []

  // Pareja rival: la entrada publicada del MISMO partido cuyo lineup es del otro
  // equipo. Un segundo fetch por match_id (una sola consulta para todo el historial).
  const matchIds = [...new Set(rows.map((r) => r.match!.id))]
  const { data: rivalData, error: rivalError } = await supabase
    .from('lineup_entries')
    .select('match_id, player_1_id, player_2_id, lineup:lineups!inner(team_id, locked_at)')
    .in('match_id', matchIds)
    .not('lineup.locked_at', 'is', null)
  if (rivalError) throw rivalError

  const entriesByMatch = new Map<string, { teamId: string; ids: string[] }[]>()
  for (const e of (rivalData ?? []) as unknown as RivalRow[]) {
    if (!e.lineup) continue
    const list = entriesByMatch.get(e.match_id) ?? []
    list.push({
      teamId: e.lineup.team_id,
      ids: [e.player_1_id, e.player_2_id].filter((x): x is string => Boolean(x)),
    })
    entriesByMatch.set(e.match_id, list)
  }

  return rows
    .map((r) => {
      const m = r.match!
      const l = r.lineup!
      const isTeamA = l.matchup?.team_a_id === l.team_id
      const opponent: TeamLite = (isTeamA ? l.matchup?.team_b : l.matchup?.team_a) ?? {
        id: '',
        name: 'Rival',
        color: null,
        logo_url: null,
      }
      const rival = (entriesByMatch.get(m.id) ?? []).find((e) => e.teamId !== l.team_id)
      const official = hasOfficialResult(m.result)
      return {
        matchId: m.id,
        roundNumber: m.round?.round_number ?? 0,
        roundDate: m.round?.round_date ?? null,
        categoryCode: m.category_code,
        categoryType: m.category?.type ?? null,
        isException: r.is_exception,
        teamId: l.team_id,
        opponent,
        partnerId: (r.player_1_id === playerId ? r.player_2_id : r.player_1_id) ?? null,
        rivalIds: rival?.ids ?? [],
        result: m.result,
        won: official && m.result!.winner_team_id ? m.result!.winner_team_id === l.team_id : null,
        isTeamA,
      }
    })
    .sort((a, b) => a.roundNumber - b.roundNumber || a.categoryCode.localeCompare(b.categoryCode))
}

export function usePlayerHistory(playerId: string | undefined, seasonId: string | undefined) {
  return useQuery({
    queryKey: ['player-history', playerId, seasonId],
    queryFn: () => fetchPlayerHistory(playerId as string, seasonId as string),
    enabled: Boolean(playerId && seasonId),
  })
}
