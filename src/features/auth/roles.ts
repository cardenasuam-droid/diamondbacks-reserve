import type { UserRole } from '@/lib/types'

// Etiquetas de rol en español para la UI.
export const ROLE_LABELS: Record<UserRole, string> = {
  player: 'Jugador',
  captain: 'Capitán',
  organizer: 'Organizador',
  web_manager: 'Gestor web',
}

export function roleLabel(role: UserRole | null): string {
  return role ? ROLE_LABELS[role] : '—'
}
