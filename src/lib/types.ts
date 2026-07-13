// Tipos compartidos del dominio. Reflejan el esquema SQL (identificadores en
// inglés). Se ampliarán por feature según se necesiten.

// 'viewer' = administrador de SOLO LECTURA: ve los paneles de organización y
// contenido, pero la RLS le niega toda escritura (migraciones 0019/0020).
export type UserRole = 'player' | 'captain' | 'organizer' | 'web_manager' | 'viewer'

export type SeasonStatus = 'draft' | 'active' | 'finished'

export interface Season {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  status: SeasonStatus
  created_at: string
  updated_at: string
}

export type Gender = 'male' | 'female'
export type CategoryType = 'varonil' | 'femenil' | 'mixta'

export type LineupStatus =
  | 'draft'
  | 'submitted'
  | 'modified'
  | 'locked'
  | 'validated'
  | 'admin_edited'

export interface MatchCategory {
  code: string
  name: string
  type: CategoryType
  sort_order: number
  is_active: boolean
  // Formato "Suma" (0029): se separa lo que un jugador ES (ranking) de lo que se
  // PROGRAMA/juega (match). Una categoría puede ser una, otra o ambas.
  is_ranking: boolean // un jugador puede tener esta categoría (VAR_4, FEM_3…)
  is_match: boolean // se programa y juega (SUMA9_VAR, VAR_5, MIX_A…)
  match_sort_order: number | null // orden de despliegue entre las de partido
}

export interface Team {
  id: string
  season_id: string
  name: string
  color: string | null
  logo_url: string | null
  slogan: string | null
  created_at: string
  updated_at: string
}

// Lado de juego declarado por el jugador. Vive en players (0026) y, por no ser
// dato sensible, se expone en players_public.
export type PlayerPosition = 'drive' | 'reves' | 'ambas'

// Vista players_public: SIN teléfono ni correo (privacidad por RLS).
export interface PublicPlayer {
  id: string
  season_id: string
  team_id: string
  full_name: string
  gender: Gender
  category_code: string
  is_captain: boolean
  is_active: boolean
  photo_url: string | null
  is_waitlisted: boolean
  position: PlayerPosition | null
}

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: UserRole
  player_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
