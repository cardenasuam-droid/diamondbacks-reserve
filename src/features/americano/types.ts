// Tipos del módulo americano (tablas 0051). Reflejan el esquema SQL.
// Round se reutiliza de features/schedule (las jornadas son compartidas).

import type { IndPhase } from './standings'

export type { IndPhase }
export type MatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'walkover'

export interface IndMatchPlayer {
  match_id: string
  player_id: string
  side: 1 | 2
  slot: 1 | 2
}

export interface IndMatchResult {
  id: string
  match_id: string
  status: 'pending_report' | 'reported' | 'validated' | 'disputed' | 'walkover' | 'corrected'
  set1_side1: number | null
  set1_side2: number | null
  set2_side1: number | null
  set2_side2: number | null
  set3_side1: number | null
  set3_side2: number | null
  winner_side: 1 | 2 | null
  is_walkover: boolean
  walkover_side: 1 | 2 | null
  notes: string | null
  validated_at: string | null
}

export interface IndMatch {
  id: string
  season_id: string
  round_id: string
  category_code: string
  court_id: string | null
  time_block_id: string | null
  scheduled_at: string | null
  phase: IndPhase
  status: MatchStatus
  players: IndMatchPlayer[]
  result: IndMatchResult | null
}

export interface IndPenalty {
  id: string
  season_id: string
  player_id: string
  points: number
  reason: string
  created_at: string
}

// Fila de la vista ind_standings (derivada; jamás se almacena).
export interface IndStandingsRow {
  player_id: string
  season_id: string
  full_name: string
  category_code: string
  photo_url: string | null
  played: number
  won: number
  lost: number
  match_diff: number
  points_raw: number
  penalty_points: number
  points: number
  sets_won: number
  sets_lost: number
  set_diff: number
  games_won: number
  games_lost: number
  game_diff: number
}

export interface Court {
  id: string
  name: string
  number: number
  is_active: boolean
}
