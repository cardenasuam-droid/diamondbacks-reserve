import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TeamLite, MatchResultLite } from '@/features/schedule/types'
import type { CategoryType } from '@/lib/types'

// Reporte de resultados por la capitana (migración 0043).
//
// La capitana CAPTURA y el organizador VALIDA: el reporte queda en estado
// 'reported', que es inerte — las vistas de tabla/ranking y el motor de rating
// solo cuentan validated/walkover/corrected, así que nada se mueve hasta la
// validación. Mientras tanto el reporte es corregible (por ella, por la capitana
// rival o por el organizador al validar).

export interface CaptainMatchupMatch {
  id: string
  category_code: string
  scheduled_at: string | null
  time_block: { label: string; sort_order: number } | null
  court: { name: string } | null
  category: { name: string; type: CategoryType; sort_order: number; match_sort_order: number | null } | null
  result: MatchResultLite | null
}

export interface CaptainRoundMatchup {
  id: string
  teamA: TeamLite
  teamB: TeamLite
  /** true si el equipo de la capitana es el lado A (para resaltar su columna). */
  myTeamIsA: boolean
  matches: CaptainMatchupMatch[]
}

interface RawRow {
  id: string
  team_a_id: string
  team_b_id: string
  team_a: TeamLite | null
  team_b: TeamLite | null
  matches: CaptainMatchupMatch[]
}

const SELECT = `
  id, team_a_id, team_b_id,
  team_a:teams!team_a_id(id, name, color, logo_url),
  team_b:teams!team_b_id(id, name, color, logo_url),
  matches(
    id, category_code, scheduled_at,
    time_block:time_blocks(label, sort_order),
    court:courts(name),
    category:match_categories(name, type, sort_order, match_sort_order),
    result:match_results(status, is_walkover, set1_team_a, set1_team_b, set2_team_a, set2_team_b, set3_team_a, set3_team_b, winner_team_id)
  )
`

// El enfrentamiento del equipo en UNA jornada concreta, con resultados actuales.
// A diferencia de useCaptainMatchup (que elige "el próximo" para alineaciones),
// aquí la jornada la elige la capitana: reportar resultados mira al pasado.
async function fetchRoundMatchup(teamId: string, roundId: string): Promise<CaptainRoundMatchup | null> {
  const { data, error } = await supabase
    .from('team_matchups')
    .select(SELECT)
    .eq('round_id', roundId)
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const row = data as unknown as RawRow
  return {
    id: row.id,
    teamA: row.team_a ?? { id: row.team_a_id, name: 'Equipo A', color: null, logo_url: null },
    teamB: row.team_b ?? { id: row.team_b_id, name: 'Equipo B', color: null, logo_url: null },
    myTeamIsA: row.team_a_id === teamId,
    // Mismo orden que el rol público: match_sort_order del catálogo.
    matches: [...row.matches].sort(
      (a, b) =>
        (a.category?.match_sort_order ?? a.category?.sort_order ?? 99) -
        (b.category?.match_sort_order ?? b.category?.sort_order ?? 99),
    ),
  }
}

export function useCaptainRoundMatchup(teamId: string | undefined, roundId: string | undefined) {
  return useQuery({
    queryKey: ['captain-round-matchup', teamId, roundId],
    queryFn: () => fetchRoundMatchup(teamId as string, roundId as string),
    enabled: Boolean(teamId && roundId),
  })
}

export interface ReportResultVars {
  matchId: string
  s1a: number
  s1b: number
  s2a: number
  s2b: number
  s3a: number | null
  s3b: number | null
  /** Solo para invalidar las queries correctas. */
  teamId: string
  roundId: string
}

// El servidor re-valida todo (0043): pertenencia al enfrentamiento, marcador
// legal set a set, ganador derivado de los sets, y jamás pisar un resultado ya
// validado. Los mensajes de la RPC ya vienen en español para el usuario.
async function reportResult(vars: ReportResultVars): Promise<void> {
  const { error } = await supabase.rpc('report_match_result', {
    p_match_id: vars.matchId,
    p_s1a: vars.s1a,
    p_s1b: vars.s1b,
    p_s2a: vars.s2a,
    p_s2b: vars.s2b,
    p_s3a: vars.s3a,
    p_s3b: vars.s3b,
  })
  if (error) {
    // PostgREST reporta una función inexistente como "Could not find the function".
    throw new Error(
      /report_match_result/i.test(error.message) && /could not find|not exist|no existe/i.test(error.message)
        ? 'La captura de capitanas aún no está habilitada. Avisa al organizador.'
        : error.message,
    )
  }
}

export function useReportResult() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reportResult,
    onSuccess: (_v, vars) => {
      void qc.invalidateQueries({ queryKey: ['captain-round-matchup', vars.teamId, vars.roundId] })
      // El organizador ve el reporte en su pantalla de resultados de la jornada.
      void qc.invalidateQueries({ queryKey: ['round-matches', vars.roundId] })
      void qc.invalidateQueries({ queryKey: ['match-detail', vars.matchId] })
    },
  })
}
