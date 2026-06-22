import { NavLink } from 'react-router-dom'
import type { NavItem } from './navItems'

// Barra inferior: accesos rápidos (4) + botón Menú que abre el drawer con todo.
// Mantenerla a 4 items deja sitio holgado para el quinto (Menú) en móvil.
export function BottomNav({
  items,
  onMenu,
}: {
  items: NavItem[]
  onMenu: () => void
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-safe backdrop-blur">
      <div className="mx-auto grid max-w-3xl grid-cols-5">
        {items.slice(0, 4).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ' +
              (isActive ? 'text-sky-600' : 'text-slate-500 hover:text-slate-600')
            }
          >
            <span className="text-lg" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={onMenu}
          className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500 transition hover:text-slate-600"
        >
          <span className="text-lg" aria-hidden>
            ☰
          </span>
          Menú
        </button>
      </div>
    </nav>
  )
}
