import { Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { teamColor } from '@/lib/color'
import { TeamCrest } from '@/components/ui/TeamCrest'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'

export function TeamsPage() {
  const season = useActiveSeason()
  const teams = useTeams(season.data?.id)
  const players = usePublicPlayers(season.data?.id)

  if (season.isLoading) return <Loader label="Cargando temporada…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Equipos" />
        <EmptyState icon="teams" title="Aún no hay equipos" description="Aparecerán cuando se cree la temporada." />
      </div>
    )
  }

  const countByTeam = new Map<string, number>()
  for (const p of players.data ?? []) {
    countByTeam.set(p.team_id, (countByTeam.get(p.team_id) ?? 0) + 1)
  }

  return (
    <div>
      <PageHeader title="Equipos" subtitle={season.data.name} />

      {teams.isLoading ? (
        <Loader label="Cargando equipos…" />
      ) : teams.isError ? (
        <ErrorState onRetry={() => teams.refetch()} />
      ) : !teams.data || teams.data.length === 0 ? (
        <EmptyState icon="teams" title="Sin equipos todavía" />
      ) : (
        <ul className="space-y-3">
          {teams.data.map((t) => (
            <li key={t.id}>
              <Link
                to={`/equipos/${t.id}`}
                className="group flex items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <span className="w-1.5 shrink-0" style={{ backgroundColor: teamColor(t.color) }} aria-hidden />
                <span className="flex min-w-0 flex-1 items-center gap-3.5 py-3.5 pl-3.5">
                  <TeamCrest name={t.name} logoUrl={t.logo_url} color={t.color} size={52} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-800">{t.name}</span>
                    {t.slogan && <span className="block truncate text-xs text-slate-500">{t.slogan}</span>}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 pr-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                    <Icon name="teams" size={12} />
                    <span className="tabular-nums">{countByTeam.get(t.id) ?? 0}</span>
                  </span>
                  <Icon
                    name="chevron-right"
                    size={18}
                    className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-400"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
