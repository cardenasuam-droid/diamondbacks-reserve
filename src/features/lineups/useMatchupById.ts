import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TeamLite } from '@/features/schedule/types'
import type { CaptainMatchup, MatchupMatch } from './types'

// Un enfrentamiento CONCRETO (por id), resuelto a "mi equipo" vs "rival" según el
// teamId indicado. Es la variante para el ORGANIZADOR del editor de alineaciones:
// useCaptainMatchup elige "el próximo del capitán"; aquí el organizador abre un
// enfrentamiento y un equipo específicos (para corregir un rol ya publicado, por
// ejemplo). La RLS "organizer all" le deja leer cualquier alineación; el resto
// del editor (roster, save_lineup con p_team_id) ya soporta cualquier equipo.
interface RawMatchup {
  id: string
  team_a_id: string
  team_b_id: string
  round: { id: string; round_number: number; name: string | null; round_date: string | null; status: string; season_id: string } | null
  team_a: TeamLite | null
  team_b: TeamLite | null
  matches: MatchupMatch[]
}

const SELECT = `
  id, team_a_id, team_b_id,
  round:rounds!inner(id, round_number, name, round_date, status, season_id),
  team_a:teams!team_a_id(id, name, color, logo_url),
  team_b:teams!team_b_id(id, name, color, logo_url),
  matches(
    id, category_code, scheduled_at,
    time_block:time_blocks(label, sort_order),
    court:courts(name, number)
  )
`

/** El season_id viaja en el round; el editor lo necesita para el conteo de cambios. */
export interface MatchupWithSeason extends CaptainMatchup {
  seasonId: string
}

async function fetchMatchupById(teamMatchupId: string, teamId: string): Promise<MatchupWithSeason | null> {
  const { data, error } = await supabase.from('team_matchups').select(SELECT).eq('id', teamMatchupId).maybeSingle()
  if (error) throw error
  if (!data) return null

  const row = data as unknown as RawMatchup
  if (!row.round) return null
  const isA = row.team_a_id === teamId
  const myTeam = (isA ? row.team_a : row.team_b) ?? { id: teamId, name: 'Equipo', color: null, logo_url: null }
  const opponent = (isA ? row.team_b : row.team_a) ?? { id: '', name: 'Rival', color: null, logo_url: null }

  return {
    id: row.id,
    round: row.round,
    myTeam,
    opponent,
    seasonId: row.round.season_id,
    matches: [...row.matches].sort(
      (a, b) => (a.time_block?.sort_order ?? 0) - (b.time_block?.sort_order ?? 0),
    ),
  }
}

export function useMatchupById(
  teamMatchupId: string | undefined,
  teamId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ['matchup-by-id', teamMatchupId, teamId],
    queryFn: () => fetchMatchupById(teamMatchupId as string, teamId as string),
    enabled: enabled && Boolean(teamMatchupId && teamId),
  })
}
