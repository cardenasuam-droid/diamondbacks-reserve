import { Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useStandings } from '@/features/standings/useStandings'
import { useTeams } from '@/features/teams/useTeams'
import { useCountUp } from '@/hooks/useCountUp'
import type { RankedTeam } from '@/features/standings/resolveStandings'
import { TeamCrest } from '@/components/ui/TeamCrest'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'

export function StandingsPage() {
  const season = useActiveSeason()
  const standings = useStandings(season.data?.id)
  const teams = useTeams(season.data?.id)
  const logoById = new Map((teams.data ?? []).map((t) => [t.id, t.logo_url]))

  if (season.isLoading) return <Loader label="Cargando temporada…" />
  if (season.isError) return <ErrorState onRetry={() => season.refetch()} />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Tabla de posiciones" />
        <EmptyState
          icon="standings"
          title="Aún no hay temporada"
          description="Cuando el organizador cree la temporada y cargue resultados, la tabla aparecerá aquí."
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Tabla de posiciones" subtitle={season.data.name} />

      {standings.isLoading ? (
        <Loader label="Cargando tabla…" />
      ) : standings.isError ? (
        <ErrorState onRetry={() => standings.refetch()} />
      ) : !standings.data || standings.data.length === 0 ? (
        <EmptyState
          icon="standings"
          title="Sin equipos todavía"
          description="La tabla se llenará en cuanto haya equipos y resultados validados."
        />
      ) : (
        <>
          {standings.data[0] && standings.data[0].played > 0 && (
            <LeaderSpotlight
              leader={standings.data[0]}
              logoUrl={logoById.get(standings.data[0].team_id)}
            />
          )}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2.5 text-center font-semibold">#</th>
                  <th className="px-2 py-2.5 text-left font-semibold">Equipo</th>
                  <th className="px-2 py-2.5 text-center font-semibold">PJ</th>
                  <th className="px-2 py-2.5 text-center font-semibold">PG</th>
                  <th className="hidden px-2 py-2.5 text-center font-semibold sm:table-cell">DS</th>
                  <th className="hidden px-2 py-2.5 text-center font-semibold sm:table-cell">DJ</th>
                  <th className="px-2 py-2.5 text-center font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.data.map((t) => {
                  const leader = t.position === 1
                  return (
                    <tr
                      key={t.team_id}
                      className={
                        'border-b border-slate-100 last:border-0 ' +
                        (leader ? 'bg-gradient-to-r from-gold-500/20 via-gold-500/[0.07] to-transparent' : '')
                      }
                    >
                      <td
                        className={
                          'px-2 py-2.5 text-center font-bold tabular-nums ' +
                          (leader ? 'text-gold-400' : 'font-semibold text-slate-500')
                        }
                      >
                        {t.position}
                      </td>
                      <td className="px-2 py-2.5">
                        <Link to={`/equipos/${t.team_id}`} className="flex items-center gap-2 hover:opacity-70">
                          <TeamCrest name={t.team_name} logoUrl={logoById.get(t.team_id)} color={t.color} size={24} />
                          <span className={leader ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}>
                            {t.team_name}
                            {t.tiedUnresolved && (
                              <span className="ml-1 text-amber-500" title="Empate por definir (enfrentamiento directo / organizador)">
                                *
                              </span>
                            )}
                          </span>
                          {leader && (
                            <Icon name="standings" size={14} className="ml-0.5 shrink-0 text-gold-300" />
                          )}
                        </Link>
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums text-slate-600">{t.played}</td>
                      <td className="px-2 py-2.5 text-center tabular-nums text-slate-600">{t.won}</td>
                      <td className="hidden px-2 py-2.5 text-center tabular-nums text-slate-600 sm:table-cell">
                        {t.set_diff > 0 ? `+${t.set_diff}` : t.set_diff}
                      </td>
                      <td className="hidden px-2 py-2.5 text-center tabular-nums text-slate-600 sm:table-cell">
                        {t.game_diff > 0 ? `+${t.game_diff}` : t.game_diff}
                      </td>
                      <td
                        className={
                          'px-2 py-2.5 text-center font-bold tabular-nums ' +
                          (leader ? 'text-gold-400' : 'text-slate-900')
                        }
                      >
                        {t.points}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 space-y-1 text-xs text-slate-500">
            <p>PJ jugados · PG ganados · DS dif. sets · DJ dif. juegos · Pts puntos.</p>
            {standings.data.some((t) => t.tiedUnresolved) && (
              <p>
                <span className="text-amber-500">*</span> Empate que no se resolvió por
                enfrentamiento directo; lo define el organizador.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Tarjeta destacada del líder (campeón actual) sobre la tabla. Escudo grande con
// halo de su color (el `glow` lee sobre la superficie oscura), puntos en oro que
// cuentan al entrar. Solo se muestra cuando hay partidos jugados.
function LeaderSpotlight({
  leader,
  logoUrl,
}: {
  leader: RankedTeam
  logoUrl: string | null | undefined
}) {
  const points = useCountUp(leader.points)
  return (
    <Link
      to={`/equipos/${leader.team_id}`}
      className="gold-edge group relative mb-4 flex items-center gap-4 overflow-hidden rounded-3xl bg-slate-50 p-5 shadow-md ring-1 ring-gold-500/30 transition duration-200 hover:-translate-y-0.5"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/15 blur-3xl"
        aria-hidden
      />
      <TeamCrest name={leader.team_name} logoUrl={logoUrl} color={leader.color} size={64} glow />
      <div className="relative min-w-0 flex-1">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-gold-300">
          <Icon name="standings" size={13} /> Líder
        </p>
        <p className="truncate font-heading text-xl text-slate-900">{leader.team_name}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {leader.won} ganados · {leader.played} jugados
        </p>
      </div>
      <div className="relative shrink-0 text-right">
        <p className="font-heading text-3xl leading-none tabular-nums text-gold-300">
          {Math.round(points)}
        </p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">pts</p>
      </div>
    </Link>
  )
}
