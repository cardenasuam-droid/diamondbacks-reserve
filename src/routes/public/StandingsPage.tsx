import { Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useStandings } from '@/features/standings/useStandings'
import { useTeams } from '@/features/teams/useTeams'
import { TeamCrest } from '@/components/ui/TeamCrest'
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
                        (leader ? 'bg-gold-500/10' : '')
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
