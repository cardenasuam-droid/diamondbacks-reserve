import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/features/auth/context'
import { Icon } from '@/components/ui/Icon'

// Cascarón de las páginas públicas de una liga con identidad propia (F2):
// tema por [data-league], encabezado y pestañas Inicio · Rol · Tabla. Vive
// fuera del PublicLayout de Reserve a propósito; en F4 el selector liga→
// edición absorberá esta navegación. Lleva su propia salida a Entrar/Mi
// cuenta (aquí no hay drawer) y, para el staff, al panel del organizador.
export function LeagueShell({
  slug,
  leagueName,
  seasonName,
  active,
  children,
}: {
  slug: string
  leagueName: string
  seasonName?: string
  active: 'inicio' | 'rol' | 'tabla'
  children: ReactNode
}) {
  const { session, role } = useAuth()
  const isStaff = role === 'organizer' || role === 'viewer'
  const tabs = [
    { key: 'inicio' as const, label: 'Inicio', to: `/${slug}` },
    { key: 'rol' as const, label: 'Rol', to: `/${slug}/rol` },
    { key: 'tabla' as const, label: 'Tabla', to: `/${slug}/tabla` },
  ]

  return (
    <div data-league={slug} className="min-h-full bg-slate-50">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-12 pt-safe">
        <header className="pt-8">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">
              {leagueName}
              {seasonName ? ` · ${seasonName}` : ''}
            </p>
            <span className="flex shrink-0 items-center gap-3">
              <Link
                to={session ? '/app' : '/login'}
                className="text-[11px] font-medium text-sky-300 underline"
              >
                {session ? 'Mi cuenta' : 'Entrar'}
              </Link>
              <Link to="/ligas" className="text-[11px] font-medium text-sky-300 underline">
                Cambiar de liga
              </Link>
            </span>
          </div>
          <nav className="mt-3 grid grid-cols-3 gap-2" aria-label="Secciones de la liga">
            {tabs.map((t) => (
              <Link
                key={t.key}
                to={t.to}
                aria-current={active === t.key ? 'page' : undefined}
                className={
                  active === t.key
                    ? 'neu-pressed rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-brand-300'
                    : 'neu-raised rounded-xl px-3 py-2.5 text-center text-sm font-medium text-slate-700'
                }
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {isStaff && (
            <Link
              to={`/app/organizador/liga/${slug}`}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2 text-xs font-semibold text-gold-300"
            >
              <Icon name="organizer" size={14} />
              Panel del organizador
            </Link>
          )}
        </header>

        <main className="rise flex-1 pt-5">{children}</main>

        <footer className="pt-6 text-center text-xs text-slate-600">{leagueName}</footer>
      </div>
    </div>
  )
}
