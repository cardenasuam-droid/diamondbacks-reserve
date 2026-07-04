import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { useCategories } from '@/features/categories/useCategories'
import { categoryColor } from '@/features/categories/categoryColor'
import { genderForCategoryType } from '@/features/categories/eligibility'
import { useManageRoster, type ManagedPlayer } from '@/features/teams/useManageRoster'
import {
  useSavePlayer,
  useTogglePlayerActive,
  useAssignPlayerTeam,
  useSetPlayerPaid,
} from '@/features/teams/playerMutations'
import { usePoolPlayers } from '@/features/teams/usePoolPlayers'
import { TeamPicker } from '@/features/teams/TeamPicker'
import { MediaField } from '@/features/news/MediaField'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { TeamCrest } from '@/components/ui/TeamCrest'
import { ShirtSizePicker } from '@/components/ui/ShirtSizePicker'
import type { ShirtSize } from '@/lib/shirtSize'

interface Draft {
  id?: string
  full_name: string
  category_code: string
  shirt_size: ShirtSize | null
  email: string
  phone: string
  is_captain: boolean
  is_active: boolean
  is_paid: boolean
  photo_url: string
}

const EMPTY: Draft = {
  full_name: '',
  category_code: '',
  shirt_size: null,
  email: '',
  phone: '',
  is_captain: false,
  is_active: true,
  is_paid: false,
  photo_url: '',
}

export function OrganizerRosterPage() {
  const { teamId } = useParams()
  const season = useActiveSeason()
  const teams = useTeams(season.data?.id)
  const roster = useManageRoster(teamId)
  const categories = useCategories()
  const save = useSavePlayer()
  const toggle = useTogglePlayerActive()
  const setPaid = useSetPlayerPaid()
  const assign = useAssignPlayerTeam()
  const [draft, setDraft] = useState<Draft | null>(null)

  const pool = usePoolPlayers(season.data?.id)
  const [addFromPool, setAddFromPool] = useState(false)
  const [poolPick, setPoolPick] = useState('')

  const team = (teams.data ?? []).find((t) => t.id === teamId)
  // Categorías de ranking (no mixtas): las que puede tener un jugador.
  const rankingCats = useMemo(
    () => (categories.data ?? []).filter((c) => c.type !== 'mixta'),
    [categories.data],
  )
  const typeByCode = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.code, c.type])),
    [categories.data],
  )
  const poolSorted = useMemo(
    () => [...(pool.data ?? [])].sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')),
    [pool.data],
  )

  function addPicked() {
    if (!poolPick || !teamId || !season.data) return
    assign.mutate(
      { playerId: poolPick, teamId, seasonId: season.data.id },
      {
        onSuccess: () => {
          setAddFromPool(false)
          setPoolPick('')
        },
      },
    )
  }

  function edit(p: ManagedPlayer) {
    setDraft({
      id: p.id,
      full_name: p.full_name,
      category_code: p.category_code,
      shirt_size: p.shirt_size,
      email: p.email ?? '',
      phone: p.phone ?? '',
      is_captain: p.is_captain,
      is_active: p.is_active,
      is_paid: p.is_paid,
      photo_url: p.photo_url ?? '',
    })
  }

  async function handleSave() {
    if (!draft || !season.data || !teamId) return
    const type = typeByCode.get(draft.category_code)
    const gender = type ? genderForCategoryType(type) : null
    if (!gender) return // categoría inválida (no debería pasar; el select solo trae ranking)
    await save.mutateAsync({
      ...draft,
      gender,
      team_id: teamId,
      season_id: season.data.id,
    })
    setDraft(null)
  }

  if (season.isLoading || teams.isLoading) return <Loader label="Cargando…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Jugadores" />
        <EmptyState icon="teams" title="No hay temporada activa" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link to="/app/organizador/equipos" className="text-sm text-sky-300 underline">
        ‹ Equipos
      </Link>
      <PageHeader
        title={team?.name ?? 'Jugadores'}
        subtitle="Roster del equipo"
        leading={
          team ? <TeamCrest name={team.name} logoUrl={team.logo_url} color={team.color} size={40} /> : undefined
        }
      />

      {!draft ? (
        addFromPool ? (
          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-700">Agregar jugador del pool</p>
            {pool.isLoading ? (
              <Loader label="Cargando pool…" />
            ) : poolSorted.length === 0 ? (
              <p className="text-sm text-slate-500">El pool está vacío: no hay jugadores sin equipo.</p>
            ) : (
              <select
                value={poolPick}
                onChange={(e) => setPoolPick(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
              >
                <option value="">— Elige jugador —</option>
                {poolSorted.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.category_code})
                  </option>
                ))}
              </select>
            )}
            {assign.isError && (
              <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                {(assign.error as Error).message}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setAddFromPool(false)
                  setPoolPick('')
                }}
                className="rounded-lg px-3 py-2 text-sm text-slate-500"
              >
                Cancelar
              </button>
              <button
                onClick={addPicked}
                disabled={!poolPick || assign.isPending}
                className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {assign.isPending ? 'Agregando…' : 'Agregar al equipo'}
              </button>
            </div>
          </section>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setDraft({ ...EMPTY })}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              + Nuevo jugador
            </button>
            <button
              onClick={() => setAddFromPool(true)}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Agregar del pool
            </button>
          </div>
        )
      ) : (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
          <input
            value={draft.full_name}
            onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
            placeholder="Nombre completo"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-medium"
          />
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">Categoría</span>
            <select
              value={draft.category_code}
              onChange={(e) => setDraft({ ...draft, category_code: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
            >
              <option value="">— Elige categoría —</option>
              {rankingCats.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.type === 'varonil' ? 'varonil' : 'femenil'})
                </option>
              ))}
            </select>
          </label>
          <input
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            placeholder="Teléfono (para su primer acceso)"
            inputMode="tel"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder="Email (opcional)"
            inputMode="email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div>
            <span className="block text-sm font-medium text-slate-700">Talla de playera</span>
            <div className="mt-1.5">
              <ShirtSizePicker
                value={draft.shirt_size}
                onChange={(s) => setDraft({ ...draft, shirt_size: s })}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Avatar name={draft.full_name || '?'} photoUrl={draft.photo_url} color={team?.color} size={48} />
            <div className="flex-1">
              <MediaField
                label="Foto (opcional)"
                value={draft.photo_url}
                onChange={(url) => setDraft({ ...draft, photo_url: url })}
                accept="image/*"
                folder="players"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.is_captain}
                onChange={(e) => setDraft({ ...draft, is_captain: e.target.checked })}
              />
              Capitán
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
              />
              Activo
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.is_paid}
                onChange={(e) => setDraft({ ...draft, is_paid: e.target.checked })}
              />
              Pagado
            </label>
          </div>
          {/* Mover a otro equipo o regresar al pool (asignación manual). */}
          {draft.id && (
            <div className="border-t border-slate-200 pt-3">
              <p className="mb-2 text-xs font-medium text-slate-700">Mover de equipo</p>
              <TeamPicker
                teams={teams.data ?? []}
                excludeTeamId={teamId}
                includePool
                pending={assign.isPending}
                onPick={(target) =>
                  assign.mutate(
                    { playerId: draft.id!, teamId: target, seasonId: season.data!.id, fromTeamId: teamId },
                    { onSuccess: () => setDraft(null) },
                  )
                }
              />
              {assign.isError && (
                <p className="mt-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                  {(assign.error as Error).message}
                </p>
              )}
            </div>
          )}
          {save.isError && (
            <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
              {(save.error as Error).message}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={() => setDraft(null)} className="rounded-lg px-3 py-2 text-sm text-slate-500">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!draft.full_name.trim() || !draft.category_code || save.isPending}
              className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {save.isPending ? 'Guardando…' : 'Guardar jugador'}
            </button>
          </div>
        </section>
      )}

      {roster.isLoading ? (
        <Loader label="Cargando jugadores…" />
      ) : roster.isError ? (
        <ErrorState onRetry={() => roster.refetch()} />
      ) : (roster.data ?? []).length === 0 ? (
        <EmptyState icon="medal" title="Sin jugadores" description="Agrega el primero o impórtalos por CSV." />
      ) : (
        <ul className="space-y-2">
          {(roster.data ?? []).map((p) => (
            <li
              key={p.id}
              className={
                'flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-sm ' +
                (p.is_active ? '' : 'opacity-60')
              }
            >
              {/* Fila 1: identidad + categoría + estado de pago. */}
              <div className="flex items-center gap-2">
                <Avatar name={p.full_name} photoUrl={p.photo_url} color={team?.color} size={32} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-slate-800">{p.full_name}</span>
                  {p.is_captain && <span title="Capitán"> ⭐</span>}
                  {!p.is_active && <span className="text-xs text-slate-500"> · inactivo</span>}
                </span>
                <Badge color={categoryColor(typeByCode.get(p.category_code))}>{p.category_code}</Badge>
                <button
                  onClick={() =>
                    setPaid.mutate({
                      id: p.id,
                      is_paid: !p.is_paid,
                      season_id: season.data!.id,
                      team_id: teamId as string,
                    })
                  }
                  title={p.is_paid ? 'Marcar como no pagado' : 'Marcar como pagado'}
                  className={
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ' +
                    (p.is_paid
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300')
                  }
                >
                  {p.is_paid ? '✓ Pagado' : 'Pagado'}
                </button>
              </div>
              {/* Fila 2: acciones, indentadas bajo el nombre. */}
              <div className="flex items-center gap-4 pl-10">
                <button onClick={() => edit(p)} className="text-sm text-slate-600 underline">
                  Editar
                </button>
                <button
                  onClick={() =>
                    toggle.mutate({
                      id: p.id,
                      is_active: !p.is_active,
                      team_id: teamId as string,
                      season_id: season.data!.id,
                    })
                  }
                  className="text-sm text-sky-300 underline"
                >
                  {p.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {toggle.isError && (
        <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
          {(toggle.error as Error).message}
        </p>
      )}
      {setPaid.isError && (
        <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
          {(setPaid.error as Error).message}
        </p>
      )}
    </div>
  )
}
