import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { roleLabel } from '@/features/auth/roles'
import { isPlayerAuthEmail } from '@/features/auth/playerAuth'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { useMyPlayer } from '@/features/teams/useMyPlayer'
import { usePlayerRankings } from '@/features/stats/usePlayerRankings'
import { useTeamUpcomingMatchups, type UpcomingMatchup } from '@/features/schedule/useTeamUpcomingMatchups'
import { useSetMyPhoto, useSetMyShirtSize } from '@/features/teams/playerMutations'
import { teamColor } from '@/lib/color'
import { formatRoundDate } from '@/lib/date'
import type { UserRole } from '@/lib/types'
import { Avatar } from '@/components/ui/Avatar'
import { TeamCrest } from '@/components/ui/TeamCrest'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Loader } from '@/components/ui/Loader'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatTile } from '@/components/ui/StatTile'
import { ShirtSizePicker } from '@/components/ui/ShirtSizePicker'

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

// Dashboard del jugador (landing tras login). Contenido personalizado: identidad,
// próximos juegos de su equipo y sus estadísticas. La navegación vive en el drawer,
// no aquí (sin rejilla de botones).
export function AccountPage() {
  const { user, profile, profileLoading, role } = useAuth()

  if (profileLoading) return <Loader label="Cargando tu cuenta…" />

  const linked = Boolean(profile?.player_id)
  const playerId = profile?.player_id ?? undefined

  return (
    <div className="space-y-6">
      <GreetingHeader name={profile?.full_name ?? null} role={role} playerId={playerId} />

      {isPlayerAuthEmail(user?.email) && !linked && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/15 p-4 text-sm text-amber-200">
          Tu cuenta entró pero no está enlazada a una ficha de jugador. Avisa al organizador.
        </section>
      )}

      {linked && playerId && (
        <>
          <NextGamesSection playerId={playerId} />
          <MyStatsSection playerId={playerId} />
          <PhotoSection playerId={playerId} name={profile?.full_name ?? 'Jugador'} />
          <ShirtSizeSection playerId={playerId} />
        </>
      )}

      {(role === 'captain' || role === 'organizer') && (
        <Link
          to="/app/capitan"
          className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-100 to-slate-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/30">
            <Icon name="captain" size={20} />
          </span>
          <span className="flex-1">
            <span className="block font-medium text-slate-800">Panel de capitán</span>
            <span className="block text-xs text-slate-500">Arma y envía la alineación de tu equipo</span>
          </span>
          <Icon name="chevron-right" size={18} className="text-slate-300" />
        </Link>
      )}
    </div>
  )
}

// Encabezado con la identidad del jugador, teñido con el color de su equipo (mismo
// lenguaje que el perfil público). Para staff sin ficha, cae a esmeralda de marca.
function GreetingHeader({
  name,
  role,
  playerId,
}: {
  name: string | null
  role: UserRole | null
  playerId?: string
}) {
  const season = useActiveSeason()
  const players = usePublicPlayers(season.data?.id)
  const teams = useTeams(season.data?.id)
  const me = players.data?.find((p) => p.id === playerId)
  const team = teams.data?.find((t) => t.id === me?.team_id)

  return (
    <section
      className="rise relative overflow-hidden rounded-3xl p-6 text-white shadow-md ring-1 ring-white/10"
      style={{ backgroundColor: teamColor(team?.color, '#0a3d29') }}
    >
      {/* Escudo del equipo como marca de agua tenue (si tiene logo). */}
      {team?.logo_url && (
        <img
          src={team.logo_url}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-7 -top-9 h-44 w-44 rotate-[14deg] object-contain opacity-[0.14] blur-[1px]"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/25 to-white/5" aria-hidden />
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-gold-500/25 blur-3xl"
        aria-hidden
      />
      <div className="relative flex items-center gap-5">
        <span className="pop shrink-0 rounded-full bg-white/15 p-1 shadow-xl ring-1 ring-white/30">
          {me ? (
            <Avatar name={me.full_name} photoUrl={me.photo_url} color={team?.color} size={72} />
          ) : (
            <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/10">
              <Icon name="account" size={34} className="text-white" />
            </span>
          )}
        </span>
        <div className="min-w-0">
          {role && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {roleLabel(role)}
            </p>
          )}
          <h1 className="truncate font-heading text-2xl leading-tight">
            Hola{name ? `, ${name}` : ''}
          </h1>
          {me && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge color="amber">{me.category_code}</Badge>
              {me.is_captain && <Badge color="emerald">Capitán</Badge>}
              {team && (
                <span className="inline-flex items-center gap-1.5 text-sm text-white/85">
                  <span className="rounded-md bg-white/15 p-0.5 ring-1 ring-white/25">
                    <TeamCrest name={team.name} logoUrl={team.logo_url} color={team.color} size={18} />
                  </span>
                  {team.name}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// Próximos juegos del equipo del jugador (rol publicado). Personalizado: solo su
// equipo, ordenado por jornada, con el más próximo destacado.
function NextGamesSection({ playerId }: { playerId: string }) {
  const season = useActiveSeason()
  const players = usePublicPlayers(season.data?.id)
  const me = players.data?.find((p) => p.id === playerId)
  const upcoming = useTeamUpcomingMatchups(me?.team_id, season.data?.id)

  const games = upcoming.data ?? []

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Próximos juegos</h2>
        <Link to="/rol" className="text-xs font-semibold text-sky-300 hover:underline">
          Ver rol →
        </Link>
      </div>

      {upcoming.isLoading ? (
        <div className="skeleton h-[88px] rounded-2xl" />
      ) : games.length === 0 ? (
        <Card className="p-5 text-sm text-slate-500">
          Aún no hay rol publicado. Cuando el organizador publique tus próximos juegos, aparecerán aquí.
        </Card>
      ) : (
        <div className="space-y-3">
          {games.slice(0, 3).map((g, i) => (
            <NextGameCard key={g.id} game={g} featured={i === 0} i={i} />
          ))}
        </div>
      )}
    </section>
  )
}

function NextGameCard({ game, featured, i }: { game: UpcomingMatchup; featured?: boolean; i: number }) {
  const date = formatRoundDate(game.round.round_date)
  return (
    <div
      className={
        'rise-item flex items-center gap-3 rounded-2xl p-4 shadow-sm ' +
        (featured ? 'bg-gradient-to-br from-brand-600/15 to-slate-100 ring-1 ring-brand-500/30' : 'bg-slate-100')
      }
      style={{ ['--d']: i } as CSSProperties}
    >
      <TeamCrest
        name={game.opponent.name}
        logoUrl={game.opponent.logo_url}
        color={game.opponent.color}
        size={40}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {featured && <Badge color="emerald">Próximo</Badge>}
          <span className="text-xs font-medium text-slate-500">Jornada {game.round.round_number}</span>
        </div>
        <p className="mt-0.5 truncate font-semibold text-slate-900">
          <span className="font-normal text-slate-500">vs</span> {game.opponent.name}
        </p>
      </div>
      <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-800">
        {date ?? 'Por confirmar'}
      </p>
    </div>
  )
}

// Estadísticas del jugador (vista player_rankings). Subconjunto curado para el
// dashboard; el perfil público tiene el detalle completo.
function MyStatsSection({ playerId }: { playerId: string }) {
  const season = useActiveSeason()
  const teams = useTeams(season.data?.id)
  const rankings = usePlayerRankings(teams.data?.map((t) => t.id))
  const stats = rankings.data?.find((r) => r.player_id === playerId)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Mis estadísticas</h2>
        <Link to={`/jugadores/${playerId}`} className="text-xs font-semibold text-sky-300 hover:underline">
          Ver perfil →
        </Link>
      </div>

      {rankings.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-[74px] rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Posición" value={`#${stats.position}`} accent i={0} />
            <StatTile label="Puntos aportados" value={stats.points_contributed} accent i={1} />
            <StatTile label="% Victorias" value={`${stats.win_percentage}%`} i={2} />
            <StatTile label="Partidos" value={stats.matches_played} i={3} />
            <StatTile label="Ganados" value={stats.matches_won} i={4} />
            <StatTile label="Dif. sets" value={signed(stats.set_diff)} i={5} />
          </div>
          <p className="text-xs text-slate-500">
            Recibes los puntos que ganó tu pareja. Posición dentro del ranking individual de la temporada.
          </p>
        </>
      ) : (
        <EmptyState
          icon="medal"
          title="Aún no has jugado partidos"
          description="Tus estadísticas aparecerán cuando disputes partidos con resultado validado."
        />
      )}
    </section>
  )
}

function PhotoSection({ playerId, name }: { playerId: string; name: string }) {
  const season = useActiveSeason()
  const players = usePublicPlayers(season.data?.id)
  const me = players.data?.find((p) => p.id === playerId)
  const setPhoto = useSetMyPhoto()
  const [preview, setPreview] = useState<string | null>(null)
  const photo = preview ?? me?.photo_url ?? null

  async function onFile(file: File | undefined) {
    if (!file) return
    const url = await setPhoto.mutateAsync(file)
    setPreview(url)
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-100 to-slate-50 p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Tu foto</h2>
      <p className="mt-1 text-xs text-slate-500">
        Aparecerá en el roster de tu equipo y en tu perfil de jugador.
      </p>
      <div className="mt-4 flex items-center gap-4">
        <Avatar name={name} photoUrl={photo} size={64} />
        <label className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          {setPhoto.isPending ? 'Subiendo…' : photo ? 'Cambiar foto' : 'Subir foto'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={setPhoto.isPending}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      </div>
      {setPhoto.isError && (
        <p className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
          {(setPhoto.error as Error).message}
        </p>
      )}
    </section>
  )
}

// Talla de playera del propio jugador (self-service). Útil para quienes se
// inscribieron antes de que el campo existiera.
function ShirtSizeSection({ playerId }: { playerId: string }) {
  const me = useMyPlayer(playerId)
  const setSize = useSetMyShirtSize()
  const current = me.data?.shirt_size ?? null

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-100 to-slate-50 p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Talla de playera</h2>
      <p className="mt-1 text-xs text-slate-500">
        Para tu playera de la liga (solo la ven tú, tu capitán y el organizador).{' '}
        {current ? `Tu talla: ${current}.` : 'Aún no la has elegido.'}
      </p>
      <div className="mt-4">
        <ShirtSizePicker
          value={current}
          disabled={setSize.isPending}
          onChange={(s) => setSize.mutate(s)}
        />
      </div>
      {setSize.isError && (
        <p className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
          {(setSize.error as Error).message}
        </p>
      )}
    </section>
  )
}
