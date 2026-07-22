import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { useTeams } from '@/features/teams/useTeams'
import { useCategories } from '@/features/categories/useCategories'
import { groupRoster } from '@/features/teams/groupRoster'
import { categoryColor } from '@/features/categories/categoryColor'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { PositionChip } from '@/components/ui/PositionChip'
import { TeamCrest } from '@/components/ui/TeamCrest'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import type { PublicPlayer, Team } from '@/lib/types'

// Directorio PÚBLICO de jugadores: todos los usuarios pueden buscar/ver a todos y
// tocar a uno para ir a su tarjeta (/jugadores/:id). Agrupado por categoría; con
// buscador que filtra en vivo (resultados planos mientras se busca).
export function PlayersPage() {
  const season = useActiveSeason()
  const players = usePublicPlayers(season.data?.id)
  const teams = useTeams(season.data?.id)
  const categories = useCategories()
  const [query, setQuery] = useState('')

  const teamsById = useMemo(
    () => new Map<string, Team>((teams.data ?? []).map((t) => [t.id, t])),
    [teams.data],
  )
  const typeByCode = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.code, c.type])),
    [categories.data],
  )

  const all = players.data ?? []
  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => (q ? all.filter((p) => p.full_name.toLowerCase().includes(q)) : all),
    [all, q],
  )
  const groups = useMemo(
    () => groupRoster(filtered, categories.data ?? []),
    [filtered, categories.data],
  )

  if (season.isLoading) return <Loader label="Cargando…" />

  return (
    <div>
      <PageHeader title="Jugadores" subtitle={`${all.length} en la temporada`} />

      <div className="relative mb-4 mt-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon name="search" size={18} />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar jugador…"
          className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-3 text-base text-slate-900 outline-none focus:border-sky-400"
        />
      </div>

      {players.isLoading ? (
        <Loader label="Cargando jugadores…" />
      ) : players.isError ? (
        <ErrorState onRetry={() => void players.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState icon="account" title="Sin jugadores" description="Aún no hay jugadores en la temporada." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="search" title="Sin resultados" description={`Ningún jugador coincide con “${query}”.`} />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.code} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-sm">
              <div className="flex items-center gap-2 px-4 py-2.5">
                <span className="text-sm font-bold uppercase tracking-wide text-slate-700">{g.name}</span>
                <Badge color={categoryColor(typeByCode.get(g.code))}>{g.code}</Badge>
                <span className="ml-auto text-xs font-medium text-slate-500">{g.players.length}</span>
              </div>
              <ul className="divide-y divide-slate-100 border-t border-slate-200/80">
                {g.players.map((p) => (
                  <PlayerRow key={p.id} player={p} team={p.team_id ? teamsById.get(p.team_id) ?? null : null} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function PlayerRow({ player, team }: { player: PublicPlayer; team: Team | null }) {
  return (
    <li>
      <Link
        to={`/jugadores/${player.id}`}
        className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-100"
      >
        <Avatar name={player.full_name} photoUrl={player.photo_url} color={team?.color} size={44} />
        {/* Capitanía como etiqueta de texto, no como estrella con `title`: en
            móvil no hay hover, así que ⭐/☆ aparecían sin explicación posible.
            Mismo lenguaje que el roster del equipo. */}
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="min-w-0 truncate font-medium text-slate-800">{player.full_name}</span>
          {player.is_captain && <Badge color="amber">Cap.</Badge>}
          {player.is_cocaptain && <Badge color="blue">Co-cap.</Badge>}
        </span>
        <PositionChip position={player.position} />
        {team ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <TeamCrest name={team.name} logoUrl={team.logo_url} color={team.color} size={20} />
            <span className="hidden max-w-[7rem] truncate text-xs text-slate-600 sm:inline">{team.name}</span>
          </span>
        ) : (
          <span className="shrink-0 text-xs text-slate-400">Sin equipo</span>
        )}
        <Icon name="chevron-right" size={16} className="shrink-0 text-slate-400" />
      </Link>
    </li>
  )
}
