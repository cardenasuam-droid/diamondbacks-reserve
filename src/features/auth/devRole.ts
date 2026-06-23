import type { UserRole } from '@/lib/types'

// "Vista de desarrollador": fuerza el rol EN LA INTERFAZ para previsualizar
// pantallas sin crear varias cuentas. NO afecta la seguridad: los datos siguen
// gobernados por RLS en el servidor según la sesión real.
const KEY = 'dev:role'
export const DEV_ROLE_EVENT = 'dev-role-change'

const VALID: UserRole[] = ['player', 'captain', 'organizer', 'web_manager']

export function getDevRole(): UserRole | null {
  try {
    const v = localStorage.getItem(KEY) as UserRole | null
    return v && VALID.includes(v) ? v : null
  } catch {
    return null
  }
}

export function setDevRole(role: UserRole | null): void {
  try {
    if (role) localStorage.setItem(KEY, role)
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(DEV_ROLE_EVENT))
}

// Usuarios con acceso a la consola /dev (el conmutador de pantallas) aunque su
// rol real sea otro. Permite a "Bruja" previsualizar toda la app sin tener una
// cuenta de organizador. No afecta a la seguridad: los datos siguen bajo RLS.
const DEV_USER_NAMES = ['bruja']

export function isDevUser(fullName: string | null | undefined): boolean {
  return Boolean(fullName && DEV_USER_NAMES.includes(fullName.trim().toLowerCase()))
}
