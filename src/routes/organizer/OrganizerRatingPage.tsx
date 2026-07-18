import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { useRounds } from '@/features/schedule/useRounds'
import { useCategories } from '@/features/categories/useCategories'
import { categoryColor } from '@/features/categories/categoryColor'
import {
  useRatingRoster,
  useRatingAdjustments,
  useSetRatingSeed,
  useAddRatingAdjustment,
  useDeleteRatingAdjustment,
  type RatingRosterRow,
} from '@/features/rating/ratingAdmin'
import { useRecomputeRatings } from '@/features/rating/useRecomputeRatings'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'

// Panel de rating del organizador (migración 0039/0040).
//
// Aquí NO se edita el rating: se edita la SEMILLA y se registran AJUSTES con
// motivo. El rating vigente es una función de esas dos cosas más los resultados,
// y se regenera entero en cada cambio. Por eso toda acción de esta pantalla
// termina en un recálculo — verlo tardar un segundo es correcto, no un fallo.
export function OrganizerRatingPage() {
  const { role } = useAuth()
  const canEdit = role === 'organizer'

  const season = useActiveSeason()
  const seasonId = season.data?.id
  const roster = useRatingRoster(seasonId)
  const ajustes = useRatingAdjustments(seasonId)
  const teams = useTeams(seasonId)
  const rounds = useRounds(seasonId)
  const categories = useCategories()

  const recalcular = useRecomputeRatings()
  const [abierto, setAbierto] = useState<string | null>(null)

  if (season.isLoading || roster.isLoading) return <Loader label="Cargando rating…" />
  if (roster.isError) return <ErrorState onRetry={() => roster.refetch()} />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Rating" />
        <EmptyState icon="stats" title="No hay temporada activa" />
      </div>
    )
  }

  // Se extrae aquí: dentro de los closures del render TypeScript pierde el
  // estrechamiento del early return de arriba.
  const temporadaId = season.data.id
  const jugadores = roster.data ?? []
  const teamById = new Map((teams.data ?? []).map((t) => [t.id, t]))
  const typeOf = new Map((categories.data ?? []).map((c) => [c.code, c.type]))

  // Orden de categorías tal como las define el catálogo, no alfabético.
  const ordenCat = new Map((categories.data ?? []).map((c, i) => [c.code, i]))
  const porCategoria = new Map<string, RatingRosterRow[]>()
  for (const p of jugadores) {
    const lista = porCategoria.get(p.category_code) ?? []
    lista.push(p)
    porCategoria.set(p.category_code, lista)
  }
  const categoriasOrdenadas = [...porCategoria.keys()].sort(
    (a, b) => (ordenCat.get(a) ?? 99) - (ordenCat.get(b) ?? 99),
  )
  for (const lista of porCategoria.values()) {
    lista.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.full_name.localeCompare(b.full_name, 'es'))
  }

  const sinSemilla = jugadores.filter((p) => p.rating_seed == null)
  const dictados = jugadores.filter((p) => p.rating_seed_source === 'dictado').length
  const res = recalcular.data

  return (
    <div className="space-y-4">
      <PageHeader title="Rating" subtitle={season.data.name} />

      {/* Resumen + recálculo */}
      <section className="rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            <strong className="text-slate-900">{jugadores.length}</strong> jugadores ·{' '}
            <strong className="text-slate-900">{dictados}</strong> con semilla dictada ·{' '}
            <strong className="text-slate-900">{jugadores.length - dictados}</strong> por categoría
          </div>
          {canEdit && (
            <button
              onClick={() => recalcular.mutate(temporadaId)}
              disabled={recalcular.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Icon name="refresh" size={16} />
              {recalcular.isPending ? 'Recalculando…' : 'Recalcular'}
            </button>
          )}
        </div>

        {recalcular.isError && (
          <p className="mt-2 text-sm text-rose-400">{(recalcular.error as Error).message}</p>
        )}

        {res && (
          <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm text-slate-600">
            <p>
              <strong className="text-slate-900">{res.partidosContados}</strong> partidos movieron el
              rating · <strong className="text-slate-900">{res.eventos}</strong> registros ·{' '}
              <strong className="text-slate-900">{res.jugadores}</strong> jugadores actualizados
            </p>
            {/* Los descartes se muestran SIEMPRE que existan: un partido que no
                mueve el rating y nadie lo sabe es la forma más fácil de que el
                número parezca correcto y no lo sea. */}
            {Object.keys(res.descartes).length > 0 && (
              <p className="text-slate-500">
                No contaron:{' '}
                {Object.entries(res.descartes)
                  .map(([motivo, n]) => `${n} por ${motivo.replace(/_/g, ' ')}`)
                  .join(' · ')}
              </p>
            )}
          </div>
        )}
      </section>

      {sinSemilla.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <strong>{sinSemilla.length} jugadores sin semilla.</strong> Su categoría no tiene fila en la
          escalera de siembra, así que no entran al rating: {sinSemilla.map((p) => p.full_name).join(', ')}
        </section>
      )}

      {categoriasOrdenadas.map((code) => (
        <section
          key={code}
          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm"
        >
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
            <Badge color={categoryColor(typeOf.get(code))}>{code}</Badge>
          </div>
          <ul>
            {(porCategoria.get(code) ?? []).map((p) => (
              <li key={p.id} className="border-b border-slate-100 last:border-0">
                <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <Avatar name={p.full_name} color={teamById.get(p.team_id ?? '')?.color} size={26} />
                  <Link
                    to={`/jugadores/${p.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:opacity-70"
                  >
                    {p.full_name}
                  </Link>

                  {p.is_waitlisted && <Badge color="slate">En espera</Badge>}
                  {p.rating_seed_source === 'dictado' && <Badge color="emerald">Dictado</Badge>}

                  <span className="tabular-nums text-xs text-slate-500">
                    semilla {p.rating_seed ?? '—'}
                  </span>
                  <span className="tabular-nums text-xs text-slate-500">{p.rating_matches} PJ</span>
                  <span className="w-12 text-right text-sm font-bold tabular-nums text-slate-900">
                    {p.rating ?? '—'}
                  </span>

                  {canEdit && (
                    <button
                      onClick={() => setAbierto(abierto === p.id ? null : p.id)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-sky-600 hover:bg-slate-50"
                    >
                      {abierto === p.id ? 'Cerrar' : 'Editar'}
                    </button>
                  )}
                </div>

                {abierto === p.id && canEdit && (
                  <EditorJugador
                    jugador={p}
                    seasonId={temporadaId}
                    rounds={rounds.data ?? []}
                    ajustes={(ajustes.data ?? []).filter((a) => a.player_id === p.id)}
                    onDone={() => setAbierto(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function EditorJugador({
  jugador,
  seasonId,
  rounds,
  ajustes,
  onDone,
}: {
  jugador: RatingRosterRow
  seasonId: string
  rounds: Array<{ id: string; round_number: number; name: string | null }>
  ajustes: Array<{ id: string; delta: number; reason: string; round_id: string | null }>
  onDone: () => void
}) {
  const setSeed = useSetRatingSeed()
  const addAjuste = useAddRatingAdjustment()
  const delAjuste = useDeleteRatingAdjustment()

  const [seed, setSeedValue] = useState(String(jugador.rating_seed ?? ''))
  const [delta, setDelta] = useState('')
  const [motivo, setMotivo] = useState('')
  const [roundId, setRoundId] = useState('')

  const seedNum = Number(seed)
  const seedValida = seed.trim() !== '' && Number.isFinite(seedNum) && seedNum !== jugador.rating_seed
  const deltaNum = Number(delta)
  const ajusteValido =
    delta.trim() !== '' && Number.isFinite(deltaNum) && deltaNum !== 0 && motivo.trim().length > 2

  const trabajando = setSeed.isPending || addAjuste.isPending || delAjuste.isPending
  const error = (setSeed.error ?? addAjuste.error ?? delAjuste.error) as Error | null

  return (
    <div className="space-y-3 bg-slate-50 px-3 py-3">
      {/* Semilla */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          Semilla
          <input
            value={seed}
            onChange={(e) => setSeedValue(e.target.value)}
            inputMode="numeric"
            className="mt-1 block w-24 rounded-lg px-2 py-1 text-sm tabular-nums"
          />
        </label>
        <button
          disabled={!seedValida || trabajando}
          onClick={() => setSeed.mutate({ playerId: jugador.id, seed: seedNum, seasonId })}
          className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 disabled:opacity-50"
        >
          Guardar semilla
        </button>
        <p className="text-xs text-slate-500">
          Cambiarla recalcula la temporada entera desde ese punto de partida.
        </p>
      </div>

      {/* Ajuste manual */}
      <div className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
        <label className="text-xs text-slate-500">
          Ajuste
          <input
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="+50"
            inputMode="numeric"
            className="mt-1 block w-20 rounded-lg px-2 py-1 text-sm tabular-nums"
          />
        </label>
        <label className="text-xs text-slate-500">
          Desde la jornada
          <select
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
            className="mt-1 block rounded-lg px-2 py-1 text-sm"
          >
            <option value="">Antes de empezar</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                J{r.round_number}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 text-xs text-slate-500">
          Motivo
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por qué se ajusta"
            className="mt-1 block w-full rounded-lg px-2 py-1 text-sm"
          />
        </label>
        <button
          disabled={!ajusteValido || trabajando}
          onClick={() =>
            addAjuste.mutate(
              { playerId: jugador.id, seasonId, roundId: roundId || null, delta: deltaNum, reason: motivo.trim() },
              { onSuccess: () => { setDelta(''); setMotivo('') } },
            )
          }
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Registrar ajuste
        </button>
      </div>

      {ajustes.length > 0 && (
        <ul className="space-y-1 border-t border-slate-200 pt-3">
          {ajustes.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-10 text-right font-semibold tabular-nums text-slate-900">
                {a.delta > 0 ? `+${a.delta}` : a.delta}
              </span>
              <span className="min-w-0 flex-1 truncate">{a.reason}</span>
              <button
                onClick={() => delAjuste.mutate({ id: a.id, seasonId })}
                disabled={trabajando}
                className="text-rose-400 hover:underline disabled:opacity-50"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {trabajando && <p className="text-xs text-slate-500">Recalculando la temporada…</p>}
      {error && <p className="text-sm text-rose-400">{error.message}</p>}

      <button onClick={onDone} className="text-xs text-slate-500 hover:underline">
        Cerrar
      </button>
    </div>
  )
}
