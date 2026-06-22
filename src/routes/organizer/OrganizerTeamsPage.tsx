import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { useSaveTeam, useDeleteTeam } from '@/features/teams/teamMutations'
import { MediaField } from '@/features/news/MediaField'
import { teamColor } from '@/lib/color'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import type { Team } from '@/lib/types'

interface Draft {
  id?: string
  name: string
  color: string
  slogan: string
  logo_url: string
}

const EMPTY: Draft = { name: '', color: '#0ea5e9', slogan: '', logo_url: '' }

export function OrganizerTeamsPage() {
  const season = useActiveSeason()
  const teams = useTeams(season.data?.id)
  const save = useSaveTeam()
  const del = useDeleteTeam(season.data?.id)
  const [draft, setDraft] = useState<Draft | null>(null)

  function edit(t: Team) {
    setDraft({
      id: t.id,
      name: t.name,
      color: t.color ?? '#0ea5e9',
      slogan: t.slogan ?? '',
      logo_url: t.logo_url ?? '',
    })
  }

  async function handleSave() {
    if (!draft || !season.data) return
    await save.mutateAsync({ ...draft, season_id: season.data.id })
    setDraft(null)
  }

  if (season.isLoading) return <Loader label="Cargando…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Equipos y jugadores" />
        <EmptyState icon="👥" title="No hay temporada activa" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Equipos y jugadores" subtitle={season.data.name} />

      {!draft ? (
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          + Nuevo equipo
        </button>
      ) : (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Nombre del equipo"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-medium"
          />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : '#0ea5e9'}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              className="h-10 w-12 rounded border border-slate-300"
              aria-label="Color del equipo"
            />
            <input
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              placeholder="#RRGGBB"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <input
            value={draft.slogan}
            onChange={(e) => setDraft({ ...draft, slogan: e.target.value })}
            placeholder="Lema (opcional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <MediaField
            label="Logo (opcional)"
            value={draft.logo_url}
            onChange={(url) => setDraft({ ...draft, logo_url: url })}
            accept="image/*"
            folder="logos"
          />
          {save.isError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {(save.error as Error).message}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setDraft(null)}
              className="rounded-lg px-3 py-2 text-sm text-slate-500"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!draft.name.trim() || save.isPending}
              className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {save.isPending ? 'Guardando…' : 'Guardar equipo'}
            </button>
          </div>
        </section>
      )}

      {teams.isLoading ? (
        <Loader label="Cargando equipos…" />
      ) : teams.isError ? (
        <ErrorState onRetry={() => teams.refetch()} />
      ) : (teams.data ?? []).length === 0 ? (
        <EmptyState icon="👥" title="Aún no hay equipos" description="Crea el primero o impórtalos por CSV." />
      ) : (
        <ul className="space-y-2">
          {(teams.data ?? []).map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5"
                style={{ backgroundColor: teamColor(t.color) }}
                aria-hidden
              />
              <span className="flex-1 truncate font-medium text-slate-800">{t.name}</span>
              <Link
                to={`/app/organizador/equipos/${t.id}`}
                className="text-sm text-sky-600 underline"
              >
                Jugadores
              </Link>
              <button onClick={() => edit(t)} className="text-sm text-slate-600 underline">
                Editar
              </button>
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar el equipo "${t.name}"?`)) void del.mutate(t.id)
                }}
                className="text-sm text-rose-600 underline"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
      {del.isError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {(del.error as Error).message}
        </p>
      )}
    </div>
  )
}
