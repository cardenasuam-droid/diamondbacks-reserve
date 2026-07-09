// Tipos del Draft en vivo (tablas drafts/draft_teams/draft_picks de 0015).

export type DraftStatus = 'setup' | 'active' | 'paused' | 'finished'

export interface Draft {
  id: string
  season_id: string
  status: DraftStatus
  pick_seconds: number
  pick_deadline: string | null
  paused_remaining_ms: number | null
  /** Categoría en sorteo o en juego (0028). null en setup/finished. */
  current_category_code: string | null
  /** true = fase de sorteo de orden de la categoría actual (aún sin picks). */
  is_drawing: boolean
  created_at: string
  updated_at: string
}

// Orden sorteado de una categoría (tabla draft_category_orders, 0028). Es la base
// de la animación del sorteo, autoritativa del servidor (todos ven lo mismo).
export interface DraftCategoryOrder {
  id: string
  draft_id: string
  category_code: string
  team_id: string
  position: number
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
  /** "No pick" de capitana (0028): slot que el motor salta; nunca se llena. */
  is_skip: boolean
}
