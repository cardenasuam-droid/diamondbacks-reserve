import { Link, useNavigate } from 'react-router-dom'
import { useActiveLeagues, type LeagueWithSeason } from '@/features/leagues/useLeagues'
import { useAuth } from '@/features/auth/context'
import { longDate } from '@/lib/format'
import { Icon } from '@/components/ui/Icon'
import { Loader } from '@/components/ui/Loader'

// Puerta de entrada de la plataforma (visión multi-liga): elegir a qué liga o
// torneo entrar. '/' manda SIEMPRE aquí — la app arranca eligiendo liga en
// cada apertura (decisión del organizador 2026-09-17; nada se recuerda).
// Cada tarjeta se pinta con la identidad de SU liga vía [data-league].

const KIND_LABEL: Record<string, string> = {
  team_league: 'Liga por equipos',
  americano: 'Liga americano · individual',
  tournament: 'Torneo',
}

function seasonChip(item: LeagueWithSeason): string | null {
  if (!item.season) return null
  const s = item.season
  if (s.status === 'active') return `${s.name} · en curso`
  if (item.registrationOpen) {
    return `${s.name} · inscripciones abiertas${s.start_date ? ` · inicia ${longDate(s.start_date)}` : ''}`
  }
  if (s.status === 'finished') return `${s.name} · finalizada`
  return s.name
}

export function LeagueSelectPage() {
  const navigate = useNavigate()
  const leagues = useActiveLeagues()
  // La entrada de la app también necesita puerta a la cuenta: sin estos
  // enlaces, quien llega aquí (todos, desde el gate de '/') no tiene cómo
  // iniciar sesión ni volver a su panel.
  const { session, role } = useAuth()
  const isStaff = role === 'organizer' || role === 'viewer'

  function choose(item: LeagueWithSeason) {
    const slug = item.league.slug
    navigate(slug === 'reserve' ? '/inicio' : `/${slug}`, { replace: true })
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-12 pt-safe">
        <main className="rise flex-1 pt-14">
          <img src="/logo-mark.png" alt="" aria-hidden className="mx-auto h-20 w-20 object-contain" />
          <h1 className="mt-3 text-center font-heading text-2xl tracking-tight text-slate-900">
            Diamondbacks Pádel
          </h1>
          <p className="mt-1 text-center text-sm text-slate-500">¿A qué liga quieres entrar?</p>

          {leagues.isLoading ? (
            <div className="pt-8">
              <Loader label="Cargando ligas…" />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {(leagues.data ?? []).map((item) => {
                const chip = seasonChip(item)
                return (
                  <div key={item.league.id} data-league={item.league.slug}>
                    <button
                      type="button"
                      onClick={() => choose(item)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-slate-100 p-4 text-left shadow-md ring-1 ring-brand-500/25"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
                        <Icon name="medal" size={24} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-heading text-lg leading-tight text-slate-900">
                          {item.league.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {KIND_LABEL[item.league.kind] ?? item.league.kind}
                        </span>
                        {chip && (
                          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-medium text-brand-200 ring-1 ring-brand-500/30">
                            <span className="h-1 w-1 rounded-full bg-brand-300" aria-hidden />
                            {chip}
                          </span>
                        )}
                      </span>
                      <Icon name="chevron-right" size={18} className="shrink-0 text-slate-400" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
            También puedes cambiar de liga cuando quieras desde el menú.
          </p>

          <div className="mt-4 flex items-center justify-center gap-4">
            {session ? (
              <>
                <Link to="/app" className="text-sm font-medium text-sky-300 underline">
                  Mi cuenta
                </Link>
                {isStaff && (
                  <Link
                    to="/app/organizador"
                    className="text-sm font-medium text-gold-300 underline"
                  >
                    Panel del organizador
                  </Link>
                )}
              </>
            ) : (
              <Link to="/login" className="text-sm font-medium text-sky-300 underline">
                ¿Ya tienes cuenta? Entrar
              </Link>
            )}
          </div>
        </main>

        <footer className="pt-6 text-center text-xs text-slate-600">Diamondbacks Pádel</footer>
      </div>
    </div>
  )
}
