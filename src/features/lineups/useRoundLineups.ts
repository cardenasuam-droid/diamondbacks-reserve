import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { LineupStatus } from '@/lib/types'
import type { TeamLite } from '@/features/schedule/types'

export interface RoundLineupStatus {
  id: string
  team_id: string
  status: LineupStatus
  submitted_at: string | null
  /** No nulo = publicada (visible para todos). La fija publish_round_lineups (0036). */
  locked_at: string | null
}

export interface RoundMatchupLineups {
  id: string
  team_a: TeamLite | null
  team_b: TeamLite | null
  lineups: RoundLineupStatus[]
}

// Enfrentamientos de una jornada con el estado de alineación de cada equipo.
// Solo el organizador lee lineups de todos los equipos (RLS "organizer all").
const SELECT = `
  id,
  team_a:teams!team_a_id(id, name, color, logo_url),
  team_b:teams!team_b_id(id, name, color, logo_url),
  lineups(id, team_id, status, submitted_at, locked_at)
`

async function fetchRoundLineups(roundId: string): Promise<RoundMatchupLineups[]> {
  const { data, error } = await supabase
    .from('team_matchups')
    .select(SELECT)
    .eq('round_id', roundId)
  if (error) throw error
  return (data ?? []) as unknown as RoundMatchupLineups[]
}

export function useRoundLineups(roundId: string | undefined) {
  return useQuery({
    queryKey: ['round-lineups', roundId],
    queryFn: () => fetchRoundLineups(roundId as string),
    enabled: Boolean(roundId),
  })
}
