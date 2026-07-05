import { useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/context'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useCategories } from '@/features/categories/useCategories'
import { rankingCategories, genderForCategoryType } from '@/features/registration/category'
import {
  usePoolPlayers,
  usePoolRegistrations,
  useUpdatePoolPlayer,
  useDeletePoolPlayer,
  usePoolShirtSizes,
  usePoolPaid,
  useInactivePoolPlayers,
  type PoolPlayer,
  type PoolRegistration,
} from '@/features/teams/usePoolPlayers'
import { useTeams } from '@/features/teams/useTeams'
import {
  useAssignPlayerTeam,
  useTogglePlayerActive,
  useSetPlayerPaid,
  useSetWaitlisted,
} from '@/features/teams/playerMutations'
import { TeamPicker } from '@/features/teams/TeamPicker'
import type { PlayerPosition } from '@/features/registration/types'
import type { MatchCategory, Team } from '@/lib/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Icon } from '@/components/ui/Icon'
import { Avatar } from '@/components/ui/Avatar'
import { ShirtSizePicker } from '@/components/ui/ShirtSizePicker'
import type { ShirtSize } from '@/lib/shirtSize'

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

// Pool de jugadores aprobados sin equipo, agrupado por categoría. Consciente del
// rol: el ORGANIZADOR ve fecha/hora de inscripción + teléfono y puede editar; las
// CAPITANAS lo ven de solo lectura (la fecha/teléfono son privados, RLS).
export function OrganizerPoolPage() {
  const { role } = useAuth()
  const isOrganizer = role === 'organizer'
  // "Pagado" es dato administrativo: lo ven organizador y observador (admin de
  // solo lectura), NUNCA las capitanas. Solo el organizador puede activarlo.
  const canSeePaid = isOrganizer || role === 'viewer'
  const season = useActiveSeason()
  const pool = usePoolPlayers(season.data?.id)
  const regs = usePoolRegistrations(season.data?.id, isOrganizer)
  const cats = useCategories()
  const teams = useTeams(season.data?.id)
  const shirtSizes = usePoolShirtSizes(season.data?.id, isOrganizer)
  const paid = usePoolPaid(season.data?.id, canSeePaid)
  const ranking = useMemo(() => rankingCategories(cats.data ?? []), [cats.data])

  if (season.isLoading) return <Loader label="Cargando…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Pool de jugadores" />
        <EmptyState icon="organizer" title="No hay temporada activa" description="Activa una temporada primero." />
      </div>
    )
  }
  const seasonId = season.data.id
  const regMap = regs.data ?? {}
  const players = pool.data ?? []

  // Orden dentro de cada categoría: por solicitud de ingreso (organizador, que
  // tiene la fecha) o alfabético (capitanas).
  const sortInCategory = (a: PoolPlayer, b: PoolPlayer) => {
    if (isOrganizer) {
      const ta = regMap[a.id]?.created_at ?? ''
      const tb = regMap[b.id]?.created_at ?? ''
      if (ta && tb) return ta.localeCompare(tb)
      if (ta) return -1
      if (tb) return 1
    }
    return a.full_name.localeCompare(b.full_name, 'es')
  }

  const byCategory = ranking
    .map((c) => ({ cat: c, players: players.filter((p) => p.category_code === c.code).sort(sortInCategory) }))
    .filter((g) => g.players.length > 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pool de jugadores"
        subtitle={`${players.length} aprobado${players.length === 1 ? '' : 's'} sin equipo · ${season.data.name}`}
      />

      {pool.isLoading ? (
        <Loader label="Cargando pool…" />
      ) : pool.isError ? (
        <ErrorState description="No pudimos cargar el pool." onRetry={() => void pool.refetch()} />
      ) : players.length === 0 ? (
        <EmptyState
          icon="account"
          title="El pool está vacío"
          description="Cuando se aprueben inscripciones aparecerán aquí, listas para el draft."
        />
      ) : (
        <div className="space-y-3">
          {byCategory.map(({ cat, players: list }) => {
            const paidCount = canSeePaid ? list.filter((p) => paid.data?.[p.id]).length : 0
            return (
            <section key={cat.code} className="rounded-2xl bg-slate-50 p-4 shadow-md">
              <div className="flex items-center justify-between">
                <p className="font-heading text-sm text-slate-900">{cat.name}</p>
                <div className="flex items-center gap-2">
                  {canSeePaid && (
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs font-semibold ' +
                        (paidCount === list.length
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700')
                      }
                      title="Jugadores que ya pagaron su inscripción"
                    >
                      {paidCount}/{list.length} pagados
                    </span>
                  )}
                  <span className="text-xs text-slate-500">{list.length}</span>
                </div>
              </div>
              <ul className="mt-2 divide-y divide-slate-200">
                {list.map((p) => (
                  <PoolRow
                    key={p.id}
                    player={p}
                    reg={regMap[p.id]}
                    seasonId={seasonId}
                    teams={teams.data ?? []}
                    categories={ranking}
                    canEdit={isOrganizer}
                    canSeePaid={canSeePaid}
                    isPaid={paid.data?.[p.id] ?? false}
                    currentShirtSize={shirtSizes.data?.[p.id] ?? null}
                  />
                ))}
              </ul>
            </section>
            )
          })}
        </div>
      )}

      {isOrganizer && <InactivePoolSection seasonId={seasonId} categories={ranking} />}
    </div>
  )
}

// Jugadores inhabilitados sin equipo: al desactivar a alguien desde el roster
// del equipo, regresa aquí (en vez de desaparecer de toda la app) para poder
// reactivarlo o borrarlo definitivamente. Solo el organizador la ve.
function InactivePoolSection({ seasonId, categories }: { seasonId: string; categories: MatchCategory[] }) {
  const inactive = useInactivePoolPlayers(seasonId, true)
  const toggle = useTogglePlayerActive()
  const del = useDeletePoolPlayer()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const players = [...(inactive.data ?? [])].sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'))
  const catName = (code: string) => categories.find((c) => c.code === code)?.name ?? code

  if (inactive.isLoading || players.length === 0) return null

  return (
    <section className="rounded-2xl bg-slate-50 p-4 shadow-md">
      <div className="flex items-center justify-between">
        <p className="font-heading text-sm text-slate-900">Inactivos</p>
        <span className="text-xs text-slate-500">{players.length}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">Inhabilitados sin equipo. Reactiva para volver a asignarlos.</p>
      <ul className="mt-2 divide-y divide-slate-200">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-2 py-2 opacity-75">
            <Avatar name={p.full_name} photoUrl={p.photo_url} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{p.full_name}</p>
              <p className="text-[11px] text-slate-500">{catName(p.category_code)}</p>
            </div>
            {confirmId === p.id ? (
              <>
                <span className="text-xs text-slate-600">¿Borrar?</span>
                <button
                  onClick={() => del.mutate({ id: p.id, seasonId }, { onSuccess: () => setConfirmId(null) })}
                  disabled={del.isPending}
                  className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Sí
                </button>
                <button onClick={() => setConfirmId(null)} className="shrink-0 text-xs text-slate-500">
                  No
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => toggle.mutate({ id: p.id, is_active: true, team_id: null, season_id: seasonId })}
                  disabled={toggle.isPending}
                  className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Reactivar
                </button>
                <button
                  onClick={() => setConfirmId(p.id)}
                  aria-label="Borrar"
                  className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:text-red-400"
                >
                  <Icon name="ban" size={16} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {toggle.isError && (
        <p className="mt-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{(toggle.error as Error).message}</p>
      )}
      {del.isError && (
        <p className="mt-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{(del.error as Error).message}</p>
      )}
    </section>
  )
}

function PoolRow({
  player,
  reg,
  seasonId,
  teams,
  categories,
  canEdit,
  canSeePaid,
  isPaid,
  currentShirtSize,
}: {
  player: PoolPlayer
  reg: PoolRegistration | undefined
  seasonId: string
  teams: Team[]
  categories: MatchCategory[]
  canEdit: boolean
  canSeePaid: boolean
  isPaid: boolean
  currentShirtSize: ShirtSize | null
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'assign'>('view')
  const setPaid = useSetPlayerPaid()
  const setWaitlisted = useSetWaitlisted()

  if (mode === 'edit' && canEdit) {
    return (
      <PoolEditForm
        player={player}
        phone={reg?.phone ?? ''}
        seasonId={seasonId}
        categories={categories}
        currentShirtSize={currentShirtSize}
        onDone={() => setMode('view')}
      />
    )
  }

  if (mode === 'assign' && canEdit) {
    return <AssignTeamForm player={player} teams={teams} seasonId={seasonId} onDone={() => setMode('view')} />
  }

  return (
    <li className="py-2">
      {/* Fila 1: identidad + estado de pago (siempre visible). */}
      <div className="flex items-center gap-2">
        <Avatar name={player.full_name} photoUrl={player.photo_url} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{player.full_name}</p>
          {/* Posición declarada (drive/revés/ambas): SOLO organizador (viene de la
              inscripción, RLS la restringe). */}
          {canEdit && reg?.position && (
            <span className="mt-0.5 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
              {POSITION_LABEL[reg.position]}
            </span>
          )}
          {/* Fecha/hora de inscripción: SOLO el organizador (RLS la restringe). */}
          {canEdit && reg?.created_at && (
            <p className="text-[11px] text-slate-500">Inscrito: {fmtWhen(reg.created_at)}</p>
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

      {/* Fila 2: acciones del organizador. Envuelven en móvil (flex-wrap) para no
          encimarse ni tapar el nombre. Indentadas bajo el nombre (pl-10). */}
      {canEdit && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-10">
          {reg?.phone && (
            <a href={`tel:${reg.phone}`} className="text-xs text-sky-300 underline">
              {reg.phone}
            </a>
          )}
          {teams.length > 0 && (
            <button
              onClick={() => setMode('assign')}
              className="rounded-lg bg-gold-300 px-2.5 py-1 text-xs font-semibold text-[#1a1405] shadow-sm hover:bg-gold-200"
            >
              Asignar
            </button>
          )}
          <button
            onClick={() =>
              setWaitlisted.mutate({ id: player.id, is_waitlisted: true, season_id: seasonId })
            }
            disabled={setWaitlisted.isPending}
            title="Apartar a la lista de espera (no entra al draft)"
            className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            A espera
          </button>
          <button
            onClick={() => setMode('edit')}
            aria-label="Editar"
            className="ml-auto rounded-lg p-1.5 text-slate-500 hover:text-slate-300"
          >
            <Icon name="edit" size={16} />
          </button>
        </div>
      )}
    </li>
  )
}

// Asignar manualmente un jugador del pool a un equipo (organizador). Tap a un
// equipo = asigna y sale del pool. Reversible desde el roster del equipo ("Mover").
function AssignTeamForm({
  player,
  teams,
  seasonId,
  onDone,
}: {
  player: PoolPlayer
  teams: Team[]
  seasonId: string
  onDone: () => void
}) {
  const assign = useAssignPlayerTeam()

  return (
    <li className="neu-inset my-2 space-y-3 rounded-2xl p-3">
      <p className="text-xs text-slate-600">
        Asignar a <span className="font-semibold text-slate-800">{player.full_name}</span> a un equipo:
      </p>
      <TeamPicker
        teams={teams}
        pending={assign.isPending}
        onPick={(teamId) => assign.mutate({ playerId: player.id, teamId, seasonId }, { onSuccess: onDone })}
      />
      {assign.isError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {(assign.error as Error).message}
        </p>
      )}
      <button onClick={onDone} className="neu-raised rounded-xl px-3 py-2 text-sm font-medium text-slate-700">
        Cancelar
      </button>
    </li>
  )
}

function PoolEditForm({
  player,
  phone: initialPhone,
  seasonId,
  categories,
  currentShirtSize,
  onDone,
}: {
  player: PoolPlayer
  phone: string
  seasonId: string
  categories: MatchCategory[]
  currentShirtSize: ShirtSize | null
  onDone: () => void
}) {
  const update = useUpdatePoolPlayer()
  const del = useDeletePoolPlayer()
  const [name, setName] = useState(player.full_name)
  const [phone, setPhone] = useState(initialPhone)
  const [categoryCode, setCategoryCode] = useState(player.category_code)
  const [shirtSize, setShirtSize] = useState<ShirtSize | null>(currentShirtSize)
  const [confirmDel, setConfirmDel] = useState(false)

  function save() {
    const cat = categories.find((c) => c.code === categoryCode)
    const gender = cat ? genderForCategoryType(cat.type) : null
    if (!gender || !name.trim()) return
    update.mutate(
      { id: player.id, seasonId, full_name: name, phone, gender, category_code: categoryCode, shirt_size: shirtSize },
      { onSuccess: onDone },
    )
  }

  return (
    <li className="neu-inset my-2 space-y-3 rounded-2xl p-3">
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">Nombre</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg px-3 py-2 text-base text-slate-900" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Teléfono</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="mt-1 w-full rounded-lg px-3 py-2 text-base text-slate-900" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Categoría</span>
          <select value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} className="mt-1 w-full rounded-lg px-2 py-2 text-base text-slate-900">
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <span className="block text-xs font-medium text-slate-600">Talla de playera</span>
        <div className="mt-1.5">
          <ShirtSizePicker value={shirtSize} onChange={setShirtSize} />
        </div>
      </div>

      {update.isError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{(update.error as Error).message}</p>
      )}

      {confirmDel ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm text-slate-600">¿Quitar del pool?</span>
          <button
            onClick={() => del.mutate({ id: player.id, seasonId }, { onSuccess: onDone })}
            disabled={del.isPending}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {del.isPending ? 'Quitando…' : 'Sí, quitar'}
          </button>
          <button onClick={() => setConfirmDel(false)} className="rounded-lg px-3 py-2 text-sm text-slate-500">
            No
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={update.isPending}
            className="flex-1 rounded-xl bg-gold-300 px-3 py-2 text-sm font-semibold text-[#1a1405] shadow-sm disabled:opacity-50"
          >
            {update.isPending ? 'Guardando…' : 'Guardar'}
          </button>
          <button onClick={onDone} className="neu-raised rounded-xl px-3 py-2 text-sm font-medium text-slate-700">
            Cancelar
          </button>
          <button onClick={() => setConfirmDel(true)} aria-label="Quitar del pool" className="rounded-xl p-2 text-red-400">
            <Icon name="ban" size={16} />
          </button>
        </div>
      )}
    </li>
  )
}
