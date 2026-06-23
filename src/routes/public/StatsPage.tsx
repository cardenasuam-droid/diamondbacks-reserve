import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { useStandings } from '@/features/standings/useStandings'
import { usePlayerRankings } from '@/features/stats/usePlayerRankings'
import { useCategories } from '@/features/categories/useCategories'
import { categoryColor } from '@/features/categories/categoryColor'
import { teamColor } from '@/lib/color'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'

type Tab = 'jugadores' | 'equipos'

export function StatsPage() {
  const [params, setParams] = useSearchParams()
  const initial: Tab = params.get('tab') === 'equipos' ? 'equipos' : 'jugadores'
  const [tab, setTab] = useState<Tab>(initial)

  const season = useActiveSeason()
  const teams = useTeams(season.data?.id)
  const teamIds = teams.data?.map((t) => t.id)

  function selectTab(t: Tab) {
    setTab(t)
    setParams(t === 'equipos' ? { tab: 'equipos' } : {}, { replace: true })
  }

  if (season.isLoading) return <Loader label="Cargando temporada…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Estadísticas" />
        <EmptyState icon="stats" title="Aún no hay estadísticas" description="Aparecerán cuando haya resultados." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Estadísticas" subtitle={season.data.name} />

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
        {(['jugadores', 'equipos'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => selectTab(t)}
            className={
              'rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ' +
              (tab === t ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'jugadores' ? (
        <PlayersTab teamIds={teamIds} teams={teams} />
      ) : (
        <TeamsTab seasonId={season.data.id} />
      )}
    </div>
  )
}

function PlayersTab({
  teamIds,
  teams,
}: {
  teamIds: string[] | undefined
  teams: ReturnType<typeof useTeams>
}) {
  const ranking = usePlayerRankings(teamIds)
  const categories = useCategories()

  if (ranking.isLoading || teams.isLoading) return <Loader label="Cargando ranking…" />
  if (ranking.isError) return <ErrorState onRetry={() => ranking.refetch()} />
  if (!ranking.data || ranking.data.length === 0) {
    return <EmptyState icon="medal" title="Sin ranking todavía" description="Se llena cuando hay alineaciones y resultados." />
  }

  const teamById = new Map((teams.data ?? []).map((t) => [t.id, t]))
  const typeOf = new Map((categories.data ?? []).map((c) => [c.code, c.type]))

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-2 py-2.5 text-center font-semibold">#</th>
            <th className="px-2 py-2.5 text-left font-semibold">Jugador</th>
            <th className="hidden px-2 py-2.5 text-center font-semibold sm:table-cell">PJ</th>
            <th className="px-2 py-2.5 text-center font-semibold">%V</th>
            <th className="px-2 py-2.5 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {ranking.data.map((p) => {
            const team = teamById.get(p.team_id)
            return (
              <tr key={p.player_id} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-2.5 text-center font-semibold text-slate-500">{p.position}</td>
                <td className="px-2 py-2.5">
                  <Link to={`/jugadores/${p.player_id}`} className="flex items-center gap-2 hover:opacity-70">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5"
                      style={{ backgroundColor: teamColor(team?.color) }}
                      aria-hidden
                    />
                    <span className="font-medium text-slate-800">{p.full_name}</span>
                    <Badge color={categoryColor(typeOf.get(p.category_code))}>{p.category_code}</Badge>
                  </Link>
                </td>
                <td className="hidden px-2 py-2.5 text-center tabular-nums text-slate-600 sm:table-cell">
                  {p.matches_played}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-slate-600">{p.win_percentage}%</td>
                <td className="px-2 py-2.5 text-center font-bold tabular-nums text-slate-900">
                  {p.points_contributed}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TeamsTab({ seasonId }: { seasonId: string }) {
  const standings = useStandings(seasonId)

  if (standings.isLoading) return <Loader label="Cargando equipos…" />
  if (standings.isError) return <ErrorState onRetry={() => standings.refetch()} />
  if (!standings.data || standings.data.length === 0) {
    return <EmptyState icon="stats" title="Sin datos de equipo" />
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-2 py-2.5 text-center font-semibold">#</th>
            <th className="px-2 py-2.5 text-left font-semibold">Equipo</th>
            <th className="px-2 py-2.5 text-center font-semibold">PJ</th>
            <th className="px-2 py-2.5 text-center font-semibold">PG</th>
            <th className="hidden px-2 py-2.5 text-center font-semibold sm:table-cell">PP</th>
            <th className="hidden px-2 py-2.5 text-center font-semibold sm:table-cell">DS</th>
            <th className="hidden px-2 py-2.5 text-center font-semibold sm:table-cell">DJ</th>
            <th className="px-2 py-2.5 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.data.map((t) => (
            <tr key={t.team_id} className="border-b border-slate-100 last:border-0">
              <td className="px-2 py-2.5 text-center font-semibold text-slate-500">{t.position}</td>
              <td className="px-2 py-2.5">
                <Link to={`/equipos/${t.team_id}`} className="flex items-center gap-2 hover:opacity-70">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5"
                    style={{ backgroundColor: teamColor(t.color) }}
                    aria-hidden
                  />
                  <span className="font-medium text-slate-800">{t.team_name}</span>
                </Link>
              </td>
              <td className="px-2 py-2.5 text-center tabular-nums text-slate-600">{t.played}</td>
              <td className="px-2 py-2.5 text-center tabular-nums text-slate-600">{t.won}</td>
              <td className="hidden px-2 py-2.5 text-center tabular-nums text-slate-600 sm:table-cell">{t.lost}</td>
              <td className="hidden px-2 py-2.5 text-center tabular-nums text-slate-600 sm:table-cell">
                {t.set_diff > 0 ? `+${t.set_diff}` : t.set_diff}
              </td>
              <td className="hidden px-2 py-2.5 text-center tabular-nums text-slate-600 sm:table-cell">
                {t.game_diff > 0 ? `+${t.game_diff}` : t.game_diff}
              </td>
              <td className="px-2 py-2.5 text-center font-bold tabular-nums text-slate-900">{t.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
