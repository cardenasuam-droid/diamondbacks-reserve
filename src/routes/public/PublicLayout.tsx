import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { NavDrawer } from '@/components/nav/NavDrawer'
import { Brand } from '@/components/ui/Brand'
import { Icon } from '@/components/ui/Icon'
import { DevBanner } from '@/components/dev/DevBanner'

// Layout público mobile-first: header con ☰ que abre el drawer. Toda la
// navegación vive en el drawer (sin barra inferior).
export function PublicLayout() {
  const { session } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <DevBanner />
      <header className="glass sticky top-0 z-10 border-b border-white/10 bg-slate-100/55 pt-safe">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              className="-ml-1.5 flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-white/10"
            >
              <Icon name="menu" size={22} />
            </button>
            <Link to="/inicio" aria-label="Inicio">
              <Brand />
            </Link>
          </div>
          <Link
            to={session ? '/app' : '/login'}
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-white/10"
          >
            {session ? 'Mi cuenta' : 'Entrar'}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-12">
        <div key={location.pathname} className="rise">
          <Outlet />
        </div>
      </main>

      <NavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
