import { useEffect, useMemo, useRef, useState } from 'react'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useCategories } from '@/features/categories/useCategories'
import { rankingCategories } from '@/features/registration/category'
import { useDraftView } from '@/features/draft/useDraftView'
import {
  useCreateDraft,
  useSetDraftOrder,
  useStartDraft,
  useBeginCategory,
  useUpdateDraftSeconds,
  usePauseDraft,
  useResumeDraft,
  useResetDraft,
  useAutoPick,
} from '@/features/draft/mutations'
import { remainingMs } from '@/features/draft/clock'
import { PickClock } from '@/features/draft/components/PickClock'
import { DraftBoard } from '@/features/draft/components/DraftBoard'
import { DrawReveal } from '@/features/draft/components/DrawReveal'
import { PoolPicker } from '@/features/draft/components/PoolPicker'
import type { Draft } from '@/features/draft/types'
import { TeamCrest } from '@/components/ui/TeamCrest'
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
  const [seconds, setLocalSeconds] = useState(draft.pick_seconds)

  const teams = view.teams
  const ranking = useMemo(() => rankingCategories(cats.data ?? []), [cats.data])
  const counts = useMemo(
    () => ranking.map((c) => ({ code: c.code, count: view.pool.filter((p) => p.category_code === c.code).length })),
    [ranking, view.pool],
  )

  async function startNow() {
    // draft_teams solo registra a los equipos PARTICIPANTES; el orden se sortea
    // por categoría en vivo (0028), así que el pick_number aquí es irrelevante.
    await setOrder.mutateAsync({
      draftId: draft.id,
      order: teams.map((t, i) => ({ team_id: t.id, pick_number: i + 1 })),
    })
    await start.mutateAsync({ draftId: draft.id, seasonId })
  }

  const poolTotal = view.pool.length
  const canStart = teams.length >= 2 && poolTotal > 0 && !start.isPending && !setOrder.isPending

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-slate-50 p-5 shadow-md">
        <p className="font-heading text-sm text-slate-900">Equipos participantes</p>
        <p className="mt-0.5 text-xs text-slate-500">
          El orden de elección se sortea EN VIVO antes de cada categoría (visible para todos).
        </p>
        <ul className="mt-3 space-y-1.5">
          {teams.map((t) => (
            <li key={t.id} className="neu-raised flex items-center gap-2 rounded-xl px-3 py-2">
              <TeamCrest name={t.name} logoUrl={t.logo_url} color={t.color} size={22} />
              <span className="flex-1 truncate text-sm font-medium text-slate-800">{t.name}</span>
            </li>
          ))}
        </ul>
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
          Pool: <strong className="text-slate-900">{poolTotal}</strong> jugadoras a repartir
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
          Antes de iniciar: cierra el registro, asigna 1 capitana por equipo y verifica el pool. La
          categoría de cada capitana le da un pick menos a su equipo (su último turno será "no pick").
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
  const reset = useResetDraft()
  const beginCategory = useBeginCategory()
  const cats = useCategories()
  useHostTimer(draft.status === 'active' && !view.isDrawing ? draft.id : undefined, seasonId, draft.pick_deadline)

  function doReset() {
    if (
      !window.confirm(
        '¿Reiniciar el draft? Se borran TODOS los picks y los jugadores drafteados vuelven al pool. Úsalo solo para pruebas.',
      )
    )
      return
    reset.mutate({ draftId: draft.id, seasonId })
  }

  const current = view.current
  const currentTeam = current ? view.teamsById.get(current.team_id) : null
  const catName = (current && cats.data?.find((c) => c.code === current.category_code)?.name) || ''

  return (
    <div className="space-y-4">
      {view.isDrawing ? (
        // Fase de SORTEO: animación del orden de la categoría actual + botón para empezar.
        <>
          <DrawReveal
            key={view.currentCategory ?? 'draw'}
            categoryName={catName || 'Siguiente categoría'}
            order={view.drawnOrder}
            canStart
            starting={beginCategory.isPending}
            onStart={() => beginCategory.mutate({ draftId: draft.id, seasonId })}
          />
          {beginCategory.isError && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {(beginCategory.error as Error).message}
            </p>
          )}
        </>
      ) : (
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
                    <TeamCrest name={currentTeam?.name ?? '—'} logoUrl={currentTeam?.logo_url} color={currentTeam?.color} size={24} />
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
      )}

      {draft.status === 'active' && !view.isDrawing && current && (
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

      <section className="rounded-3xl border border-red-200 bg-red-50/60 p-4">
        <p className="text-sm font-semibold text-red-700">Zona de pruebas</p>
        <p className="mt-0.5 text-xs text-red-600">
          Reiniciar borra todos los picks y regresa a los jugadores al pool. El draft vuelve a
          "por iniciar".
        </p>
        {reset.isError && (
          <p className="mt-2 rounded-lg border border-red-300 bg-red-100 p-2 text-xs text-red-700">
            {(reset.error as Error).message}
          </p>
        )}
        <button
          onClick={doReset}
          disabled={reset.isPending}
          className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50"
        >
          {reset.isPending ? 'Reiniciando…' : 'Reiniciar draft (prueba)'}
        </button>
      </section>
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
