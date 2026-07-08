import { useMemo } from 'react'
import { useAuth } from '@/features/auth/context'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useCategories } from '@/features/categories/useCategories'
import { rankingCategories } from '@/features/registration/category'
import {
  useWaitlistPlayers,
  useWaitlistMeta,
  usePoolRegistrations,
  usePoolPaid,
  type PoolPlayer,
  type PoolRegistration,
} from '@/features/teams/usePoolPlayers'
import { useSetWaitlisted, useSetPlayerPaid } from '@/features/teams/playerMutations'
import type { PlayerPosition } from '@/features/registration/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Avatar } from '@/components/ui/Avatar'
import { PositionChip } from '@/components/ui/PositionChip'

const POSITION_LABEL: Record<PlayerPosition, string> = {
  drive: 'Drive',
  reves: 'Revés',
  ambas: 'Ambas',
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Lista de espera: jugadores apartados del pool que NO entran al draft. Muestra la
// misma info que el pool (fecha de inscripción, teléfono, "Pagado") y se ordena
// por antigüedad en la espera (quien lleva más tiempo, primero). Solo el
// organizador la gestiona; el observador la ve de solo lectura.
export function OrganizerWaitlistPage() {
  const { role } = useAuth()
  const canEdit = role === 'organizer'
  const canSeePaid = canEdit || role === 'viewer'
  const season = useActiveSeason()
  const waitlist = useWaitlistPlayers(season.data?.id)
  const regs = usePoolRegistrations(season.data?.id, canEdit)
  const paid = usePoolPaid(season.data?.id, canSeePaid)
  const meta = useWaitlistMeta(season.data?.id, canSeePaid)
  const cats = useCategories()
  const ranking = useMemo(() => rankingCategories(cats.data ?? []), [cats.data])

  if (season.isLoading) return <Loader label="Cargando…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Lista de espera" />
        <EmptyState icon="organizer" title="No hay temporada activa" description="Activa una temporada primero." />
      </div>
    )
  }
  const seasonId = season.data.id
  const players = waitlist.data ?? []
  const regMap = regs.data ?? {}
  const metaMap = meta.data ?? {}

  // Orden dentro de cada categoría: por antigüedad en la espera (waitlisted_at
  // ascendente = más antiguo primero); sin fecha van al final; desempate alfabético.
  const sortByWaited = (a: PoolPlayer, b: PoolPlayer) => {
    const ta = metaMap[a.id] ?? ''
    const tb = metaMap[b.id] ?? ''
    if (ta && tb && ta !== tb) return ta.localeCompare(tb)
    if (ta && !tb) return -1
    if (!ta && tb) return 1
    return a.full_name.localeCompare(b.full_name, 'es')
  }

  const byCategory = ranking
    .map((c) => ({
      cat: c,
      players: players.filter((p) => p.category_code === c.code).sort(sortByWaited),
    }))
    .filter((g) => g.players.length > 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lista de espera"
        subtitle={`${players.length} en espera · no entran al draft · ${season.data.name}`}
      />

      {waitlist.isLoading ? (
        <Loader label="Cargando lista de espera…" />
      ) : waitlist.isError ? (
        <ErrorState description="No pudimos cargar la lista de espera." onRetry={() => void waitlist.refetch()} />
      ) : players.length === 0 ? (
        <EmptyState
          icon="waitlist"
          title="La lista de espera está vacía"
          description="Desde el Pool de jugadores puedes apartar aquí a quienes no entrarán al draft."
        />
      ) : (
        <div className="space-y-3">
          {byCategory.map(({ cat, players: list }) => (
            <section key={cat.code} className="rounded-2xl bg-slate-50 p-4 shadow-md">
              <div className="flex items-center justify-between">
                <p className="font-heading text-sm text-slate-900">{cat.name}</p>
                <span className="text-xs text-slate-500">{list.length}</span>
              </div>
              <ul className="mt-2 divide-y divide-slate-200">
                {list.map((p) => (
                  <WaitlistRow
                    key={p.id}
                    player={p}
                    reg={regMap[p.id]}
                    waitlistedAt={metaMap[p.id] ?? null}
                    isPaid={paid.data?.[p.id] ?? false}
                    seasonId={seasonId}
                    canEdit={canEdit}
                    canSeePaid={canSeePaid}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function WaitlistRow({
  player,
  reg,
  waitlistedAt,
  isPaid,
  seasonId,
  canEdit,
  canSeePaid,
}: {
  player: PoolPlayer
  reg: PoolRegistration | undefined
  waitlistedAt: string | null
  isPaid: boolean
  seasonId: string
  canEdit: boolean
  canSeePaid: boolean
}) {
  const setWaitlisted = useSetWaitlisted()
  const setPaid = useSetPlayerPaid()

  return (
    <li className="py-2">
      {/* Fila 1: identidad + fechas + estado de pago. */}
      <div className="flex items-center gap-2">
        <Avatar name={player.full_name} photoUrl={player.photo_url} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium text-slate-800">{player.full_name}</p>
            <PositionChip position={player.position} />
          </div>
          {canEdit && reg?.position && (
            <span className="mt-0.5 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
              {POSITION_LABEL[reg.position]}
            </span>
          )}
          {/* Fecha/hora de inscripción (privada): SOLO organizador, igual que el pool. */}
          {canEdit && reg?.created_at && (
            <p className="text-[11px] text-slate-500">Inscrito: {fmtWhen(reg.created_at)}</p>
          )}
          {waitlistedAt && (
            <p className="text-[11px] text-amber-600">En espera desde: {fmtWhen(waitlistedAt)}</p>
          )}
        </div>
        {canSeePaid &&
          (canEdit ? (
            <button
              onClick={() =>
                setPaid.mutate({ id: player.id, is_paid: !isPaid, season_id: seasonId, team_id: null })
              }
              title={isPaid ? 'Marcar como no pagado' : 'Marcar como pagado'}
              className={
                'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ' +
                (isPaid
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-slate-200 text-slate-500 hover:bg-slate-300')
              }
            >
              {isPaid ? '✓ Pagado' : 'Pagado'}
            </button>
          ) : (
            <span
              className={
                'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ' +
                (isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400')
              }
            >
              {isPaid ? '✓ Pagado' : 'Sin pagar'}
            </span>
          ))}
      </div>

      {/* Fila 2: teléfono + acción, envuelven en móvil, indentadas bajo el nombre. */}
      {canEdit && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-10">
          {reg?.phone && (
            <a href={`tel:${reg.phone}`} className="text-xs text-sky-300 underline">
              {reg.phone}
            </a>
          )}
          <button
            onClick={() => setWaitlisted.mutate({ id: player.id, is_waitlisted: false, season_id: seasonId })}
            disabled={setWaitlisted.isPending}
            title="Regresar al pool (vuelve a entrar al draft)"
            className="ml-auto rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Regresar al pool
          </button>
        </div>
      )}
    </li>
  )
}
