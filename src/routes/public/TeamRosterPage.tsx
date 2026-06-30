import { useState, type CSSProperties } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { useStandings } from '@/features/standings/useStandings'
import { useCategories } from '@/features/categories/useCategories'
import { groupRoster, type RosterGroup } from '@/features/teams/groupRoster'
import { categoryColor } from '@/features/categories/categoryColor'
import { teamColor } from '@/lib/color'
import { Avatar } from '@/components/ui/Avatar'
import { TeamCrest } from '@/components/ui/TeamCrest'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import type { CategoryType } from '@/lib/types'

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
        className="relative mb-4 overflow-hidden rounded-2xl p-5 text-white shadow-md ring-1 ring-white/10"
        style={{ backgroundColor: teamColor(team.color, '#334155') }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-white/5" aria-hidden />
        <div className="relative flex items-center gap-4">
          <span className="shrink-0 rounded-2xl bg-white/15 p-1 shadow-lg ring-1 ring-white/25">
            <TeamCrest name={team.name} logoUrl={team.logo_url} color={team.color} size={56} />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl">{team.name}</h1>
            {team.slogan && <p className="mt-0.5 text-sm text-white/85">{team.slogan}</p>}
            <p className="mt-2 text-sm text-white/85">{roster.length} jugadores</p>
          </div>
        </div>
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
            <Stat label="Sets ganados" value={standing.sets_won} i={5} />
            <Stat label="Sets perdidos" value={standing.sets_lost} i={6} />
            <Stat label="Dif. sets" value={signed(standing.set_diff)} i={7} />
            <Stat label="Juegos ganados" value={standing.games_won} i={8} />
            <Stat label="Juegos perdidos" value={standing.games_lost} i={9} />
            <Stat label="Dif. juegos" value={signed(standing.game_diff)} i={10} />
          </div>
        </section>
      )}

      {groups.length === 0 ? (
        <EmptyState icon="teams" title="Sin jugadores" description="Este equipo aún no tiene roster cargado." />
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Plantilla</h2>
          {groups.map((g) => (
            <CategoryAccordion key={g.code} group={g} type={typeOf.get(g.code)} color={team.color} />
          ))}
        </section>
      )}
    </div>
  )
}

// Categoría plegable: el encabezado es un botón que despliega/oculta sus jugadores.
function CategoryAccordion({
  group,
  type,
  color,
}: {
  group: RosterGroup
  type: CategoryType | undefined
  color: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-100 to-slate-50 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-slate-100"
      >
        <span className="text-sm font-bold uppercase tracking-wide text-slate-700">{group.name}</span>
        <Badge color={categoryColor(type)}>{group.code}</Badge>
        <span className="ml-auto text-xs font-medium text-slate-500">{group.players.length} jug.</span>
        <Icon
          name="chevron-right"
          size={18}
          className={'text-slate-400 transition-transform ' + (open ? 'rotate-90' : '')}
        />
      </button>
      {open && (
        <ul className="divide-y divide-slate-100 border-t border-slate-200/80">
          {group.players.map((p) => (
            <li key={p.id}>
              <Link
                to={`/jugadores/${p.id}`}
                className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-100"
              >
                <Avatar name={p.full_name} photoUrl={p.photo_url} color={color} size={36} />
                <span className="flex-1 font-medium text-slate-800">{p.full_name}</span>
                {p.is_captain && <Badge color="amber">Capitán</Badge>}
                <Icon name="chevron-right" size={16} className="text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
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
      className="rise-item rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-100 to-slate-50 p-3 shadow-sm"
      style={{ ['--d']: i } as CSSProperties}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={'mt-1 text-2xl font-bold tabular-nums ' + (accent ? 'text-gold-400' : 'text-slate-900')}>
        {value}
      </p>
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/equipos" className="mb-4 inline-flex items-center text-sm font-medium text-sky-300">
      ‹ Equipos
    </Link>
  )
}
