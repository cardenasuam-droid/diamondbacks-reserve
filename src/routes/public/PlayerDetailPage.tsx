import type { CSSProperties } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { usePlayerRankings } from '@/features/stats/usePlayerRankings'
import { useCategories } from '@/features/categories/useCategories'
import { categoryColor } from '@/features/categories/categoryColor'
import { teamColor } from '@/lib/color'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

export function PlayerDetailPage() {
  const { playerId } = useParams<{ playerId: string }>()
  const navigate = useNavigate()
  const season = useActiveSeason()
  const players = usePublicPlayers(season.data?.id)
  const teams = useTeams(season.data?.id)
  const categories = useCategories()
  const rankings = usePlayerRankings(teams.data?.map((t) => t.id))

  if (season.isLoading || players.isLoading || teams.isLoading || categories.isLoading) {
    return <Loader label="Cargando jugador…" />
  }
  if (players.isError || teams.isError) {
    return <ErrorState onRetry={() => { players.refetch(); teams.refetch() }} />
  }

  const player = (players.data ?? []).find((p) => p.id === playerId)
  if (!player) {
    return (
      <div>
        <BackLink onClick={() => navigate(-1)} />
        <EmptyState icon="search" title="Jugador no encontrado" />
      </div>
    )
  }

  const team = (teams.data ?? []).find((t) => t.id === player.team_id)
  const category = (categories.data ?? []).find((c) => c.code === player.category_code)
  const stats = (rankings.data ?? []).find((r) => r.player_id === player.id)

  return (
    <div>
      <BackLink onClick={() => navigate(-1)} />

      {/* Encabezado */}
      <div
        className="relative mb-5 overflow-hidden rounded-2xl p-5 text-white shadow-md ring-1 ring-white/10"
        style={{ backgroundColor: teamColor(team?.color, '#334155') }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-white/5" aria-hidden />
        <div className="relative flex items-center gap-4">
          <Avatar name={player.full_name} photoUrl={player.photo_url} color={team?.color} size={72} />
          <div className="min-w-0">
            <h1 className="truncate font-heading text-2xl">{player.full_name}</h1>
            {team && (
              <Link to={`/equipos/${team.id}`} className="mt-0.5 inline-block text-sm text-white/85 underline">
                {team.name}
              </Link>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge color={categoryColor(category?.type)}>{player.category_code}</Badge>
              {player.is_captain && <Badge color="amber">Capitán</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      {stats ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Estadísticas</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Posición" value={`#${stats.position}`} accent i={0} />
            <Stat label="Puntos aportados" value={stats.points_contributed} accent i={1} />
            <Stat label="Partidos" value={stats.matches_played} i={2} />
            <Stat label="% Victorias" value={`${stats.win_percentage}%`} i={3} />
            <Stat label="Ganados" value={stats.matches_won} i={4} />
            <Stat label="Perdidos" value={stats.matches_lost} i={5} />
            <Stat label="Sets ganados" value={stats.sets_won} i={6} />
            <Stat label="Sets perdidos" value={stats.sets_lost} i={7} />
            <Stat label="Dif. sets" value={signed(stats.set_diff)} i={8} />
            <Stat label="Juegos ganados" value={stats.games_won} i={9} />
            <Stat label="Juegos perdidos" value={stats.games_lost} i={10} />
            <Stat label="Dif. juegos" value={signed(stats.game_diff)} i={11} />
          </div>
          <p className="text-xs text-slate-500">
            Cada jugador recibe los puntos que ganó su pareja. Posición dentro del ranking
            individual de la temporada.
          </p>
        </section>
      ) : (
        <EmptyState
          icon="medal"
          title="Aún no ha jugado partidos"
          description="Sus estadísticas aparecerán cuando dispute partidos con resultado validado."
        />
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

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mb-4 inline-flex items-center text-sm font-medium text-sky-300">
      ‹ Volver
    </button>
  )
}
