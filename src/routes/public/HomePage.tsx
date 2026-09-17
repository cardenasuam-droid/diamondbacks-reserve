import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useOpenRegistrationSeasons } from '@/features/leagues/useLeagues'
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
      <section className="rise relative isolate pt-12">
        {/* Cuadro de fondo del hero (recortado a la tarjeta). La jugadora sobresale
            por encima de su borde superior. */}
        <div className="absolute inset-x-0 bottom-0 top-12 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a3d29] via-[#131a12] to-[#10160f] shadow-md ring-1 ring-gold-500/25">
          {/* Velo para el contraste del texto a la izquierda. */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10"
            aria-hidden
          />
          {/* Halos: oro (cálido, arriba-dcha) + esmeralda (abajo-izq) para el "pop". */}
          <div
            className="pointer-events-none absolute -right-10 -top-4 h-48 w-48 rounded-full bg-gold-500/25 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 left-1/4 h-44 w-44 rounded-full bg-brand-500/20 blur-3xl"
            aria-hidden
          />
          {/* Escudo de la liga como marca de agua tenue detrás del título. */}
          <img
            src="/logo-mark.png"
            alt=""
            aria-hidden
            className="pointer-events-none absolute -left-7 top-1/2 h-52 w-52 -translate-y-1/2 object-contain opacity-[0.07]"
          />
        </div>
        {/* Recorte de jugadora transparente (public/hero-player.webp): ocupa toda la
            altura de la sección y se ancla abajo, así su parte superior PROTRUYE por
            encima del cuadro (que empieza en top-12). Queda dentro de la sección, sin
            recorte del layout. Para rotar, apunta a otro hero-player*.webp con fondo
            REALMENTE transparente. */}
        <img
          src="/hero-player.webp"
          alt=""
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 h-full w-[48%] object-cover object-bottom drop-shadow-[0_18px_25px_rgba(0,0,0,0.55)]"
        />
        <div className="relative z-20 min-h-[184px] max-w-[62%] px-7 pb-7 pt-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300">Temporada</p>
          <h1 className="mt-1 font-heading text-3xl leading-tight">
            Diamondbacks <span className="text-gold-400">Reserve</span>
          </h1>
          {season ? (
            <span className="glass mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400" aria-hidden />
              {season.name}
              {season.status === 'active' && ' · en curso'}
            </span>
          ) : (
            <p className="mt-2 text-sm text-white/85">
              Bienvenido. Pronto verás aquí el rol, la tabla y las estadísticas.
            </p>
          )}
        </div>
      </section>

      <OtherLeaguesBanner />

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

// Aviso de OTRAS ligas con inscripción abierta (0049). Reserve no se anuncia a
// sí misma; hoy esto muestra la Liga Femenil y desaparece solo al cerrar sus
// inscripciones. El tema de la liga colorea la tarjeta vía [data-league].
function OtherLeaguesBanner() {
  const open = useOpenRegistrationSeasons()
  const others = (open.data ?? []).filter((s) => s.league.slug !== 'reserve')
  if (others.length === 0) return null

  return (
    <section className="space-y-3">
      {others.map((s) => (
        <div key={s.id} data-league={s.league.slug}>
          <Card to={`/${s.league.slug}`} className="flex items-center gap-3 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
              <Icon name="account" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-slate-800">{s.league.name}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {s.name} · inscripciones abiertas
                {s.start_date &&
                  ` · inicia ${new Date(`${s.start_date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`}
              </span>
            </span>
            <Icon name="chevron-right" size={18} />
          </Card>
        </div>
      ))}
    </section>
  )
}
