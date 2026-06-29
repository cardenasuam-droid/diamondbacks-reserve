import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { roleLabel } from '@/features/auth/roles'
import { isSyntheticEmail } from '@/features/auth/playerAuth'
import { Brand } from '@/components/ui/Brand'
import { Icon } from '@/components/ui/Icon'
import { NAV_GROUPS, navAllows } from './navItems'

// Menú lateral (off-canvas) con TODA la navegación, agrupada y filtrada por rol.
// Es la fuente completa; la barra inferior solo lleva los accesos rápidos.
export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, role, user, profile, isDev, signOut } = useAuth()
  const navigate = useNavigate()
  const hasSession = Boolean(session)
  // Para jugadores el email es sintético: mostramos su nombre.
  const who = profile?.full_name ?? (isSyntheticEmail(user?.email) ? 'Mi cuenta' : user?.email)

  async function handleSignOut() {
    onClose()
    await signOut()
    navigate('/', { replace: true })
  }

  // Refresco manual (el equivalente al "recargar" de escritorio): fuerza el SW
  // nuevo y recarga, trayendo código + datos frescos. Útil en móvil/PWA.
  function handleRefresh() {
    onClose()
    if (window.updateApp) window.updateApp()
    else window.location.reload()
  }

  const groups = NAV_GROUPS.filter((g) => navAllows(g.requires, role, hasSession, isDev)).map(
    (g) => ({
      ...g,
      items: g.items.filter((i) => navAllows(i.requires, role, hasSession, isDev)),
    }),
  )

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        className={
          'fixed inset-0 z-30 bg-black/60 transition-opacity duration-200 ' +
          (open ? 'opacity-100' : 'pointer-events-none opacity-0')
        }
      />

      {/* panel */}
      <aside
        role="dialog"
        aria-label="Menú de navegación"
        aria-hidden={!open}
        className={
          'glass fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85%] flex-col border-r border-white/10 bg-slate-100/80 shadow-xl transition-transform duration-200 ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <Brand />
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {groups.map((g) => (
            <div key={g.title} className="mb-4">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {g.title}
              </p>
              <ul>
                {g.items.map((item) =>
                  item.soon ? (
                    <li
                      key={item.to}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400"
                    >
                      <Icon name={item.icon} size={18} />
                      <span className="flex-1">{item.label}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        Pronto
                      </span>
                    </li>
                  ) : (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ' +
                          (isActive
                            ? 'bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/30'
                            : 'text-slate-700 hover:bg-slate-100')
                        }
                      >
                        <Icon name={item.icon} size={18} />
                        {item.label}
                      </NavLink>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-slate-200 p-3">
          <button
            onClick={handleRefresh}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <Icon name="refresh" size={16} /> Actualizar
          </button>
          {hasSession ? (
            <div className="space-y-2">
              <p className="px-1 text-xs text-slate-500">
                {who}
                <br />
                <span className="font-medium text-slate-700">{roleLabel(role)}</span>
              </p>
              <button
                onClick={handleSignOut}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              onClick={onClose}
              className="block w-full rounded-lg bg-brand-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
            >
              Entrar
            </NavLink>
          )}
        </div>
      </aside>
    </>
  )
}
