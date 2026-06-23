import { Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { teamColor } from '@/lib/color'
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
                className="flex items-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <span className="h-14 w-2 shrink-0" style={{ backgroundColor: teamColor(t.color) }} aria-hidden />
                <span className="flex-1 py-3">
                  <span className="block font-semibold text-slate-800">{t.name}</span>
                  {t.slogan && <span className="block text-xs text-slate-500">{t.slogan}</span>}
                </span>
                <span className="px-4 text-right text-sm text-slate-500">
                  {countByTeam.get(t.id) ?? 0} <span className="text-xs">jug.</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
