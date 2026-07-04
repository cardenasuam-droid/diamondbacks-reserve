import { useMemo } from 'react'
import { useAuth } from '@/features/auth/context'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useCategories } from '@/features/categories/useCategories'
import { rankingCategories } from '@/features/registration/category'
import { useWaitlistPlayers, type PoolPlayer } from '@/features/teams/usePoolPlayers'
import { useSetWaitlisted } from '@/features/teams/playerMutations'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Avatar } from '@/components/ui/Avatar'

// Lista de espera: jugadores apartados del pool que NO entran al draft. Solo el
// organizador la gestiona (regresar al pool); el observador la ve de solo lectura.
export function OrganizerWaitlistPage() {
  const { role } = useAuth()
  const canEdit = role === 'organizer'
  const season = useActiveSeason()
  const waitlist = useWaitlistPlayers(season.data?.id)
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

  const byCategory = ranking
    .map((c) => ({
      cat: c,
      players: players
        .filter((p) => p.category_code === c.code)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')),
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
                  <WaitlistRow key={p.id} player={p} seasonId={seasonId} canEdit={canEdit} />
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
  seasonId,
  canEdit,
}: {
  player: PoolPlayer
  seasonId: string
  canEdit: boolean
}) {
  const setWaitlisted = useSetWaitlisted()

  return (
    <li className="flex items-center gap-2 py-2">
      <Avatar name={player.full_name} photoUrl={player.photo_url} size={32} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{player.full_name}</span>
      {canEdit && (
        <button
          onClick={() => setWaitlisted.mutate({ id: player.id, is_waitlisted: false, season_id: seasonId })}
          disabled={setWaitlisted.isPending}
          title="Regresar al pool (vuelve a entrar al draft)"
          className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Regresar al pool
        </button>
      )}
      {setWaitlisted.isError && (
        <span className="shrink-0 text-xs text-rose-500">Error</span>
      )}
    </li>
  )
}
