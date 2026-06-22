import { useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { roleLabel } from '@/features/auth/roles'
import { BottomNav } from '@/components/nav/BottomNav'
import { NavDrawer } from '@/components/nav/NavDrawer'
import { Brand } from '@/components/ui/Brand'
import { useUnreadAvisos } from '@/features/notifications/useNotifications'
import type { NavItem } from '@/components/nav/navItems'
import type { UserRole } from '@/lib/types'

// Accesos rápidos de la barra inferior según el rol; el menú ☰ tiene todo.
function primaryFor(role: UserRole | null): NavItem[] {
  if (role === 'organizer') {
    return [
      { to: '/app/organizador', label: 'Panel', icon: '🛠️', end: true },
      { to: '/app/organizador/alineaciones', label: 'Alineac.', icon: '✅' },
      { to: '/app/organizador/resultados', label: 'Resultados', icon: '📝' },
      { to: '/rol', label: 'Rol', icon: '📅' },
    ]
  }
  if (role === 'captain') {
    return [
      { to: '/app/capitan', label: 'Panel', icon: '📋', end: true },
      { to: '/app/capitan/alineacion', label: 'Alineación', icon: '🎾' },
      { to: '/resultados', label: 'Resultados', icon: '📊' },
      { to: '/tabla', label: 'Tabla', icon: '🏆' },
    ]
  }
  if (role === 'web_manager') {
    return [
      { to: '/app/contenido', label: 'Noticias', icon: '📰', end: true },
      { to: '/app/contenido/reglamento', label: 'Reglamento', icon: '📄' },
      { to: '/noticias', label: 'Ver web', icon: '🌐' },
      { to: '/tabla', label: 'Tabla', icon: '🏆' },
    ]
  }
  return [
    { to: '/app', label: 'Cuenta', icon: '🧑', end: true },
    { to: '/rol', label: 'Rol', icon: '📅' },
    { to: '/resultados', label: 'Resultados', icon: '📊' },
    { to: '/tabla', label: 'Tabla', icon: '🏆' },
  ]
}

// Layout del área autenticada. Mismo patrón que el público: header con ☰,
// barra inferior por rol y drawer compartido.
export function AppLayout() {
  const { user, profile, role } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const who = profile?.full_name ?? user?.email
  const unread = useUnreadAvisos()

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              className="rounded-lg p-1.5 text-lg leading-none text-slate-600 hover:bg-slate-100"
            >
              ☰
            </button>
            <Link to="/app" aria-label="Mi cuenta">
              <Brand />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {who} · {roleLabel(role)}
            </span>
            <Link
              to="/app/avisos"
              aria-label={unread > 0 ? `Avisos (${unread} sin leer)` : 'Avisos'}
              className="relative rounded-lg p-1.5 text-lg leading-none text-slate-600 hover:bg-slate-100"
            >
              🔔
              {unread > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-24">
        <Outlet />
      </main>

      <BottomNav items={primaryFor(role)} onMenu={() => setMenuOpen(true)} />
      <NavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
