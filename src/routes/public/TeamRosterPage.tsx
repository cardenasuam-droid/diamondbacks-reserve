import { useParams, Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { useCategories } from '@/features/categories/useCategories'
import { groupRoster } from '@/features/teams/groupRoster'
import { categoryColor } from '@/features/categories/categoryColor'
import { teamColor } from '@/lib/color'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'

export function TeamRosterPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const season = useActiveSeason()
  const teams = useTeams(season.data?.id)
  const players = usePublicPlayers(season.data?.id)
  const categories = useCategories()

  if (season.isLoading || teams.isLoading || players.isLoading || categories.isLoading) {
    return <Loader label="Cargando equipo…" />
  }
  if (teams.isError || players.isError || categories.isError) {
    return <ErrorState onRetry={() => { teams.refetch(); players.refetch(); categories.refetch() }} />
  }

  const team = teams.data?.find((t) => t.id === teamId)
  if (!team) {
    return (
      <div>
        <BackLink />
        <EmptyState icon="🔍" title="Equipo no encontrado" />
      </div>
    )
  }

  const typeOf = new Map((categories.data ?? []).map((c) => [c.code, c.type]))
  const roster = (players.data ?? []).filter((p) => p.team_id === team.id)
  const groups = groupRoster(roster, categories.data ?? [])

  return (
    <div>
      <BackLink />

      <div
        className="mb-5 rounded-2xl p-5 text-white shadow-sm"
        style={{ backgroundColor: teamColor(team.color, '#334155') }}
      >
        <h1 className="text-2xl font-extrabold tracking-tight">{team.name}</h1>
        {team.slogan && <p className="mt-0.5 text-sm text-white/80">{team.slogan}</p>}
        <p className="mt-2 text-sm text-white/80">{roster.length} jugadores</p>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="👥" title="Sin jugadores" description="Este equipo aún no tiene roster cargado." />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.code}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{g.name}</h2>
                <Badge color={categoryColor(typeOf.get(g.code))}>{g.code}</Badge>
              </div>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {g.players.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-medium text-slate-800">{p.full_name}</span>
                    {p.is_captain && <Badge color="amber">Capitán</Badge>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/equipos" className="mb-4 inline-flex items-center text-sm font-medium text-sky-600">
      ‹ Equipos
    </Link>
  )
}
