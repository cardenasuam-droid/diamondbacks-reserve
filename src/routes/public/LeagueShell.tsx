import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

// Cascarón de las páginas públicas de una liga con identidad propia (F2):
// tema por [data-league], encabezado y pestañas Inicio · Rol · Tabla. Vive
// fuera del PublicLayout de Reserve a propósito; en F4 el selector liga→
// edición absorberá esta navegación.
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
  const tabs = [
    { key: 'inicio' as const, label: 'Inicio', to: `/${slug}` },
    { key: 'rol' as const, label: 'Rol', to: `/${slug}/rol` },
    { key: 'tabla' as const, label: 'Tabla', to: `/${slug}/tabla` },
  ]

  return (
    <div data-league={slug} className="min-h-full bg-slate-50">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-12 pt-safe">
        <header className="pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">
            {leagueName}
            {seasonName ? ` · ${seasonName}` : ''}
          </p>
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
        </header>

        <main className="rise flex-1 pt-5">{children}</main>

        <footer className="pt-6 text-center text-xs text-slate-600">{leagueName}</footer>
      </div>
    </div>
  )
}
