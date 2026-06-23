import type { CSSProperties } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Icon, type IconName } from '@/components/ui/Icon'

// Secciones públicas adicionales (spec §15.1). Las que aún no existen se muestran
// como "Próximamente" (sin enlace) y se irán activando en sus módulos.
interface MoreItem {
  icon: IconName
  label: string
  desc: string
  to?: string
}

const ITEMS: MoreItem[] = [
  { icon: 'teams', label: 'Equipos y rosters', desc: 'Plantillas por equipo', to: '/equipos' },
  { icon: 'medal', label: 'Estadísticas individuales', desc: 'Ranking de jugadores', to: '/estadisticas' },
  { icon: 'stats', label: 'Estadísticas de equipo', desc: 'Rendimiento por equipo', to: '/estadisticas?tab=equipos' },
  { icon: 'news', label: 'Noticias', desc: 'Avisos y comunicados', to: '/noticias' },
  { icon: 'rules', label: 'Reglamento', desc: 'Documento oficial (PDF)', to: '/reglamento' },
]

export function MorePage() {
  return (
    <div>
      <PageHeader title="Más" subtitle="Secciones de la liga" />
      <ul className="space-y-2.5">
        {ITEMS.map((item, i) => {
          const inner = (
            <div className="flex items-center gap-3 p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                <Icon name={item.icon} size={20} />
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-slate-800">{item.label}</span>
                <span className="block text-xs text-slate-500">{item.desc}</span>
              </span>
              {item.to ? (
                <Icon name="chevron-right" size={18} className="text-slate-300" />
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  Próximamente
                </span>
              )}
            </div>
          )
          const style = { ['--d']: i } as CSSProperties
          return (
            <li key={item.label}>
              {item.to ? (
                <Card to={item.to} className="rise-item" style={style}>
                  {inner}
                </Card>
              ) : (
                <Card className="rise-item opacity-70" style={style}>
                  {inner}
                </Card>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
