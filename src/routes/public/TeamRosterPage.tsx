import type { CSSProperties } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { useStandings } from '@/features/standings/useStandings'
import { useCategories } from '@/features/categories/useCategories'
import { groupRoster } from '@/features/teams/groupRoster'
import { categoryColor } from '@/features/categories/categoryColor'
import { teamColor } from '@/lib/color'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

export function TeamRosterPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const season = useActiveSeason()
  const teams = useTeams(season.data?.id)
  const players = usePublicPlayers(season.data?.id)
  const standings = useStandings(season.data?.id)
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
        <EmptyState icon="search" title="Equipo no encontrado" />
      </div>
    )
  }

  const typeOf = new Map((categories.data ?? []).map((c) => [c.code, c.type]))
  const roster = (players.data ?? []).filter((p) => p.team_id === team.id)
  const groups = groupRoster(roster, categories.data ?? [])
  const standing = standings.data?.find((s) => s.team_id === team.id)

  return (
    <div>
      <BackLink />

      <div
        className="mb-4 rounded-2xl p-5 text-white shadow-sm"
        style={{ backgroundColor: teamColor(team.color, '#334155') }}
      >
        <h1 className="font-heading text-2xl">{team.name}</h1>
        {team.slogan && <p className="mt-0.5 text-sm text-white/80">{team.slogan}</p>}
        <p className="mt-2 text-sm text-white/80">{roster.length} jugadores</p>
      </div>

      {/* Estadísticas del equipo (tabla de posiciones) */}
      {standing && standing.played > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Estadísticas</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Posición" value={`#${standing.position}`} accent i={0} />
            <Stat label="Puntos" value={standing.points} accent i={1} />
            <Stat label="Jugados" value={standing.played} i={2} />
            <Stat label="Ganados" value={standing.won} i={3} />
            <Stat label="Perdidos" value={standing.lost} i={4} />
            <Stat label="Dif. sets" value={signed(standing.set_diff)} i={5} />
            <Stat label="Dif. juegos" value={signed(standing.game_diff)} i={6} />
            <Stat label="Sets G-P" value={`${standing.sets_won}-${standing.sets_lost}`} i={7} />
          </div>
        </section>
      )}

      {groups.length === 0 ? (
        <EmptyState icon="teams" title="Sin jugadores" description="Este equipo aún no tiene roster cargado." />
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
                  <li key={p.id}>
                    <Link
                      to={`/jugadores/${p.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50"
                    >
                      <Avatar name={p.full_name} photoUrl={p.photo_url} color={team.color} size={36} />
                      <span className="flex-1 font-medium text-slate-800">{p.full_name}</span>
                      {p.is_captain && <Badge color="amber">Capitán</Badge>}
                      <span className="text-slate-300" aria-hidden>›</span>
                    </Link>
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

function Stat({
  label,
  value,
  accent,
  i = 0,
}: {
  label: string
  value: string | number
  accent?: boolean
  i?: number
}) {
  return (
    <div
      className="rise-item rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-stone-50 p-3 shadow-sm"
      style={{ ['--d']: i } as CSSProperties}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={'mt-1 text-2xl font-bold tabular-nums ' + (accent ? 'text-gold-600' : 'text-slate-900')}>
        {value}
      </p>
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
