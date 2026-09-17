import { Link } from 'react-router-dom'
import {
  useLeagueOpenSeason,
  useLeagueSeason,
  useSeasonCategories,
  useSeasonTimeBlocks,
  useSeasonPlayerCount,
} from '@/features/leagues/useLeagues'
import { pmLabel, longDate } from '@/lib/format'
import { LeagueShell } from './LeagueShell'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Loader } from '@/components/ui/Loader'

// Landing pública de una liga (F1/F2: /femenil): hero con la identidad de la
// liga, datos clave y CTA de inscripción mientras esté abierta. Comparte la
// navegación Inicio · Rol · Tabla con las páginas del americano (LeagueShell).

export function LeagueLandingPage({ slug }: { slug: string }) {
  const seasonQ = useLeagueSeason(slug)
  const openQ = useLeagueOpenSeason(slug)
  const season = seasonQ.data
  const categoriesQ = useSeasonCategories(season?.id)
  const blocksQ = useSeasonTimeBlocks(season?.id)
  const countQ = useSeasonPlayerCount(season?.id)

  if (seasonQ.isLoading) {
    return (
      <div data-league={slug} className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-md px-4 pt-16">
          <Loader label="Cargando…" />
        </div>
      </div>
    )
  }

  if (!season) {
    return (
      <div data-league={slug} className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-md px-4 pb-12 pt-16 text-center">
          <h1 className="font-heading text-xl text-slate-900">Muy pronto</h1>
          <p className="mt-2 text-sm text-slate-500">Esta liga aún no tiene ediciones.</p>
          <Link to="/" className="mt-5 inline-block text-sm font-medium text-brand-300 underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  const league = season.league
  const registrationOpen = openQ.data?.id === season.id
  const categories = (categoriesQ.data ?? []).filter((c) => c.is_ranking && c.is_active)
  const blocks = blocksQ.data ?? []
  const remaining =
    season.max_players != null && countQ.data != null
      ? Math.max(season.max_players - countQ.data, 0)
      : null

  const facts: { icon: IconName; label: string; value: string }[] = [
    ...(season.start_date
      ? [{ icon: 'schedule' as IconName, label: 'Arranque', value: `Lunes ${longDate(season.start_date)}` }]
      : []),
    { icon: 'results' as IconName, label: 'Formato', value: '8 jornadas · pareja rotativa · playoffs con pareja fija' },
    ...(blocks.length > 0
      ? [{ icon: 'schedule' as IconName, label: 'Horarios', value: blocks.map((b) => pmLabel(b.label)).join(' · ') }]
      : []),
    ...(categories.length > 0
      ? [{ icon: 'medal' as IconName, label: 'Categorías', value: categories.map((c) => c.name).join(', ') }]
      : []),
    ...(season.max_players != null
      ? [{
          icon: 'account' as IconName,
          label: 'Cupo',
          value:
            remaining != null && remaining < season.max_players
              ? `${season.max_players} jugadoras · quedan ${remaining} lugares`
              : `${season.max_players} jugadoras`,
        }]
      : []),
  ]

  return (
    <LeagueShell slug={league.slug} leagueName={league.name} seasonName={season.name} active="inicio">
      {/* Hero con la identidad de la liga (tema por [data-league]). */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-slate-100 to-slate-50 p-6 shadow-md ring-1 ring-brand-500/25">
        <div
          className="pointer-events-none absolute -right-10 -top-8 h-40 w-40 rounded-full bg-brand-500/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 left-1/4 h-36 w-36 rounded-full bg-sky-500/20 blur-3xl"
          aria-hidden
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
          Diamondbacks Pádel
        </p>
        <h1 className="mt-1 font-heading text-3xl leading-tight text-slate-900">{league.name}</h1>
        <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/15 px-3 py-1 text-xs font-medium text-brand-200">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-300" aria-hidden />
          {season.name}
          {registrationOpen ? ' · inscripciones abiertas' : ''}
        </span>
      </section>

      <section className="mt-4 space-y-2.5">
        {facts.map((f) => (
          <div key={f.label} className="flex items-start gap-3 rounded-2xl bg-slate-100 p-4 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
              <Icon name={f.icon} size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs uppercase tracking-wide text-slate-500">{f.label}</span>
              <span className="mt-0.5 block text-sm font-medium leading-snug text-slate-800">
                {f.value}
              </span>
            </span>
          </div>
        ))}
      </section>

      {registrationOpen && (
        <Link
          to={`/registro/${league.slug}`}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-300 px-4 py-3.5 font-semibold text-[#1a1405] shadow-sm"
        >
          Inscribirme
          <Icon name="chevron-right" size={18} />
        </Link>
      )}

      <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
        Juegas individual: cada jornada el rol te asigna pareja distinta de tu
        categoría, y a la fase final llegas con pareja fija según tus resultados.
      </p>
    </LeagueShell>
  )
}
