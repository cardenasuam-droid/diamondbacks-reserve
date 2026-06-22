import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'

// Secciones públicas adicionales (spec §15.1). Las que aún no existen se muestran
// como "Próximamente" (sin enlace) y se irán activando en sus módulos.
interface MoreItem {
  icon: string
  label: string
  desc: string
  to?: string
}

const ITEMS: MoreItem[] = [
  { icon: '👥', label: 'Equipos y rosters', desc: 'Plantillas por equipo', to: '/equipos' },
  { icon: '🎾', label: 'Estadísticas individuales', desc: 'Ranking de jugadores', to: '/estadisticas' },
  { icon: '📈', label: 'Estadísticas de equipo', desc: 'Rendimiento por equipo', to: '/estadisticas?tab=equipos' },
  { icon: '📰', label: 'Noticias', desc: 'Avisos y comunicados', to: '/noticias' },
  { icon: '📄', label: 'Reglamento', desc: 'Documento oficial (PDF)', to: '/reglamento' },
]

export function MorePage() {
  return (
    <div>
      <PageHeader title="Más" subtitle="Secciones de la liga" />
      <ul className="space-y-2">
        {ITEMS.map((item) => {
          const content = (
            <>
              <span className="text-xl" aria-hidden>
                {item.icon}
              </span>
              <span className="flex-1">
                <span className="block font-medium text-slate-800">{item.label}</span>
                <span className="block text-xs text-slate-500">{item.desc}</span>
              </span>
              {item.to ? (
                <span className="text-slate-300" aria-hidden>
                  ›
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  Próximamente
                </span>
              )}
            </>
          )
          return (
            <li key={item.label}>
              {item.to ? (
                <Link
                  to={item.to}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 opacity-70">
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
