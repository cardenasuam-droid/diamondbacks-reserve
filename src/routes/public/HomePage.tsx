import { useActiveSeason } from '@/features/season/useActiveSeason'
import { Card } from '@/components/ui/Card'
import { Icon, type IconName } from '@/components/ui/Icon'
import type { CSSProperties } from 'react'

const QUICK_LINKS: { to: string; icon: IconName; label: string; desc: string }[] = [
  { to: '/tabla', icon: 'standings', label: 'Tabla', desc: 'Posiciones' },
  { to: '/rol', icon: 'schedule', label: 'Rol', desc: 'Calendario' },
  { to: '/resultados', icon: 'results', label: 'Resultados', desc: 'Marcadores' },
  { to: '/mas', icon: 'more', label: 'Más', desc: 'Equipos, stats…' },
]

export function HomePage() {
  const { data: season } = useActiveSeason()

  return (
    <div className="space-y-6">
      <section className="rise relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-stone-950 p-7 text-white shadow-md ring-1 ring-gold-500/30">
        <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-gold-500/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-emerald-400/10" aria-hidden />
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300">
          Temporada
        </p>
        <h1 className="relative mt-1 font-heading text-3xl leading-tight">
          Liga de Pádel <span className="text-gold-400">por Equipos</span>
        </h1>
        <p className="relative mt-2 text-sm text-emerald-100/90">
          {season ? (
            <>
              Temporada <span className="font-semibold">{season.name}</span>
              {season.status === 'active' && ' · en curso'}
            </>
          ) : (
            'Bienvenido. Pronto verás aquí el rol, la tabla y las estadísticas.'
          )}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {QUICK_LINKS.map((q, i) => (
          <Card
            key={q.to}
            to={q.to}
            className="rise-item flex flex-col gap-2 p-4"
            style={{ ['--d']: i } as CSSProperties}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
              <Icon name={q.icon} size={22} />
            </span>
            <span className="mt-1 font-semibold text-slate-800">{q.label}</span>
            <span className="text-xs text-slate-500">{q.desc}</span>
          </Card>
        ))}
      </section>
    </div>
  )
}
