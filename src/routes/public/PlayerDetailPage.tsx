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
        <EmptyState icon="🔍" title="Jugador no encontrado" />
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
        className="mb-5 flex items-center gap-4 rounded-2xl p-5 text-white shadow-sm"
        style={{ backgroundColor: teamColor(team?.color, '#334155') }}
      >
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

      {/* Estadísticas */}
      {stats ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Estadísticas</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Posición" value={`#${stats.position}`} accent />
            <Stat label="Puntos aportados" value={stats.points_contributed} accent />
            <Stat label="Partidos" value={stats.matches_played} />
            <Stat label="% Victorias" value={`${stats.win_percentage}%`} />
            <Stat label="Ganados" value={stats.matches_won} />
            <Stat label="Perdidos" value={stats.matches_lost} />
            <Stat label="Dif. sets" value={signed(stats.set_diff)} />
            <Stat label="Dif. juegos" value={signed(stats.game_diff)} />
          </div>
          <p className="text-xs text-slate-500">
            Cada jugador recibe los puntos que ganó su pareja. Posición dentro del ranking
            individual de la temporada.
          </p>
        </section>
      ) : (
        <EmptyState
          icon="🎾"
          title="Aún no ha jugado partidos"
          description="Sus estadísticas aparecerán cuando dispute partidos con resultado validado."
        />
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={'mt-1 text-2xl font-bold tabular-nums ' + (accent ? 'text-gold-600' : 'text-slate-900')}>
        {value}
      </p>
    </div>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mb-4 inline-flex items-center text-sm font-medium text-sky-600">
      ‹ Volver
    </button>
  )
}
