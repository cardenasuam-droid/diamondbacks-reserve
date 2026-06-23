import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { roleLabel } from '@/features/auth/roles'
import { NavDrawer } from '@/components/nav/NavDrawer'
import { Brand } from '@/components/ui/Brand'
import { Icon } from '@/components/ui/Icon'
import { DevBanner } from '@/components/dev/DevBanner'
import { useUnreadAvisos } from '@/features/notifications/useNotifications'

// Layout del área autenticada. Mismo patrón que el público: header con ☰ que
// abre el drawer (la navegación completa vive ahí, sin barra inferior).
export function AppLayout() {
  const { user, profile, role } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const who = profile?.full_name ?? user?.email
  const unread = useUnreadAvisos()
  const location = useLocation()

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <DevBanner />
      <header className="glass sticky top-0 z-10 border-b border-white/10 bg-slate-100/55 pt-safe">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <Icon name="menu" size={22} />
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
              className="relative rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <Icon name="bell" size={20} />
              {unread > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-slate-100" />
              )}
            </Link>
          </div>
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
