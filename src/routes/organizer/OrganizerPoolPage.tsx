import { useMemo } from 'react'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useCategories } from '@/features/categories/useCategories'
import { rankingCategories } from '@/features/registration/category'
import { usePoolPlayers, type PoolPlayer } from '@/features/teams/usePoolPlayers'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'

// Pantalla del organizador: todo el POOL de jugadores aprobados sin equipo,
// agrupado por categoría. Es lo que entrará al draft.
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
          description="Aprueba inscripciones en /registro → Inscripciones y aparecerán aquí, listas para el draft."
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
                  <PoolRow key={p.id} player={p} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function PoolRow({ player }: { player: PoolPlayer }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex-1 truncate text-sm font-medium text-slate-800">{player.full_name}</span>
      {player.phone && (
        <a href={`tel:${player.phone}`} className="shrink-0 text-xs text-sky-300 underline">
          {player.phone}
        </a>
      )}
    </li>
  )
}
