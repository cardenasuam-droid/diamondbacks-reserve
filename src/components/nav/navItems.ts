import type { UserRole } from '@/lib/types'
import type { IconName } from '@/components/ui/Icon'

// Quién puede ver un item/grupo:
//   public    -> todos
//   session   -> con sesión iniciada
//   captain   -> capitán u organizador
//   organizer -> solo organizador
//   content   -> organizador o gestor web
//   dev       -> usuarios con acceso a la consola /dev (Bruja u organizador)
export type NavGate = 'public' | 'session' | 'captain' | 'organizer' | 'content' | 'dev'

export interface NavItem {
  to: string
  label: string
  icon: IconName
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
  isDev = false,
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
    case 'dev':
      return isDev
  }
}

// Toda la navegación de la app, agrupada. El drawer la pinta filtrando por rol.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Liga',
    items: [
      { to: '/', label: 'Inicio', icon: 'home', end: true },
      { to: '/rol', label: 'Rol de juegos', icon: 'schedule' },
      { to: '/resultados', label: 'Resultados', icon: 'results' },
      { to: '/tabla', label: 'Tabla de posiciones', icon: 'standings' },
      { to: '/equipos', label: 'Equipos y rosters', icon: 'teams' },
      { to: '/draft', label: 'Draft en vivo', icon: 'medal' },
      { to: '/estadisticas', label: 'Estadísticas', icon: 'stats' },
      { to: '/noticias', label: 'Noticias', icon: 'news' },
      { to: '/reglamento', label: 'Reglamento', icon: 'rules' },
    ],
  },
  {
    title: 'Mi cuenta',
    requires: 'session',
    items: [
      { to: '/app', label: 'Mi cuenta', icon: 'account', end: true, requires: 'session' },
      { to: '/app/avisos', label: 'Avisos', icon: 'bell', requires: 'session' },
    ],
  },
  {
    title: 'Capitán',
    requires: 'captain',
    items: [
      { to: '/app/capitan', label: 'Panel de capitán', icon: 'captain', end: true, requires: 'captain' },
      { to: '/app/capitan/alineacion', label: 'Armar alineación', icon: 'lineup', requires: 'captain' },
    ],
  },
  {
    title: 'Organización',
    requires: 'organizer',
    items: [
      { to: '/app/organizador', label: 'Panel organizador', icon: 'organizer', end: true, requires: 'organizer' },
      { to: '/app/organizador/inscripciones', label: 'Inscripciones', icon: 'account', requires: 'organizer' },
      { to: '/app/organizador/pool', label: 'Pool de jugadores', icon: 'teams', requires: 'organizer' },
      { to: '/app/organizador/draft', label: 'Draft', icon: 'medal', requires: 'organizer' },
      { to: '/app/organizador/alineaciones', label: 'Estado de alineaciones', icon: 'lineups-status', requires: 'organizer' },
      { to: '/app/organizador/resultados', label: 'Resultados', icon: 'results-edit', requires: 'organizer' },
      { to: '/app/organizador/equipos', label: 'Equipos y jugadores', icon: 'teams', requires: 'organizer' },
      { to: '/app/organizador/importar', label: 'Importar CSV', icon: 'import', requires: 'organizer' },
    ],
  },
  {
    title: 'Contenido',
    requires: 'content',
    items: [
      { to: '/app/contenido', label: 'Noticias', icon: 'news', end: true, requires: 'content' },
      { to: '/app/contenido/reglamento', label: 'Reglamento', icon: 'rules', requires: 'content' },
      { to: '/app/contenido/avisos', label: 'Avisos', icon: 'announce', requires: 'content' },
    ],
  },
  {
    title: 'Desarrollo',
    requires: 'dev',
    items: [{ to: '/dev', label: 'Consola dev', icon: 'dev', requires: 'dev' }],
  },
]
