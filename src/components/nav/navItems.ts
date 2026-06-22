import type { UserRole } from '@/lib/types'

// Quién puede ver un item/grupo:
//   public    -> todos
//   session   -> con sesión iniciada
//   captain   -> capitán u organizador
//   organizer -> solo organizador
export type NavGate = 'public' | 'session' | 'captain' | 'organizer' | 'content'

export interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
  requires?: NavGate
  /** Si está, el item se muestra inerte con esta etiqueta (p. ej. "Próximamente"). */
  soon?: boolean
}

export interface NavGroup {
  title: string
  requires?: NavGate
  items: NavItem[]
}

export function navAllows(
  gate: NavGate | undefined,
  role: UserRole | null,
  hasSession: boolean,
): boolean {
  switch (gate) {
    case undefined:
    case 'public':
      return true
    case 'session':
      return hasSession
    case 'captain':
      return role === 'captain' || role === 'organizer'
    case 'organizer':
      return role === 'organizer'
    case 'content':
      return role === 'organizer' || role === 'web_manager'
  }
}

// Toda la navegación de la app, agrupada. El drawer la pinta filtrando por rol.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Liga',
    items: [
      { to: '/', label: 'Inicio', icon: '🏠', end: true },
      { to: '/rol', label: 'Rol de juegos', icon: '📅' },
      { to: '/resultados', label: 'Resultados', icon: '📊' },
      { to: '/tabla', label: 'Tabla de posiciones', icon: '🏆' },
      { to: '/equipos', label: 'Equipos y rosters', icon: '👥' },
      { to: '/estadisticas', label: 'Estadísticas', icon: '📈' },
      { to: '/noticias', label: 'Noticias', icon: '📰' },
      { to: '/reglamento', label: 'Reglamento', icon: '📄' },
    ],
  },
  {
    title: 'Mi cuenta',
    requires: 'session',
    items: [
      { to: '/app', label: 'Mi cuenta', icon: '🧑', end: true, requires: 'session' },
      { to: '/app/avisos', label: 'Avisos', icon: '🔔', requires: 'session' },
    ],
  },
  {
    title: 'Capitán',
    requires: 'captain',
    items: [
      { to: '/app/capitan', label: 'Panel de capitán', icon: '📋', end: true, requires: 'captain' },
      { to: '/app/capitan/alineacion', label: 'Armar alineación', icon: '🎾', requires: 'captain' },
    ],
  },
  {
    title: 'Organización',
    requires: 'organizer',
    items: [
      { to: '/app/organizador', label: 'Panel organizador', icon: '🛠️', end: true, requires: 'organizer' },
      { to: '/app/organizador/alineaciones', label: 'Estado de alineaciones', icon: '✅', requires: 'organizer' },
      { to: '/app/organizador/resultados', label: 'Resultados', icon: '📝', requires: 'organizer' },
      { to: '/app/organizador/equipos', label: 'Equipos y jugadores', icon: '👥', requires: 'organizer' },
      { to: '/app/organizador/importar', label: 'Importar CSV', icon: '📥', requires: 'organizer' },
    ],
  },
  {
    title: 'Contenido',
    requires: 'content',
    items: [
      { to: '/app/contenido', label: 'Noticias', icon: '📰', end: true, requires: 'content' },
      { to: '/app/contenido/reglamento', label: 'Reglamento', icon: '📄', requires: 'content' },
      { to: '/app/contenido/avisos', label: 'Avisos', icon: '📣', requires: 'content' },
    ],
  },
]
