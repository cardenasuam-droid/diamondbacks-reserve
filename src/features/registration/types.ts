// Tipos del módulo de inscripción pública (tabla player_registrations, 0014).

import type { ShirtSize } from '@/lib/shirtSize'
import type { PlayerPosition } from '@/lib/types'

// El tipo vive en lib/types (players lo tiene como columna desde 0026); se
// reexporta aquí para no romper los imports existentes del módulo de inscripción.
export type { PlayerPosition }
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
  // Inscripción v2 (0050): campos del formato americano + comprobante de pago.
  birthdate: string | null
  blocked_time_labels: string[] | null
  receipt_path: string | null
  payment_verified_at: string | null
  payment_verified_by: string | null
  created_at: string
  updated_at: string
}
