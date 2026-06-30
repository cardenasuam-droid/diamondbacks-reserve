import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TeamLite } from './types'

// Próximo(s) enfrentamiento(s) de un equipo, resueltos a "rival" según teamId.
// Comparte la forma de consulta de useCaptainMatchup, pero devuelve la LISTA de
// jornadas futuras (hoy o después) para el dashboard del jugador — no el panel del
// capitán. Solo rol publicado (RLS público).
export interface UpcomingMatchup {
  id: string
  round: { id: string; round_number: number; round_date: string | null }
  opponent: TeamLite
  isHome: boolean
}

interface RawRow {
  id: string
  team_a_id: string
  team_b_id: string
  round: { id: string; round_number: number; round_date: string | null; status: string; season_id: string } | null
  team_a: TeamLite | null
  team_b: TeamLite | null
}

const SELECT = `
  id, team_a_id, team_b_id,
  round:rounds!inner(id, round_number, round_date, status, season_id),
  team_a:teams!team_a_id(id, name, color, logo_url),
  team_b:teams!team_b_id(id, name, color, logo_url)
`

async function fetchTeamUpcoming(teamId: string, seasonId: string): Promise<UpcomingMatchup[]> {
  const { data, error } = await supabase
    .from('team_matchups')
    .select(SELECT)
    .eq('round.season_id', seasonId)
    .eq('round.status', 'published')
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
  if (error) throw error

  const today = new Date().toISOString().slice(0, 10)
  const rows = ((data ?? []) as unknown as RawRow[]).filter((r) => r.round)

  return rows
    .map((r) => {
      const isHome = r.team_a_id === teamId
      const opponent = (isHome ? r.team_b : r.team_a) ?? { id: '', name: 'Rival', color: null, logo_url: null }
      return { id: r.id, round: r.round!, opponent, isHome }
    })
    .filter((m) => !m.round.round_date || m.round.round_date >= today)
    .sort((a, b) => (a.round.round_number ?? 0) - (b.round.round_number ?? 0))
}

export function useTeamUpcomingMatchups(teamId: string | undefined, seasonId: string | undefined) {
  return useQuery({
    queryKey: ['team-upcoming-matchups', teamId, seasonId],
    queryFn: () => fetchTeamUpcoming(teamId as string, seasonId as string),
    enabled: Boolean(teamId && seasonId),
  })
}
