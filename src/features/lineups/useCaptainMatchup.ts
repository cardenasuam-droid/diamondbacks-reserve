import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TeamLite } from '@/features/schedule/types'
import type { CaptainMatchup, MatchupMatch } from './types'

// Forma cruda que devuelve PostgREST antes de resolver "mi equipo" vs "rival".
interface RawMatchup {
  id: string
  team_a_id: string
  team_b_id: string
  round: {
    id: string
    round_number: number
    name: string | null
    round_date: string | null
    status: string
  } | null
  team_a: TeamLite | null
  team_b: TeamLite | null
  matches: MatchupMatch[]
}

const SELECT = `
  id, team_a_id, team_b_id,
  round:rounds!inner(id, round_number, name, round_date, status, season_id),
  team_a:teams!team_a_id(id, name, color),
  team_b:teams!team_b_id(id, name, color),
  matches(
    id, category_code, scheduled_at,
    time_block:time_blocks(label, sort_order),
    court:courts(name, number)
  )
`

// Devuelve el PRÓXIMO enfrentamiento publicado del equipo: el primero cuya fecha
// es hoy o futura; si todos ya pasaron, el más reciente. Resuelve los lados a
// myTeam / opponent según teamId.
async function fetchCaptainMatchup(
  teamId: string,
  seasonId: string,
): Promise<CaptainMatchup | null> {
  const { data, error } = await supabase
    .from('team_matchups')
    .select(SELECT)
    .eq('round.season_id', seasonId)
    .eq('round.status', 'published')
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
  if (error) throw error

  const rows = ((data ?? []) as unknown as RawMatchup[]).filter((r) => r.round)
  if (rows.length === 0) return null

  rows.sort((a, b) => (a.round!.round_number ?? 0) - (b.round!.round_number ?? 0))
  const today = new Date().toISOString().slice(0, 10)
  const chosen =
    rows.find((r) => !r.round!.round_date || r.round!.round_date >= today) ??
    rows[rows.length - 1]

  const isA = chosen.team_a_id === teamId
  const myTeam = (isA ? chosen.team_a : chosen.team_b) ?? { id: teamId, name: 'Mi equipo', color: null }
  const opponent = (isA ? chosen.team_b : chosen.team_a) ?? { id: '', name: 'Rival', color: null }

  return {
    id: chosen.id,
    round: chosen.round!,
    myTeam,
    opponent,
    matches: [...chosen.matches].sort(
      (a, b) => (a.time_block?.sort_order ?? 0) - (b.time_block?.sort_order ?? 0),
    ),
  }
}

export function useCaptainMatchup(teamId: string | undefined, seasonId: string | undefined) {
  return useQuery({
    queryKey: ['captain-matchup', teamId, seasonId],
    queryFn: () => fetchCaptainMatchup(teamId as string, seasonId as string),
    enabled: Boolean(teamId && seasonId),
  })
}
