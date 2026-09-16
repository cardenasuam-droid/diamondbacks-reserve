import { Link, Navigate } from 'react-router-dom'
import { useOpenRegistrationSeasons, type OpenRegistrationSeason } from '@/features/leagues/useLeagues'
import { Loader } from '@/components/ui/Loader'
import { Icon } from '@/components/ui/Icon'

// /registro — hub de inscripciones. Con una sola edición abierta redirige
// directo a su formulario (el enlace compartido por WhatsApp "simplemente
// funciona"); con varias, deja elegir. Aislada del shell, como RegisterPage.

function formRoute(s: OpenRegistrationSeason): string {
  return s.league.kind === 'team_league' ? '/registro/reserve' : `/registro/${s.league.slug}`
}

export function RegistrationHubPage() {
  const open = useOpenRegistrationSeasons()

  if (open.isLoading) {
    return (
      <div className="mx-auto max-w-md px-4 pt-16">
        <Loader label="Cargando inscripciones…" />
      </div>
    )
  }

  const seasons = open.data ?? []
  if (seasons.length === 1) return <Navigate to={formRoute(seasons[0])} replace />

  return (
    <div className="min-h-full">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-12 pt-safe">
        <main className="rise flex-1 pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-300">
            Diamondbacks Pádel
          </p>
          <h1 className="mt-1 font-heading text-2xl tracking-tight text-slate-900">
            Inscripciones abiertas
          </h1>

          {seasons.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-slate-100 p-5 text-sm leading-relaxed text-slate-500 shadow-sm">
              Por ahora no hay inscripciones abiertas. Vuelve pronto o consulta
              los avisos de la liga.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {seasons.map((s) => (
                <Link
                  key={s.id}
                  to={formRoute(s)}
                  data-league={s.league.slug}
                  className="flex items-center gap-3 rounded-2xl bg-slate-100 p-4 shadow-sm"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
                    <Icon name="account" size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">
                      {s.league.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {s.name}
                      {s.start_date &&
                        ` · inicia ${new Date(`${s.start_date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={18} />
                </Link>
              ))}
            </div>
          )}
        </main>

        <footer className="pt-6 text-center text-xs text-slate-600">Diamondbacks Pádel</footer>
      </div>
    </div>
  )
}
