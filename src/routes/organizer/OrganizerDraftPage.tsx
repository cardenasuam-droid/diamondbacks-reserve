import { useEffect, useMemo, useRef, useState } from 'react'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useCategories } from '@/features/categories/useCategories'
import { rankingCategories } from '@/features/registration/category'
import { useDraftView } from '@/features/draft/useDraftView'
import {
  useCreateDraft,
  useSetDraftOrder,
  useStartDraft,
  useUpdateDraftSeconds,
  usePauseDraft,
  useResumeDraft,
  useAutoPick,
} from '@/features/draft/mutations'
import { generateDraftSlots } from '@/features/draft/draftSlots'
import { remainingMs } from '@/features/draft/clock'
import { PickClock } from '@/features/draft/components/PickClock'
import { DraftBoard } from '@/features/draft/components/DraftBoard'
import { PoolPicker } from '@/features/draft/components/PoolPicker'
import type { Draft } from '@/features/draft/types'
import { teamColor } from '@/lib/color'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Loader } from '@/components/ui/Loader'
import { Icon } from '@/components/ui/Icon'

export function OrganizerDraftPage() {
  const season = useActiveSeason()
  const view = useDraftView(season.data?.id)

  if (season.isLoading) return <Loader label="Cargando…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Draft" />
        <EmptyState icon="organizer" title="No hay temporada activa" description="Activa una temporada primero." />
      </div>
    )
  }

  const draft = view.draft
  return (
    <div className="space-y-5">
      <PageHeader title="Draft" subtitle={season.data.name} />
      {view.isLoading ? (
        <Loader label="Cargando draft…" />
      ) : !draft ? (
        <CreateDraftCard seasonId={season.data.id} />
      ) : draft.status === 'setup' ? (
        <SetupPanel draft={draft} seasonId={season.data.id} view={view} />
      ) : (
        <LivePanel draft={draft} seasonId={season.data.id} view={view} />
      )}
    </div>
  )
}

function CreateDraftCard({ seasonId }: { seasonId: string }) {
  const create = useCreateDraft()
  return (
    <div className="rounded-3xl bg-slate-50 p-6 text-center shadow-md">
      <p className="font-heading text-lg text-slate-900">Aún no hay draft</p>
      <p className="mt-1 text-sm text-slate-500">
        Crea el draft de la temporada. Después asignas el orden y lo inicias.
      </p>
      {create.isError && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {(create.error as Error).message}
        </p>
      )}
      <button
        onClick={() => create.mutate(seasonId)}
        disabled={create.isPending}
        className="mt-4 rounded-xl bg-gold-300 px-4 py-2.5 font-semibold text-[#1a1405] shadow-sm disabled:opacity-50"
      >
        {create.isPending ? 'Creando…' : 'Crear draft'}
      </button>
    </div>
  )
}

function SetupPanel({
  draft,
  seasonId,
  view,
}: {
  draft: Draft
  seasonId: string
  view: ReturnType<typeof useDraftView>
}) {
  const cats = useCategories()
  const setOrder = useSetDraftOrder()
  const setSeconds = useUpdateDraftSeconds()
  const start = useStartDraft()
  const [orderIds, setOrderIds] = useState<string[] | null>(null)
  const [seconds, setLocalSeconds] = useState(draft.pick_seconds)

  // Inicializa el orden desde draft_teams (si existe) o desde los equipos.
  useEffect(() => {
    if (orderIds) return
    const fromOrder = view.order.map((o) => o.team_id)
    const base = fromOrder.length ? fromOrder : view.teams.map((t) => t.id)
    if (base.length) setOrderIds(base)
  }, [view.order, view.teams, orderIds])

  const order = orderIds ?? []
  const teamsById = view.teamsById

  const ranking = useMemo(() => rankingCategories(cats.data ?? []), [cats.data])
  const counts = useMemo(
    () => ranking.map((c) => ({ code: c.code, count: view.pool.filter((p) => p.category_code === c.code).length })),
    [ranking, view.pool],
  )
  const totalSlots = useMemo(
    () => generateDraftSlots(order.map((id) => ({ id })), counts).length,
    [order, counts],
  )

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= order.length) return
    const next = order.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrderIds(next)
  }
  function shuffle() {
    const next = order.slice()
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[next[i], next[j]] = [next[j], next[i]]
    }
    setOrderIds(next)
  }

  async function startNow() {
    await setOrder.mutateAsync({
      draftId: draft.id,
      order: order.map((team_id, i) => ({ team_id, pick_number: i + 1 })),
    })
    await start.mutateAsync({ draftId: draft.id, seasonId })
  }

  const poolTotal = view.pool.length
  const canStart = order.length >= 2 && poolTotal > 0 && !start.isPending && !setOrder.isPending

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-slate-50 p-5 shadow-md">
        <p className="font-heading text-sm text-slate-900">Orden de elección (snake)</p>
        <p className="mt-0.5 text-xs text-slate-500">
          El #1 elige primero; cada ronda se invierte. Reordena o aleatoriza.
        </p>
        <ul className="mt-3 space-y-1.5">
          {order.map((id, i) => {
            const t = teamsById.get(id)
            return (
              <li key={id} className="neu-raised flex items-center gap-2 rounded-xl px-3 py-2">
                <span className="w-6 text-center font-heading text-sm text-gold-300">{i + 1}</span>
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/20"
                  style={{ backgroundColor: teamColor(t?.color ?? null) }}
                  aria-hidden
                />
                <span className="flex-1 truncate text-sm font-medium text-slate-800">{t?.name ?? '—'}</span>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Subir"
                  className="rounded-lg p-1 text-slate-500 disabled:opacity-30"
                >
                  <Icon name="chevron-right" size={16} className="-rotate-90" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label="Bajar"
                  className="rounded-lg p-1 text-slate-500 disabled:opacity-30"
                >
                  <Icon name="chevron-right" size={16} className="rotate-90" />
                </button>
              </li>
            )
          })}
        </ul>
        <button
          onClick={shuffle}
          className="neu-raised mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700"
        >
          <Icon name="dev" size={16} /> Aleatorizar
        </button>
      </section>

      <section className="rounded-3xl bg-slate-50 p-5 shadow-md">
        <label className="block">
          <span className="block text-sm font-medium text-slate-700">Segundos por pick</span>
          <input
            type="number"
            min={10}
            max={600}
            value={seconds}
            onChange={(e) => setLocalSeconds(Number(e.target.value))}
            onBlur={() => setSeconds.mutate({ draftId: draft.id, seasonId, seconds })}
            className="mt-1 w-32 rounded-xl px-3 py-2.5 text-base text-slate-900"
          />
        </label>
      </section>

      <section className="rounded-3xl bg-slate-50 p-5 shadow-md">
        <p className="font-heading text-sm text-slate-900">Resumen</p>
        <p className="mt-1 text-sm text-slate-600">
          Pool: <strong className="text-slate-900">{poolTotal}</strong> jugadoras ·{' '}
          <strong className="text-slate-900">{totalSlots}</strong> picks en total
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {counts
            .filter((c) => c.count > 0)
            .map((c) => (
              <li key={c.code} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">
                {cats.data?.find((x) => x.code === c.code)?.name ?? c.code}: {c.count}
              </li>
            ))}
        </ul>
        <p className="mt-3 rounded-lg bg-brand-500/10 px-3 py-2 text-xs text-brand-200">
          Antes de iniciar: cierra el registro, asigna 1 capitana por equipo y verifica el pool. Al
          iniciar se fija el board con el pool actual.
        </p>

        {(start.isError || setOrder.isError) && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {((start.error || setOrder.error) as Error)?.message}
          </p>
        )}

        <button
          onClick={startNow}
          disabled={!canStart}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-300 px-4 py-3.5 font-semibold text-[#1a1405] shadow-sm disabled:opacity-50"
        >
          <Icon name="standings" size={18} />
          {start.isPending || setOrder.isPending ? 'Iniciando…' : 'Iniciar draft'}
        </button>
      </section>
    </div>
  )
}

function LivePanel({
  draft,
  seasonId,
  view,
}: {
  draft: Draft
  seasonId: string
  view: ReturnType<typeof useDraftView>
}) {
  const pause = usePauseDraft()
  const resume = useResumeDraft()
  const cats = useCategories()
  useHostTimer(draft.status === 'active' ? draft.id : undefined, seasonId, draft.pick_deadline)

  const current = view.current
  const currentTeam = current ? view.teamsById.get(current.team_id) : null
  const catName = (current && cats.data?.find((c) => c.code === current.category_code)?.name) || ''

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-slate-50 p-5 shadow-md">
        {draft.status === 'finished' ? (
          <p className="text-center font-heading text-lg text-slate-900">Draft finalizado 🎉</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-300">
                  {catName} {current ? `· Pick ${current.pick_number}` : ''}
                </p>
                <p className="mt-1 flex items-center gap-2 font-heading text-lg text-slate-900">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/20"
                    style={{ backgroundColor: teamColor(currentTeam?.color ?? null) }}
                    aria-hidden
                  />
                  <span className="truncate">{currentTeam?.name ?? '—'}</span>
                </p>
              </div>
              {draft.status === 'active' ? (
                <button
                  onClick={() => pause.mutate({ draftId: draft.id, seasonId })}
                  className="neu-raised shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-slate-700"
                >
                  Pausar
                </button>
              ) : (
                <button
                  onClick={() => resume.mutate({ draftId: draft.id, seasonId })}
                  className="shrink-0 rounded-xl bg-gold-300 px-3 py-2 text-sm font-semibold text-[#1a1405] shadow-sm"
                >
                  Reanudar
                </button>
              )}
            </div>
            <div className="mt-3">
              <PickClock deadline={draft.pick_deadline} status={draft.status} pickSeconds={draft.pick_seconds} />
            </div>
          </>
        )}
      </section>

      {draft.status === 'active' && current && (
        <PoolPicker
          draftId={draft.id}
          seasonId={seasonId}
          categoryCode={current.category_code}
          categoryName={catName}
          pool={view.pool}
          title={`Elegir por ${currentTeam?.name ?? 'el equipo en turno'}`}
        />
      )}

      <DraftBoard
        board={view.board}
        teamsById={view.teamsById}
        playersById={view.playersById}
        currentPickNumber={current?.pick_number ?? null}
        currentCategory={current?.category_code ?? null}
      />
    </div>
  )
}

// Timer anfitrión: la sala de control es el reloj primario. Al vencer el deadline,
// dispara el auto-pick (RPC idempotente). El ref evita repetir por el mismo deadline.
function useHostTimer(draftId: string | undefined, seasonId: string, deadline: string | null) {
  const autoPick = useAutoPick()
  const firedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!draftId || !deadline) return
    const id = setInterval(() => {
      if (remainingMs(deadline, Date.now()) > 0) return
      if (firedFor.current === deadline) return
      firedFor.current = deadline
      autoPick.mutate({ draftId, seasonId })
    }, 500)
    return () => clearInterval(id)
  }, [draftId, seasonId, deadline, autoPick])
}
