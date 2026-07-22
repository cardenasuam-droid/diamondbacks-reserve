import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useMatchDetail } from '@/features/schedule/useMatchDetail'
import { usePublishedLineups, publishedKey, type PublishedPair } from '@/features/lineups/usePublishedLineups'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { MatchupHeader } from '@/features/schedule/MatchupHeader'
import { categoryColor } from '@/features/categories/categoryColor'
import { scoreLine, hasOfficialResult } from '@/features/schedule/score'
import { teamColor } from '@/lib/color'
import { formatRoundDate } from '@/lib/date'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import type { PublicPlayer } from '@/lib/types'
import type { TeamLite, MatchResultLite } from '@/features/schedule/types'

// Estado del partido DERIVADO de su resultado, no de matches.status: esa columna
// nace en 'scheduled' y nadie la actualiza jamás (330 filas así), por lo que la
// pantalla mostraba "Programado" junto a un marcador oficial.
function estadoDelPartido(result: MatchResultLite | null | undefined): {
  label: string
  color: 'emerald' | 'amber' | 'slate'
} {
  if (result?.is_walkover) return { label: 'Walkover', color: 'amber' }
  // Reportado por la capitana (0043): aún no cuenta para tabla ni rating. Se
  // comprueba ANTES que hasOfficialResult: su rama negativa estrecha result a
  // never y el acceso a .status no compilaría.
  if (result?.status === 'reported') return { label: 'Por validar', color: 'amber' }
  if (hasOfficialResult(result)) return { label: 'Finalizado', color: 'emerald' }
  return { label: 'Programado', color: 'slate' }
}

// Pantalla PÚBLICA del partido (/partidos/:matchId): a ella llegan las tarjetas
// del rol. Muestra jornada, equipos, categoría, horario/cancha, las alineaciones
// publicadas (con ⚠️ si hubo excepción a la regla) y el marcador si ya es oficial.
export function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const season = useActiveSeason()
  const match = useMatchDetail(matchId)
  const published = usePublishedLineups(match.data?.round_id)
  const players = usePublicPlayers(season.data?.id)

  const playersById = useMemo(
    () => new Map<string, PublicPlayer>((players.data ?? []).map((p) => [p.id, p])),
    [players.data],
  )

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/rol')
  }

  if (match.isLoading) return <Loader label="Cargando partido…" />
  if (match.isError) return <ErrorState onRetry={() => match.refetch()} />

  const m = match.data
  if (!m) {
    return (
      <div className="space-y-4">
        <BackLink onClick={goBack} />
        <EmptyState icon="schedule" title="Partido no encontrado" />
      </div>
    )
  }

  const teamA = m.matchup?.team_a ?? null
  const teamB = m.matchup?.team_b ?? null
  const pairA =
    m.matchup && teamA ? published.data?.get(publishedKey(m.matchup.id, teamA.id, m.category_code)) : undefined
  const pairB =
    m.matchup && teamB ? published.data?.get(publishedKey(m.matchup.id, teamB.id, m.category_code)) : undefined
  const official = hasOfficialResult(m.result)
  const winner =
    m.result?.winner_team_id === teamA?.id ? teamA : m.result?.winner_team_id === teamB?.id ? teamB : null

  return (
    <div className="space-y-4">
      <BackLink onClick={goBack} />

      {/* Encabezado: equipos + datos del juego */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
        <MatchupHeader teamA={teamA} teamB={teamB} />
        <div className="space-y-1.5 px-4 py-3 text-sm text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={categoryColor(m.category?.type)}>{m.category_code}</Badge>
            <span className="font-medium text-slate-800">{m.category?.name}</span>
            <span className="ml-auto">
              <Badge color={estadoDelPartido(m.result).color}>{estadoDelPartido(m.result).label}</Badge>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            {m.round && (
              <span>
                Jornada {m.round.round_number}
                {formatRoundDate(m.round.round_date) ? ` · ${formatRoundDate(m.round.round_date)}` : ''}
              </span>
            )}
            <span>
              {m.time_block?.label ?? '—'} · {m.court?.name ?? 'Cancha por definir'}
            </span>
          </div>
        </div>
      </section>

      {/* Marcador oficial */}
      {official && (
        <section className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-center shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Marcador</p>
          {/* Sin color de ganador cae a la tinta del tema (text-slate-900): el hex
              inline solo cuando hay color de equipo (tema oscuro, 0 hardcodes). */}
          <p
            className="mt-1 text-2xl font-bold tabular-nums text-slate-900"
            style={winner?.color ? { color: teamColor(winner.color, '#f1f6f0') } : undefined}
          >
            {scoreLine(m.result!)}
          </p>
          {winner && <p className="mt-1 text-sm text-slate-600">Ganó {winner.name}</p>}
        </section>
      )}

      {/* Alineaciones publicadas */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
        <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">
          Alineaciones
        </p>
        {/* Estados en orden: error → cargando → datos. Nunca afirmar "sin
            alineaciones" ni "Por definir" cuando en realidad falló o falta cargar
            una query (isPending cubre también las queries aún deshabilitadas en
            cascada — season → players —, que en TanStack v5 no cuentan como
            isLoading). */}
        {season.isError || published.isError || players.isError ? (
          <div className="p-4">
            <ErrorState
              onRetry={() => {
                if (season.isError) void season.refetch()
                if (published.isError) void published.refetch()
                if (players.isError) void players.refetch()
              }}
            />
          </div>
        ) : published.isPending || players.isPending ? (
          <div className="p-4">
            <Loader label="Cargando alineaciones…" />
          </div>
        ) : pairA || pairB ? (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-3">
            <PairColumn pair={pairA} team={teamA} playersById={playersById} align="left" />
            <span className="text-xs font-medium text-slate-400">vs</span>
            <PairColumn pair={pairB} team={teamB} playersById={playersById} align="right" />
          </div>
        ) : (
          <p className="p-4 text-sm text-slate-500">
            Aún sin alineaciones publicadas. Se publican el sábado a las 07:00 antes de la jornada.
          </p>
        )}
      </section>
    </div>
  )
}

// La pareja de un equipo, alineada hacia su lado (igual que el encabezado:
// equipo A a la izquierda, equipo B a la derecha). ⚠️ = excepción a la regla.
function PairColumn({
  pair,
  team,
  playersById,
  align,
}: {
  pair: PublishedPair | undefined
  team: TeamLite | null
  playersById: Map<string, PublicPlayer>
  align: 'left' | 'right'
}) {
  // Sin pareja publicada, o publicada pero sin nadie asignado (categoría que el
  // cierre no pudo llenar): mismo mensaje honesto.
  if (!pair || (!pair.player_1_id && !pair.player_2_id)) {
    return (
      <p className={`text-xs text-slate-400 ${align === 'right' ? 'text-right' : ''}`}>Sin alineación</p>
    )
  }
  return (
    <div className="min-w-0 space-y-0.5">
      {pair.is_exception && (
        <p className={`text-[10px] font-medium text-amber-600 ${align === 'right' ? 'text-right' : ''}`}>
          ⚠️ Excepción a la regla
        </p>
      )}
      {[pair.player_1_id, pair.player_2_id].map((id, i) => (
        <PlayerLine key={id ?? i} player={id ? playersById.get(id) : undefined} team={team} align={align} />
      ))}
    </div>
  )
}

function PlayerLine({
  player,
  team,
  align,
}: {
  player: PublicPlayer | undefined
  team: TeamLite | null
  align: 'left' | 'right'
}) {
  // py-1.5 + avatar de 28 ≈ 40px de alto: área táctil digna en móvil.
  const layout = `flex items-center gap-2 py-1.5 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`
  if (!player) {
    return (
      <p className={layout}>
        <span className="h-7 w-7 shrink-0 rounded-full bg-slate-200 ring-1 ring-black/10" aria-hidden />
        <span className="text-xs text-slate-400">Por definir</span>
      </p>
    )
  }
  return (
    <Link to={`/jugadores/${player.id}`} className={`${layout} transition hover:opacity-70`}>
      <Avatar name={player.full_name} photoUrl={player.photo_url} color={team?.color} size={28} />
      <span className="min-w-0 truncate text-xs font-medium text-slate-700 underline decoration-transparent hover:decoration-inherit">
        {player.full_name}
      </span>
    </Link>
  )
}

// Misma convención que PlayerDetailPage.
function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center text-sm font-medium text-sky-300">
      ‹ Volver
    </button>
  )
}
