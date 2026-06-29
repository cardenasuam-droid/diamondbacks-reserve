import { useMemo, useState } from 'react'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useCategories } from '@/features/categories/useCategories'
import { rankingCategories, genderForCategoryType } from '@/features/registration/category'
import {
  usePoolPlayers,
  useUpdatePoolPlayer,
  useDeletePoolPlayer,
  type PoolPlayer,
} from '@/features/teams/usePoolPlayers'
import type { MatchCategory } from '@/lib/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Icon } from '@/components/ui/Icon'

// Pantalla del organizador: todo el POOL de jugadores aprobados sin equipo,
// agrupado por categoría. Cada jugador se puede editar (mover de categoría, etc.).
export function OrganizerPoolPage() {
  const season = useActiveSeason()
  const pool = usePoolPlayers(season.data?.id)
  const cats = useCategories()
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
  const players = pool.data ?? []
  const byCategory = ranking
    .map((c) => ({ cat: c, players: players.filter((p) => p.category_code === c.code) }))
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
          description="Aprueba inscripciones en Inscripciones y aparecerán aquí, listas para el draft."
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
                  <PoolRow key={p.id} player={p} seasonId={seasonId} categories={ranking} />
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
  seasonId,
  categories,
}: {
  player: PoolPlayer
  seasonId: string
  categories: MatchCategory[]
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return <PoolEditForm player={player} seasonId={seasonId} categories={categories} onDone={() => setEditing(false)} />
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex-1 truncate text-sm font-medium text-slate-800">{player.full_name}</span>
      {player.phone && (
        <a href={`tel:${player.phone}`} className="shrink-0 text-xs text-sky-300 underline">
          {player.phone}
        </a>
      )}
      <button
        onClick={() => setEditing(true)}
        aria-label="Editar"
        className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:text-slate-300"
      >
        <Icon name="edit" size={16} />
      </button>
    </li>
  )
}

function PoolEditForm({
  player,
  seasonId,
  categories,
  onDone,
}: {
  player: PoolPlayer
  seasonId: string
  categories: MatchCategory[]
  onDone: () => void
}) {
  const update = useUpdatePoolPlayer()
  const del = useDeletePoolPlayer()
  const [name, setName] = useState(player.full_name)
  const [phone, setPhone] = useState(player.phone ?? '')
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
