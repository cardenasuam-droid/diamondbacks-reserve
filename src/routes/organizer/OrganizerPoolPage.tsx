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
  type PoolPlayer,
  type PoolRegistration,
} from '@/features/teams/usePoolPlayers'
import { useTeams } from '@/features/teams/useTeams'
import { useAssignPlayerTeam } from '@/features/teams/playerMutations'
import { TeamPicker } from '@/features/teams/TeamPicker'
import type { MatchCategory, Team } from '@/lib/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Icon } from '@/components/ui/Icon'

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
  const season = useActiveSeason()
  const pool = usePoolPlayers(season.data?.id)
  const regs = usePoolRegistrations(season.data?.id, isOrganizer)
  const cats = useCategories()
  const teams = useTeams(season.data?.id)
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
          {byCategory.map(({ cat, players: list }) => (
            <section key={cat.code} className="rounded-2xl bg-slate-50 p-4 shadow-md">
              <div className="flex items-center justify-between">
                <p className="font-heading text-sm text-slate-900">{cat.name}</p>
                <span className="text-xs text-slate-500">{list.length}</span>
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

function PoolRow({
  player,
  reg,
  seasonId,
  teams,
  categories,
  canEdit,
}: {
  player: PoolPlayer
  reg: PoolRegistration | undefined
  seasonId: string
  teams: Team[]
  categories: MatchCategory[]
  canEdit: boolean
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'assign'>('view')

  if (mode === 'edit' && canEdit) {
    return (
      <PoolEditForm
        player={player}
        phone={reg?.phone ?? ''}
        seasonId={seasonId}
        categories={categories}
        onDone={() => setMode('view')}
      />
    )
  }

  if (mode === 'assign' && canEdit) {
    return <AssignTeamForm player={player} teams={teams} seasonId={seasonId} onDone={() => setMode('view')} />
  }

  return (
    <li className="flex items-center gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{player.full_name}</p>
        {/* Fecha/hora de inscripción: SOLO el organizador (RLS la restringe). */}
        {canEdit && reg?.created_at && (
          <p className="text-[11px] text-slate-500">Inscrito: {fmtWhen(reg.created_at)}</p>
        )}
      </div>
      {canEdit && reg?.phone && (
        <a href={`tel:${reg.phone}`} className="shrink-0 text-xs text-sky-300 underline">
          {reg.phone}
        </a>
      )}
      {canEdit && teams.length > 0 && (
        <button
          onClick={() => setMode('assign')}
          className="shrink-0 rounded-lg bg-gold-300 px-2.5 py-1 text-xs font-semibold text-[#1a1405] shadow-sm hover:bg-gold-200"
        >
          Asignar
        </button>
      )}
      {canEdit && (
        <button
          onClick={() => setMode('edit')}
          aria-label="Editar"
          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:text-slate-300"
        >
          <Icon name="edit" size={16} />
        </button>
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
  onDone,
}: {
  player: PoolPlayer
  phone: string
  seasonId: string
  categories: MatchCategory[]
  onDone: () => void
}) {
  const update = useUpdatePoolPlayer()
  const del = useDeletePoolPlayer()
  const [name, setName] = useState(player.full_name)
  const [phone, setPhone] = useState(initialPhone)
  const [categoryCode, setCategoryCode] = useState(player.category_code)
  const [confirmDel, setConfirmDel] = useState(false)

  function save() {
    const cat = categories.find((c) => c.code === categoryCode)
    const gender = cat ? genderForCategoryType(cat.type) : null
    if (!gender || !name.trim()) return
    update.mutate(
      { id: player.id, seasonId, full_name: name, phone, gender, category_code: categoryCode },
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
