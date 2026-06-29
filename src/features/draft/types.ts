// Tipos del Draft en vivo (tablas drafts/draft_teams/draft_picks de 0015).

export type DraftStatus = 'setup' | 'active' | 'paused' | 'finished'

export interface Draft {
  id: string
  season_id: string
  status: DraftStatus
  pick_seconds: number
  pick_deadline: string | null
  paused_remaining_ms: number | null
  created_at: string
  updated_at: string
}

export interface DraftTeam {
  id: string
  draft_id: string
  team_id: string
  pick_number: number
}

// Una fila del board. player_id null = slot abierto (aún sin elegir).
export interface DraftPick {
  id: string
  draft_id: string
  pick_number: number
  category_code: string
  round: number
  team_id: string
  player_id: string | null
  picked_at: string | null
  was_auto: boolean
  picked_by: string | null
}
