import { useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { BottomNav } from '@/components/nav/BottomNav'
import { NavDrawer } from '@/components/nav/NavDrawer'
import { Brand } from '@/components/ui/Brand'
import { DevBanner } from '@/components/dev/DevBanner'
import type { NavItem } from '@/components/nav/navItems'

// Accesos rápidos públicos en la barra inferior. El resto (Equipos, Estadísticas,
// Noticias, Reglamento, cuenta…) vive en el menú ☰.
const PRIMARY: NavItem[] = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/rol', label: 'Rol', icon: '📅' },
  { to: '/resultados', label: 'Resultados', icon: '📊' },
  { to: '/tabla', label: 'Tabla', icon: '🏆' },
]

// Layout público mobile-first: header con ☰, navegación inferior y drawer (spec §19.2).
export function PublicLayout() {
  const { session } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <DevBanner />
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              className="rounded-lg p-1.5 text-lg leading-none text-slate-600 hover:bg-slate-100"
            >
              ☰
            </button>
            <Link to="/" aria-label="Inicio">
              <Brand />
            </Link>
          </div>
          <Link
            to={session ? '/app' : '/login'}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {session ? 'Mi cuenta' : 'Entrar'}
          </Link>
        </div>
      </header>

      {/* pb extra para que el contenido no quede tapado por la nav inferior */}
      <main className="mx-auto max-w-3xl px-4 py-6 pb-24">
        <Outlet />
      </main>

      <BottomNav items={PRIMARY} onMenu={() => setMenuOpen(true)} />
      <NavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
