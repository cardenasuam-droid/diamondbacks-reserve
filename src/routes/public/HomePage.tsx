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
      <section className="rise relative min-h-[240px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#5c2e0e] via-[#16161b] to-[#0c0c0f] text-white shadow-md ring-1 ring-amber-500/25">
        {/* Velo para el contraste del texto a la izquierda. */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10"
          aria-hidden
        />
        {/* Halos: ámbar (cálido, arriba-dcha) + azul frío (abajo-izq) para el "pop". */}
        <div
          className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-amber-500/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-1/4 h-44 w-44 rounded-full bg-blue-500/15 blur-3xl"
          aria-hidden
        />
        {/* Recorte de jugadora transparente (public/hero-player.webp). Para rotar,
            apunta a otro hero-player*.webp con fondo REALMENTE transparente. */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-3/5 bg-[url(/hero-player.webp)] bg-contain bg-right-bottom bg-no-repeat"
          aria-hidden
        />
        <div className="relative max-w-[62%] p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">Temporada</p>
          <h1 className="mt-1 font-heading text-3xl leading-tight">
            Liga de Pádel <span className="text-amber-400">por Equipos</span>
          </h1>
          <p className="mt-2 text-sm text-white/85">
            {season ? (
              <>
                Temporada <span className="font-semibold">{season.name}</span>
                {season.status === 'active' && ' · en curso'}
              </>
            ) : (
              'Bienvenido. Pronto verás aquí el rol, la tabla y las estadísticas.'
            )}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {QUICK_LINKS.map((q, i) => (
          <Card
            key={q.to}
            to={q.to}
            className="rise-item flex flex-col gap-2 p-4"
            style={{ ['--d']: i } as CSSProperties}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/30">
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
