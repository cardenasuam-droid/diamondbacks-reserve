import { useMemo, useState } from 'react'
import { useLeagueSeason, useSeasonTimeBlocks } from '@/features/leagues/useLeagues'
import { useRounds } from '@/features/schedule/useRounds'
import { useIndMatches, usePlayersMap, useCourts } from '@/features/americano/useAmericano'
import type { IndMatch } from '@/features/americano/types'
import { pmLabel, longDate } from '@/lib/format'
import { LeagueShell } from './LeagueShell'
import { Loader } from '@/components/ui/Loader'
import { EmptyState } from '@/components/ui/EmptyState'

// Rol público de una liga americano (/femenil/rol): jornadas publicadas con
// sus juegos de 4, cancha/horario y marcador cuando ya hay resultado. La RLS
// (0051 + rounds) hace el gating: el público solo recibe lo publicado.
export function AmericanoSchedulePage({ slug }: { slug: string }) {
  const seasonQ = useLeagueSeason(slug)
  const season = seasonQ.data
  const rounds = useRounds(season?.id)
  const [roundId, setRoundId] = useState<string | null>(null)

  const visibleRounds = rounds.data ?? []
  // Jornada por defecto: la próxima por fecha; si todas pasaron, la última.
  const selected = useMemo(() => {
    if (roundId) return visibleRounds.find((r) => r.id === roundId) ?? null
    if (visibleRounds.length === 0) return null
    const today = new Date().toISOString().slice(0, 10)
    return visibleRounds.find((r) => (r.round_date ?? '') >= today) ?? visibleRounds[visibleRounds.length - 1]
  }, [roundId, visibleRounds])

  const matches = useIndMatches(selected?.id)
  const playersMap = usePlayersMap(season?.id)
  const blocks = useSeasonTimeBlocks(season?.id)
  const courts = useCourts()

  const blockLabel = useMemo(() => {
    const m = new Map<string, { label: string; sort: number }>()
    for (const b of blocks.data ?? []) m.set(b.id, { label: b.label, sort: b.sort_order })
    return m
  }, [blocks.data])
  const courtName = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of courts.data ?? []) m.set(c.id, c.number)
    return m
  }, [courts.data])

  const games = useMemo(() => {
    const list = [...(matches.data ?? [])]
    list.sort((a, b) => {
      const sa = a.time_block_id ? (blockLabel.get(a.time_block_id)?.sort ?? 99) : 99
      const sb = b.time_block_id ? (blockLabel.get(b.time_block_id)?.sort ?? 99) : 99
      if (sa !== sb) return sa - sb
      const ca = a.court_id ? (courtName.get(a.court_id) ?? 99) : 99
      const cb = b.court_id ? (courtName.get(b.court_id) ?? 99) : 99
      return ca - cb
    })
    return list
  }, [matches.data, blockLabel, courtName])

  if (seasonQ.isLoading) {
    return (
      <div data-league={slug} className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-md px-4 pt-16">
          <Loader label="Cargando…" />
        </div>
      </div>
    )
  }

  return (
    <LeagueShell
      slug={slug}
      leagueName={season?.league.name ?? 'Liga'}
      seasonName={season?.name}
      active="rol"
    >
      {visibleRounds.length === 0 ? (
        <EmptyState
          icon="schedule"
          title="Aún no hay rol publicado"
          description="Cuando la organizadora publique la primera jornada aparecerá aquí."
        />
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {visibleRounds.map((r) => {
              const active = selected?.id === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRoundId(r.id)}
                  className={
                    active
                      ? 'neu-pressed shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-brand-300'
                      : 'neu-raised shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-slate-700'
                  }
                >
                  J{r.round_number}
                </button>
              )
            })}
          </div>

          {selected?.round_date && (
            <p className="mt-2 text-xs text-slate-500">
              {selected.name ?? `Jornada ${selected.round_number}`} · lunes{' '}
              {longDate(selected.round_date)}
            </p>
          )}

          {matches.isLoading ? (
            <Loader label="Cargando juegos…" />
          ) : games.length === 0 ? (
            <EmptyState
              icon="schedule"
              title="Jornada sin juegos publicados"
              description="El rol de esta jornada aparecerá aquí en cuanto se publique."
            />
          ) : (
            <div className="mt-3 space-y-3">
              {games.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  name={(id) => playersMap.data?.get(id)?.full_name ?? '—'}
                  block={g.time_block_id ? blockLabel.get(g.time_block_id)?.label : undefined}
                  court={g.court_id ? courtName.get(g.court_id) : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}
    </LeagueShell>
  )
}

function sideNames(game: IndMatch, side: 1 | 2, name: (id: string) => string): string {
  return game.players
    .filter((p) => p.side === side)
    .sort((a, b) => a.slot - b.slot)
    .map((p) => name(p.player_id))
    .join(' + ')
}

function GameCard({
  game,
  name,
  block,
  court,
}: {
  game: IndMatch
  name: (id: string) => string
  block?: string
  court?: number
}) {
  const r = game.result
  const winner = r?.winner_side ?? null

  const score = r
    ? r.is_walkover
      ? 'W.O.'
      : [
          [r.set1_side1, r.set1_side2],
          [r.set2_side1, r.set2_side2],
          [r.set3_side1, r.set3_side2],
        ]
          .filter(([a, b]) => a != null && b != null)
          .map(([a, b]) => `${a}-${b}`)
          .join('  ')
    : null

  return (
    <div className="rounded-2xl bg-slate-100 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {block ? pmLabel(block) : 'Horario por definir'}
          {court != null && ` · Cancha ${court}`}
        </span>
        <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 font-medium text-brand-200">
          {game.category_code.replace('FEM_', '') + 'a'}
        </span>
      </div>

      <div className="mt-2 space-y-1">
        <p className={winner === 1 ? 'font-semibold text-brand-300' : 'font-medium text-slate-800'}>
          {sideNames(game, 1, name)}
        </p>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">vs</p>
        <p className={winner === 2 ? 'font-semibold text-brand-300' : 'font-medium text-slate-800'}>
          {sideNames(game, 2, name)}
        </p>
      </div>

      {score && (
        <p className="mt-2 inline-block rounded-lg bg-slate-50 px-2.5 py-1 font-heading text-sm tracking-wide text-slate-900">
          {score}
        </p>
      )}
    </div>
  )
}
