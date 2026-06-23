import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { useCategories } from '@/features/categories/useCategories'
import { categoryColor } from '@/features/categories/categoryColor'
import { genderForCategoryType } from '@/features/categories/eligibility'
import { useManageRoster, type ManagedPlayer } from '@/features/teams/useManageRoster'
import { useSavePlayer, useTogglePlayerActive } from '@/features/teams/playerMutations'
import { MediaField } from '@/features/news/MediaField'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'

interface Draft {
  id?: string
  full_name: string
  category_code: string
  email: string
  phone: string
  is_captain: boolean
  is_active: boolean
  photo_url: string
}

const EMPTY: Draft = {
  full_name: '',
  category_code: '',
  email: '',
  phone: '',
  is_captain: false,
  is_active: true,
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
  const [draft, setDraft] = useState<Draft | null>(null)

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

  function edit(p: ManagedPlayer) {
    setDraft({
      id: p.id,
      full_name: p.full_name,
      category_code: p.category_code,
      email: p.email ?? '',
      phone: p.phone ?? '',
      is_captain: p.is_captain,
      is_active: p.is_active,
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
      <Link to="/app/organizador/equipos" className="text-sm text-sky-600 underline">
        ‹ Equipos
      </Link>
      <PageHeader title={team?.name ?? 'Jugadores'} subtitle="Roster del equipo" />

      {!draft ? (
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          + Nuevo jugador
        </button>
      ) : (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
          </div>
          {save.isError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
              className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
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
                'flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ' +
                (p.is_active ? '' : 'opacity-60')
              }
            >
              <Avatar name={p.full_name} photoUrl={p.photo_url} color={team?.color} size={32} />
              <span className="flex-1 truncate">
                <span className="font-medium text-slate-800">{p.full_name}</span>
                {p.is_captain && <span title="Capitán"> ⭐</span>}
                {!p.is_active && <span className="text-xs text-slate-500"> · inactivo</span>}
              </span>
              <Badge color={categoryColor(typeByCode.get(p.category_code))}>{p.category_code}</Badge>
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
                className="text-sm text-sky-600 underline"
              >
                {p.is_active ? 'Desactivar' : 'Activar'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {toggle.isError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {(toggle.error as Error).message}
        </p>
      )}
    </div>
  )
}
