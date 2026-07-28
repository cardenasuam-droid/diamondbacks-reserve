import { useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { useStandings } from '@/features/standings/useStandings'
import { usePlayerRankings } from '@/features/stats/usePlayerRankings'
import { rankByRating, topByCategory, type RatingRow } from '@/features/rating/rankByRating'
import { filterStatsRows } from '@/features/stats/filterRows'
import { StatsFilters } from '@/features/stats/StatsFilters'
import { useCategories } from '@/features/categories/useCategories'
import { categoryColor } from '@/features/categories/categoryColor'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { TeamCrest } from '@/components/ui/TeamCrest'
import type { MatchCategory, Team } from '@/lib/types'

type Tab = 'jugadores' | 'equipos' | 'rating'

const TABS: Tab[] = ['jugadores', 'equipos', 'rating']

export function StatsPage() {
  const [params, setParams] = useSearchParams()
  const desdeUrl = params.get('tab')
  const initial: Tab = TABS.includes(desdeUrl as Tab) ? (desdeUrl as Tab) : 'jugadores'
  const [tab, setTab] = useState<Tab>(initial)

  const season = useActiveSeason()
  const teams = useTeams(season.data?.id)
  const teamIds = teams.data?.map((t) => t.id)

  function selectTab(t: Tab) {
    setTab(t)
    setParams(t === 'jugadores' ? {} : { tab: t }, { replace: true })
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
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => selectTab(t)}
            aria-pressed={tab === t}
            className={
              // min-h 44px: PRODUCT.md exige táctiles de al menos 44px y estas
              // pestañas medían 30 — el objetivo más pulsado de la pantalla.
              'min-h-[44px] rounded-md px-4 text-sm font-medium capitalize transition ' +
              (tab === t ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'jugadores' && <PlayersTab teamIds={teamIds} teams={teams} seasonId={season.data.id} />}
      {tab === 'equipos' && <TeamsTab seasonId={season.data.id} teams={teams} />}
      {tab === 'rating' && <RatingTab seasonId={season.data.id} teams={teams} />}
    </div>
  )
}

function PlayersTab({
  teamIds,
  teams,
  seasonId,
}: {
  teamIds: string[] | undefined
  teams: ReturnType<typeof useTeams>
  seasonId: string
}) {
  const ranking = usePlayerRankings(teamIds)
  const categories = useCategories()
  const players = usePublicPlayers(seasonId)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [teamId, setTeamId] = useState('')

  const todos = ranking.data ?? []
  const filtrados = useMemo(
    () => filterStatsRows(todos, { query, category, teamId }),
    [todos, query, category, teamId],
  )

  if (ranking.isLoading || teams.isLoading) return <Loader label="Cargando ranking…" />
  if (ranking.isError) return <ErrorState onRetry={() => ranking.refetch()} />
  if (todos.length === 0) {
    return <EmptyState icon="medal" title="Sin ranking todavía" description="Se llena cuando hay alineaciones y resultados." />
  }

  const teamById = new Map((teams.data ?? []).map((t) => [t.id, t]))
  const photoById = new Map((players.data ?? []).map((p) => [p.id, p.photo_url]))
  const typeOf = new Map((categories.data ?? []).map((c) => [c.code, c.type]))

  return (
    <div>
      <StatsFilters
        query={query}
        onQuery={setQuery}
        category={category}
        onCategory={setCategory}
        teamId={teamId}
        onTeam={setTeamId}
        categories={(categories.data ?? []).filter((c) => c.is_ranking)}
        teams={teams.data ?? []}
        total={todos.length}
        shown={filtrados.length}
      />

      {filtrados.length === 0 ? (
        <EmptyState icon="search" title="Sin resultados" description="Ningún jugador coincide con los filtros." />
      ) : (
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
          {filtrados.map((p) => {
            const team = teamById.get(p.team_id)
            return (
              <tr key={p.player_id} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-2.5 text-center font-semibold text-slate-500">{p.position}</td>
                <td className="px-2 py-2.5">
                  <Link to={`/jugadores/${p.player_id}`} className="flex items-center gap-2 hover:opacity-70">
                    <Avatar name={p.full_name} photoUrl={photoById.get(p.player_id)} color={team?.color} size={28} />
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
      )}
    </div>
  )
}

// Ranking global por rating ELO (0039). Mezcla las 8 categorías en una sola tabla
// a propósito: la escalera de siembra es una escala absoluta (FEM_5 y VAR_6
// arrancan ambos en 1500), así que los números son comparables entre categorías.
// Los jugadores en lista de espera no salen: players_public les devuelve rating
// null por decisión del organizador, y rankByRating los descarta.
function RatingTab({ seasonId, teams }: { seasonId: string; teams: ReturnType<typeof useTeams> }) {
  const players = usePublicPlayers(seasonId)
  const categories = useCategories()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [teamId, setTeamId] = useState('')

  // Se ordena ANTES de filtrar: así la posición mostrada es la del ranking
  // completo. Filtrar por categoría y ver "#1, #2, #3" sería una posición
  // inventada que no existe en la tabla real.
  const todas = useMemo(() => rankByRating(players.data ?? []), [players.data])
  const filas = useMemo(
    () => filterStatsRows(todas, { query, category, teamId }),
    [todas, query, category, teamId],
  )

  // Vista por defecto (sin ningún filtro): dashboard con el podio de cada
  // categoría. Al buscar o filtrar, se pasa a la tabla plana.
  const sinFiltros = query.trim() === '' && category === '' && teamId === ''
  const podios = useMemo(() => topByCategory(todas, 3), [todas])

  if (players.isLoading || teams.isLoading) return <Loader label="Cargando rating…" />
  if (players.isError) return <ErrorState onRetry={() => players.refetch()} />

  if (todas.length === 0) {
    return (
      <EmptyState
        icon="medal"
        title="Sin rating todavía"
        description="Aparecerá cuando se carguen los puntos iniciales de los jugadores."
      />
    )
  }

  const teamById = new Map((teams.data ?? []).map((t) => [t.id, t]))
  const photoById = new Map((players.data ?? []).map((p) => [p.id, p.photo_url]))
  const typeOf = new Map((categories.data ?? []).map((c) => [c.code, c.type]))

  return (
    <div className="space-y-3">
      <StatsFilters
        query={query}
        onQuery={setQuery}
        category={category}
        onCategory={setCategory}
        teamId={teamId}
        onTeam={setTeamId}
        categories={(categories.data ?? []).filter((c) => c.is_ranking)}
        teams={teams.data ?? []}
        total={todas.length}
        shown={filas.length}
      />

      {sinFiltros ? (
        <RatingDashboard
          podios={podios}
          categories={(categories.data ?? []).filter((c) => c.is_ranking)}
          teamById={teamById}
          photoById={photoById}
        />
      ) : filas.length === 0 ? (
        <EmptyState icon="search" title="Sin resultados" description="Ningún jugador coincide con los filtros." />
      ) : (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2.5 text-center font-semibold">#</th>
              <th className="px-2 py-2.5 text-left font-semibold">Jugador</th>
              {/* PJ visible también en móvil: es el matiz que dice si el rating
                  ya lo movió la cancha o sigue siendo el inicial. */}
              <th className="px-2 py-2.5 text-center font-semibold">PJ</th>
              <th className="px-2 py-2.5 text-center font-semibold">Rating</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const team = f.team_id ? teamById.get(f.team_id) : undefined
              return (
                <tr key={f.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-2.5 text-center font-semibold text-slate-500">{f.position}</td>
                  <td className="px-2 py-2.5">
                    <Link to={`/jugadores/${f.id}`} className="flex items-center gap-2 hover:opacity-70">
                      <Avatar name={f.full_name} photoUrl={photoById.get(f.id)} color={team?.color} size={28} />
                      <span className="font-medium text-slate-800">{f.full_name}</span>
                      <Badge color={categoryColor(typeOf.get(f.category_code))}>{f.category_code}</Badge>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-600">
                    {f.rating_matches}
                  </td>
                  <td className="px-2 py-2.5 text-center font-bold tabular-nums text-slate-900">
                    {f.rating}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      <p className="text-xs text-slate-500">
        El rating mide nivel de juego, no resultados: sube al ganarle a parejas mejor valoradas y baja al
        perder contra las de menos. El marcador influye en cuánto se mueve.
      </p>
    </div>
  )
}

// Dashboard de rating: el podio (top 3) de cada categoría de ranking, en el orden
// del catálogo. Es la vista de entrada de la pestaña; buscar o filtrar la
// reemplaza por la tabla plana.
function RatingDashboard({
  podios,
  categories,
  teamById,
  photoById,
}: {
  podios: Map<string, RatingRow[]>
  categories: MatchCategory[]
  teamById: Map<string, Team>
  photoById: Map<string, string | null>
}) {
  const conJugadores = categories.filter((c) => (podios.get(c.code)?.length ?? 0) > 0)
  if (conJugadores.length === 0) {
    return <EmptyState icon="medal" title="Sin rating todavía" />
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {conJugadores.map((cat) => (
        <section
          key={cat.code}
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-sm font-bold text-slate-800">{cat.name}</span>
            <Badge color={categoryColor(cat.type)}>{cat.code}</Badge>
          </div>
          <ul className="divide-y divide-slate-100">
            {(podios.get(cat.code) ?? []).map((p) => {
              const team = p.team_id ? teamById.get(p.team_id) : undefined
              return (
                <li key={p.id}>
                  <Link to={`/jugadores/${p.id}`} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50">
                    <PodiumMedal position={p.position} />
                    <Avatar name={p.full_name} photoUrl={photoById.get(p.id) ?? undefined} color={team?.color} size={30} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{p.full_name}</span>
                    <span className="shrink-0 font-bold tabular-nums text-slate-900">{p.rating}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

// Medalla de posición: oro (1º), plata (2º), bronce (3º). Con empate, varios
// jugadores comparten posición y por tanto medalla (tres “1º” = nadie separado).
function PodiumMedal({ position }: { position: number }) {
  const estilo =
    position === 1
      ? 'bg-gold-500/20 text-gold-300 ring-gold-500/40'
      : position === 2
        ? 'bg-slate-300/20 text-slate-200 ring-white/20'
        : position === 3
          ? 'bg-amber-700/25 text-amber-300 ring-amber-600/40'
          : 'bg-slate-200/70 text-slate-500 ring-white/10'
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset ${estilo}`}
      aria-label={`Posición ${position}`}
    >
      {position}
    </span>
  )
}

function TeamsTab({ seasonId, teams }: { seasonId: string; teams: ReturnType<typeof useTeams> }) {
  const standings = useStandings(seasonId)
  const logoById = new Map((teams.data ?? []).map((t) => [t.id, t.logo_url]))

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
                  <TeamCrest name={t.team_name} logoUrl={logoById.get(t.team_id)} color={t.color} size={24} />
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
