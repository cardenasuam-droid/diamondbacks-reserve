import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { useContactPhones } from '@/features/teams/usePoolPlayers'
import { useResetPlayerAccount } from '@/features/teams/playerMutations'
import { usePlayerRankings } from '@/features/stats/usePlayerRankings'
import { usePlayerHistory } from '@/features/stats/usePlayerHistory'
import { useCategories } from '@/features/categories/useCategories'
import { categoryColor } from '@/features/categories/categoryColor'
import { scoreLineFor, hasOfficialResult } from '@/features/schedule/score'
import { teamColor } from '@/lib/color'
import { initialsOf } from '@/components/ui/Avatar'
import { imageThumb } from '@/lib/image'
import { PositionChip } from '@/components/ui/PositionChip'
import { RatingChip } from '@/components/ui/RatingChip'
import { TeamCrest } from '@/components/ui/TeamCrest'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Icon } from '@/components/ui/Icon'
import { Loader } from '@/components/ui/Loader'
import { StatTile } from '@/components/ui/StatTile'

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

export function PlayerDetailPage() {
  const { playerId } = useParams<{ playerId: string }>()
  const navigate = useNavigate()
  const { session, role } = useAuth()
  const season = useActiveSeason()
  const players = usePublicPlayers(season.data?.id)
  const teams = useTeams(season.data?.id)
  const categories = useCategories()
  const rankings = usePlayerRankings(teams.data?.map((t) => t.id))
  // Teléfono: la vista players_contact decide quién lo recibe (organizador siempre;
  // capitana solo pool + su equipo). Sin sesión no se consulta: anon no tiene grant.
  const phones = useContactPhones(season.data?.id, Boolean(session))

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
  const phone = phones.data?.[player.id] ?? null

  return (
    <div>
      <BackLink onClick={() => navigate(-1)} />

      {/* Encabezado — la foto es la protagonista, centrada (móvil-primero). El velo
          oscuro garantiza contraste del texto blanco sobre cualquier color de equipo. */}
      <div
        className="relative mb-5 overflow-hidden rounded-3xl px-6 pb-6 pt-7 text-center text-white shadow-md ring-1 ring-white/10"
        style={{ backgroundColor: teamColor(team?.color, '#334155') }}
      >
        {/* Escudo del equipo como marca de agua tenue. */}
        {team?.logo_url && (
          <img
            src={imageThumb(team.logo_url, { width: 300, quality: 50, resize: 'contain' }) ?? team.logo_url}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="pointer-events-none absolute -right-8 -top-10 h-48 w-48 rotate-[14deg] object-contain opacity-[0.12] blur-[1px]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/55" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-col items-center">
          {/* Foto COMPLETA (sin recortar): transform en modo contain + object-contain.
              Se muestra entera y grande, a su proporción real; el velo del banner
              rellena el espacio sobrante sin bordes feos. */}
          {player.photo_url ? (
            <img
              src={
                imageThumb(player.photo_url, { width: 640, height: 800, quality: 74, resize: 'contain' }) ??
                player.photo_url
              }
              alt={player.full_name}
              decoding="async"
              className="pop mx-auto block max-h-[62vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/40"
            />
          ) : (
            <span
              className="pop flex aspect-[3/4] w-full max-w-[240px] items-center justify-center rounded-2xl text-6xl font-bold text-white shadow-2xl ring-1 ring-white/40"
              style={{ backgroundColor: teamColor(team?.color, '#475569') }}
            >
              {initialsOf(player.full_name)}
            </span>
          )}
          <h1 className="mt-4 text-balance font-heading text-[1.7rem] leading-tight">{player.full_name}</h1>
          {team && (
            <Link
              to={`/equipos/${team.id}`}
              className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-white/85 transition hover:opacity-80"
            >
              <span className="rounded-md bg-white/15 p-0.5 ring-1 ring-white/25">
                <TeamCrest name={team.name} logoUrl={team.logo_url} color={team.color} size={18} />
              </span>
              <span className="underline">{team.name}</span>
            </Link>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Badge color={categoryColor(category?.type)}>{player.category_code}</Badge>
            {player.is_captain && <Badge color="amber">Capitán</Badge>}
            {player.is_cocaptain && <Badge color="blue">Co-capitán</Badge>}
            {/* Lado de juego: dato deportivo público (players_public, 0026). */}
            <PositionChip position={player.position} />
            {/* Rating ELO (0039). Va aquí y NO en la rejilla de estadísticas de
                abajo porque esa rejilla solo se pinta cuando el jugador ya tiene
                resultados: el rating existe desde antes de la primera jornada. */}
            <RatingChip rating={player.rating} matches={player.rating_matches} size="lg" />
          </div>
        </div>
      </div>

      {/* Contacto: solo lo ve quien la vista players_contact autoriza (organizador
          siempre; capitana para el pool y su propio equipo). Nunca el público. */}
      {phone && (
        <section className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
            <Icon name="account" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">Teléfono</p>
            <a href={`tel:${phone}`} className="text-sm font-medium text-sky-600 underline">
              {phone}
            </a>
          </div>
        </section>
      )}

      {/* Estadísticas */}
      {stats ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Estadísticas</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Posición" value={`#${stats.position}`} accent i={0} />
            <StatTile label="Puntos aportados" value={stats.points_contributed} accent i={1} />
            <StatTile label="Partidos" value={stats.matches_played} i={2} />
            <StatTile label="% Victorias" value={`${stats.win_percentage}%`} i={3} />
            <StatTile label="Ganados" value={stats.matches_won} i={4} />
            <StatTile label="Perdidos" value={stats.matches_lost} i={5} />
            <StatTile label="Sets ganados" value={stats.sets_won} i={6} />
            <StatTile label="Sets perdidos" value={stats.sets_lost} i={7} />
            <StatTile label="Dif. sets" value={signed(stats.set_diff)} i={8} />
            <StatTile label="Juegos ganados" value={stats.games_won} i={9} />
            <StatTile label="Juegos perdidos" value={stats.games_lost} i={10} />
            <StatTile label="Dif. juegos" value={signed(stats.game_diff)} i={11} />
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

      {/* Historial de juegos: cada partido donde fue alineado (rol publicado),
          con su pareja, la pareja rival y el marcador desde su lado. */}
      <HistorySection
        playerId={player.id}
        seasonId={season.data?.id}
        playerName={player.full_name}
        nameOf={(id) => (id ? (players.data ?? []).find((p) => p.id === id)?.full_name ?? '—' : '—')}
      />

      {role === 'organizer' && <ResetAccountCard playerId={player.id} name={player.full_name} />}
    </div>
  )
}

// Historial de juegos del jugador: una fila por partido donde fue alineado
// (solo rol publicado), clicable hacia /partidos/:id. El marcador se muestra
// desde el lado de SU pareja (scoreLineFor voltea los sets si su equipo es el B)
// y se colorea por ganado/perdido. Si no hay historial, la sección no se pinta
// (el EmptyState de estadísticas ya cubre el mensaje).
function HistorySection({
  playerId,
  seasonId,
  playerName,
  nameOf,
}: {
  playerId: string
  seasonId: string | undefined
  playerName: string
  nameOf: (id: string | null) => string
}) {
  const history = usePlayerHistory(playerId, seasonId)

  if (!seasonId) return null
  if (history.isError) {
    return (
      <section className="mt-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Historial de juegos</h2>
        <ErrorState onRetry={() => history.refetch()} />
      </section>
    )
  }
  if (history.isPending) {
    return (
      <section className="mt-5">
        <Loader label="Cargando historial…" />
      </section>
    )
  }
  const items = history.data
  if (items.length === 0) return null

  return (
    <section className="mt-5 space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Historial de juegos</h2>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
        {items.map((it) => {
          const official = hasOfficialResult(it.result)
          const scoreClass = official
            ? it.won === true
              ? 'text-emerald-300'
              : it.won === false
                ? 'text-rose-300'
                : 'text-slate-900'
            : 'text-slate-500'
          return (
            <li key={it.matchId}>
              <Link to={`/partidos/${it.matchId}`} className="block px-3 py-2 transition hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-xs font-semibold text-slate-500">J{it.roundNumber}</span>
                  <Badge color={categoryColor(it.categoryType ?? undefined)}>{it.categoryCode}</Badge>
                  {it.isException && (
                    <span className="text-xs" title="Excepción a la regla">
                      ⚠️
                    </span>
                  )}
                  <span className={`ml-auto shrink-0 text-sm font-semibold tabular-nums ${scoreClass}`}>
                    {official ? scoreLineFor(it.result!, it.isTeamA) : 'Pendiente'}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 text-xs text-slate-600">
                  <span className="min-w-0 truncate">
                    {it.partnerId ? `${playerName} · ${nameOf(it.partnerId)}` : playerName}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">vs</span>
                  <span className="flex min-w-0 items-center justify-end gap-1.5">
                    <TeamCrest
                      name={it.opponent.name}
                      logoUrl={it.opponent.logo_url}
                      color={it.opponent.color}
                      size={14}
                    />
                    <span className="min-w-0 truncate text-right">
                      {it.rivalIds.length ? it.rivalIds.map((id) => nameOf(id)).join(' · ') : 'Por definir'}
                    </span>
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-slate-500">
        Solo alineaciones publicadas. El marcador se lee desde el lado de su pareja; toca un juego para ver el
        detalle.
      </p>
    </section>
  )
}

// Reinicio de acceso (solo organizador): borra la cuenta de Auth (RPC
// reset_player_account, 0025) y el jugador vuelve al primer acceso (nombre →
// últimos 4 dígitos del teléfono → nueva contraseña). No toca datos deportivos.
function ResetAccountCard({ playerId, name }: { playerId: string; name: string }) {
  const reset = useResetPlayerAccount()
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState<'reset' | 'no_account' | null>(null)

  return (
    <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="text-sm font-semibold text-amber-800">Acceso del jugador</p>
      <p className="mt-0.5 text-xs text-amber-700">
        Reinicia su contraseña: volverá a crearla con los últimos 4 dígitos de su teléfono en su próximo acceso.
      </p>

      {done === 'reset' ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Listo. {name} deberá crear una nueva contraseña en su próximo acceso.
        </p>
      ) : done === 'no_account' ? (
        <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          {name} aún no tiene cuenta creada; no hay nada que reiniciar.
        </p>
      ) : confirm ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="flex-1 text-sm text-amber-800">¿Reiniciar la contraseña de {name}?</span>
          <button
            onClick={() =>
              reset.mutate(playerId, {
                onSuccess: (res) => {
                  setConfirm(false)
                  setDone(res.reason === 'no_account' ? 'no_account' : 'reset')
                },
              })
            }
            disabled={reset.isPending}
            className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {reset.isPending ? 'Reiniciando…' : 'Sí, reiniciar'}
          </button>
          <button onClick={() => setConfirm(false)} className="rounded-lg px-3 py-2 text-sm text-slate-500">
            No
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
        >
          Reiniciar contraseña
        </button>
      )}

      {reset.isError && (
        <p className="mt-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-700">
          {(reset.error as Error).message}
        </p>
      )}
    </section>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mb-4 inline-flex items-center text-sm font-medium text-sky-300">
      ‹ Volver
    </button>
  )
}
