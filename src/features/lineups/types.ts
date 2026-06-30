import type { LineupStatus } from '@/lib/types'
import type { TeamLite } from '@/features/schedule/types'

// Un partido del enfrentamiento (uno por categoría), con cancha y horario.
export interface MatchupMatch {
  id: string
  category_code: string
  scheduled_at: string | null
  time_block: { label: string; sort_order: number } | null
  court: { name: string; number: number } | null
}

// El enfrentamiento del capitán ya resuelto a "mi equipo" vs "rival".
export interface CaptainMatchup {
  id: string
  round: {
    id: string
    round_number: number
    name: string | null
    round_date: string | null
    status: string
  }
  myTeam: TeamLite
  opponent: TeamLite
  matches: MatchupMatch[]
}

// Jugador del roster del capitán (datos completos: incluye teléfono privado).
export interface TeamPlayer {
  id: string
  full_name: string
  gender: 'male' | 'female'
  category_code: string
  team_id: string
  is_captain: boolean
  phone: string | null
  photo_url: string | null
}

export interface StoredEntry {
  id: string
  match_id: string
  category_code: string
  player_1_id: string | null
  player_2_id: string | null
}

export interface StoredLineup {
  id: string
  status: LineupStatus
  submitted_at: string | null
  change_count_used: number
  entries: StoredEntry[]
}
