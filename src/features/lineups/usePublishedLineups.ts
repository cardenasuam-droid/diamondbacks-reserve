import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Alineaciones YA PUBLICADAS de una jornada, para mostrarlas en el rol PÚBLICO.
// La RLS (0036) deja que cualquiera (anon incluido) lea solo las publicadas
// (lineups.locked_at no nulo) y sus entradas.

export interface PublishedPair {
  player_1_id: string | null
  player_2_id: string | null
}

// Clave de una pareja publicada: enfrentamiento + equipo + categoría.
export type PublishedLineups = Map<string, PublishedPair>

export function publishedKey(matchupId: string, teamId: string, categoryCode: string): string {
  return `${matchupId}|${teamId}|${categoryCode}`
}

async function fetchPublishedLineups(roundId: string): Promise<PublishedLineups> {
  const { data: mus, error: e1 } = await supabase
    .from('team_matchups')
    .select('id')
    .eq('round_id', roundId)
  if (e1) throw e1
  const ids = (mus ?? []).map((m) => m.id as string)
  const map: PublishedLineups = new Map()
  if (ids.length === 0) return map

  const { data, error } = await supabase
    .from('lineups')
    .select('team_matchup_id, team_id, lineup_entries(category_code, player_1_id, player_2_id)')
    .in('team_matchup_id', ids)
    .not('locked_at', 'is', null)
  if (error) throw error

  for (const l of (data ?? []) as {
    team_matchup_id: string
    team_id: string
    lineup_entries: { category_code: string; player_1_id: string | null; player_2_id: string | null }[] | null
  }[]) {
    for (const e of l.lineup_entries ?? []) {
      map.set(publishedKey(l.team_matchup_id, l.team_id, e.category_code), {
        player_1_id: e.player_1_id,
        player_2_id: e.player_2_id,
      })
    }
  }
  return map
}

export function usePublishedLineups(roundId: string | undefined) {
  return useQuery({
    queryKey: ['published-lineups', roundId],
    queryFn: () => fetchPublishedLineups(roundId as string),
    enabled: Boolean(roundId),
  })
}
