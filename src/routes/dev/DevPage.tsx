import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { roleLabel } from '@/features/auth/roles'
import { getDevRole, setDevRole } from '@/features/auth/devRole'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import type { UserRole } from '@/lib/types'

interface ScreenGroup {
  title: string
  note?: string
  items: { to: string; label: string }[]
}

const SCREENS: ScreenGroup[] = [
  {
    title: 'Público (sin sesión)',
    items: [
      { to: '/inicio', label: 'Inicio' },
      { to: '/rol', label: 'Rol de juegos' },
      { to: '/resultados', label: 'Resultados' },
      { to: '/tabla', label: 'Tabla de posiciones' },
      { to: '/equipos', label: 'Equipos' },
      { to: '/estadisticas', label: 'Estadísticas' },
      { to: '/noticias', label: 'Noticias' },
      { to: '/reglamento', label: 'Reglamento' },
      { to: '/mas', label: 'Más' },
      { to: '/login', label: 'Acceso / Login' },
    ],
  },
  {
    title: 'Mi cuenta (requiere sesión)',
    items: [
      { to: '/app', label: 'Mi cuenta' },
      { to: '/app/avisos', label: 'Avisos' },
    ],
  },
  {
    title: 'Capitán (rol capitán u organizador)',
    items: [
      { to: '/app/capitan', label: 'Panel de capitán' },
      { to: '/app/capitan/alineacion', label: 'Armar alineación' },
    ],
  },
  {
    title: 'Organizador (rol organizador)',
    items: [
      { to: '/app/organizador', label: 'Panel organizador' },
      { to: '/app/organizador/equipos', label: 'Equipos y jugadores' },
      { to: '/app/organizador/importar', label: 'Importar CSV' },
      { to: '/app/organizador/alineaciones', label: 'Estado de alineaciones' },
      { to: '/app/organizador/resultados', label: 'Resultados (capturar/validar)' },
    ],
  },
  {
    title: 'Contenido (organizador o web manager)',
    items: [
      { to: '/app/contenido', label: 'Noticias (gestión)' },
      { to: '/app/contenido/reglamento', label: 'Reglamento (gestión)' },
      { to: '/app/contenido/avisos', label: 'Avisos (envío)' },
    ],
  },
]

const ROLES: UserRole[] = ['player', 'captain', 'organizer', 'web_manager']

export function DevPage() {
  const { session, role, profile } = useAuth()
  const active = getDevRole()

  return (
    <div className="space-y-6">
      <PageHeader title="Consola dev" subtitle="Previsualiza pantallas y roles" />

      <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-800">Ver la app como…</p>
        <p className="text-xs text-slate-500">
          Cambia el rol <strong>solo en la interfaz</strong> para previsualizar. Los datos
          siguen protegidos por permisos (RLS): un rol que no te corresponde verá las
          pantallas vacías, no datos ajenos. Necesitas haber iniciado sesión.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDevRole(null)}
            className={
              'rounded-lg border px-3 py-1.5 text-sm font-medium ' +
              (!active
                ? 'border-brand-600 bg-brand-500/10 text-brand-300'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100')
            }
          >
            Real{profile?.role ? ` (${roleLabel(profile.role)})` : ''}
          </button>
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setDevRole(r)}
              className={
                'rounded-lg border px-3 py-1.5 text-sm font-medium ' +
                (active === r
                  ? 'border-brand-600 bg-brand-500/10 text-brand-300'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100')
              }
            >
              {roleLabel(r)}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Sesión: {session ? 'iniciada' : 'no iniciada'} · Rol efectivo:{' '}
          <Badge color={role ? 'emerald' : 'slate'}>{role ? roleLabel(role) : '—'}</Badge>
        </p>
      </section>

      {SCREENS.map((g) => (
        <section key={g.title}>
          <h2 className="mb-2 text-sm font-semibold text-slate-500">{g.title}</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {g.items.map((it) => (
              <li key={it.to}>
                <Link
                  to={it.to}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800 shadow-sm hover:border-brand-300"
                >
                  <span>{it.label}</span>
                  <span className="font-mono text-xs text-slate-400">{it.to}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-xs text-slate-500">
        Pantallas con parámetro (un equipo, una noticia) se abren desde sus listados
        (Equipos, Noticias). Esta consola es una ayuda de desarrollo; no afecta a la
        seguridad.
      </p>
    </div>
  )
}
