// Tipos del módulo de inscripción pública (tabla player_registrations, 0014).

import type { ShirtSize } from '@/lib/shirtSize'

export type PlayerPosition = 'drive' | 'reves' | 'ambas'
export type RegistrationStatus = 'pending' | 'approved' | 'rejected'

export interface PlayerRegistration {
  id: string
  season_id: string | null
  full_name: string
  phone: string
  requested_category_code: string
  position: PlayerPosition
  shirt_size: ShirtSize | null
  comment: string | null
  status: RegistrationStatus
  created_player_id: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
}
