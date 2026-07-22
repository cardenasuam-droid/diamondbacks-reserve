import type { CategoryType } from '@/lib/types'

export interface TeamLite {
  id: string
  name: string
  color: string | null
  logo_url: string | null
}

export interface MatchResultLite {
  status: string
  is_walkover: boolean
  set1_team_a: number | null
  set1_team_b: number | null
  set2_team_a: number | null
  set2_team_b: number | null
  set3_team_a: number | null
  set3_team_b: number | null
  winner_team_id: string | null
  /** Equipo que NO se presentó. Imprescindible para reabrir un walkover ya
      guardado sin que el organizador tenga que recordar de memoria quién faltó
      (elegir mal invierte 3 puntos, sets, juegos y el rating, en silencio). */
  walkover_team_id: string | null
}

// Partido con todo lo embebido por PostgREST para rol y resultados.
export interface ScheduledMatch {
  id: string
  scheduled_at: string | null
  status: string
  category_code: string
  time_block: { label: string; sort_order: number } | null
  court: { name: string; number: number } | null
  category: { name: string; type: CategoryType; sort_order: number; match_sort_order: number | null } | null
  matchup: { id: string; team_a: TeamLite | null; team_b: TeamLite | null } | null
  result: MatchResultLite | null
}

export interface Round {
  id: string
  season_id: string
  round_number: number
  name: string | null
  round_date: string | null
  status: string
}
