import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ScheduledMatch } from './types'

// Un partido con TODO lo que muestra su pantalla de detalle (/partidos/:id):
// jornada, enfrentamiento (ambos equipos), categoría, cancha, horario y
// resultado. Mismo shape que useRoundMatches + la jornada embebida; round_id
// permite reusar la caché de alineaciones publicadas de la jornada.
export interface MatchDetail extends ScheduledMatch {
  round_id: string
  round: { id: string; round_number: number; name: string | null; round_date: string | null } | null
}

const SELECT = `
  id, round_id, scheduled_at, status, category_code,
  round:rounds(id, round_number, name, round_date),
  time_block:time_blocks(label, sort_order),
  court:courts(name, number),
  category:match_categories(name, type, sort_order, match_sort_order),
  matchup:team_matchups(
    id,
    team_a:teams!team_a_id(id, name, color, logo_url),
    team_b:teams!team_b_id(id, name, color, logo_url)
  ),
  result:match_results(status, set1_team_a, set1_team_b, set2_team_a, set2_team_b, set3_team_a, set3_team_b, winner_team_id, is_walkover, walkover_team_id)
`

async function fetchMatchDetail(matchId: string): Promise<MatchDetail | null> {
  const { data, error } = await supabase.from('matches').select(SELECT).eq('id', matchId).maybeSingle()
  if (error) {
    // 22P02 = id malformado (link compartido truncado): es "no encontrado", no un
    // error a reintentar (el retry jamás tendría éxito).
    if (error.code === '22P02') return null
    throw error
  }
  return (data as unknown as MatchDetail | null) ?? null
}

export function useMatchDetail(matchId: string | undefined) {
  return useQuery({
    queryKey: ['match-detail', matchId],
    queryFn: () => fetchMatchDetail(matchId as string),
    enabled: Boolean(matchId),
  })
}
