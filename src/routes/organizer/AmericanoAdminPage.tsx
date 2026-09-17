import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import {
  useLeagueSeason,
  useSeasonCategories,
  useSeasonTimeBlocks,
  useSeasonPlayerCount,
} from '@/features/leagues/useLeagues'
import { useRounds } from '@/features/schedule/useRounds'
import {
  useIndMatches,
  usePlayersMap,
  useCourts,
  usePenalties,
  useSaveIndMatch,
  useDeleteIndMatch,
  useSaveIndResult,
  useDeleteIndResult,
  useSetRoundStatus,
  useAddPenalty,
  useDeletePenalty,
} from '@/features/americano/useAmericano'
import type { IndMatch } from '@/features/americano/types'
import type { Round } from '@/features/schedule/types'
import { pmLabel, longDate } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Loader } from '@/components/ui/Loader'
import { Icon } from '@/components/ui/Icon'
import type { SetInput } from '@/features/results/resultLogic'

// Jornadas de una liga AMERICANO (/app/organizador/liga/:slug/jornadas):
// publicar/despublicar, juegos de 4 con sus candados, captura de resultados
// y penalizaciones. El hub del panel por liga vive una ruta arriba
// (OrganizerLeaguePanelPage). Los candados reales viven en el servidor
// (0051); aquí solo hay avisos y comodidad.
export function AmericanoAdminPage() {
  const { leagueSlug } = useParams<{ leagueSlug: string }>()
  const seasonQ = useLeagueSeason(leagueSlug)
  const season = seasonQ.data
  const rounds = useRounds(season?.id)
  const [roundId, setRoundId] = useState<string | null>(null)

  if (seasonQ.isLoading) return <Loader label="Cargando…" />
  if (!season || season.league.kind !== 'americano') {
    return (
      <div>
        <PageHeader title="Liga" />
        <EmptyState
          icon="organizer"
          title="Liga no encontrada"
          description="Esta sección administra ligas de formato americano."
        />
      </div>
    )
  }

  const list = rounds.data ?? []
  const selected = roundId ? list.find((r) => r.id === roundId) : list[0]

  return (
    <div className="space-y-5">
      <PageHeader
        title={season.league.name}
        subtitle={`${season.name} · administra jornadas, juegos y resultados`}
      />

      <RosterSummary seasonId={season.id} maxPlayers={season.max_players} />

      {list.length === 0 ? (
        <EmptyState
          icon="schedule"
          title="Sin jornadas"
          description="Esta edición no tiene jornadas creadas (migración 0051)."
        />
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {list.map((r) => {
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
                  {r.status !== 'published' && <span className="ml-1 text-[10px] text-slate-500">·borrador</span>}
                </button>
              )
            })}
          </div>

          {selected && <RoundPanel key={selected.id} round={selected} seasonId={season.id} />}
        </>
      )}

      <PenaltiesSection seasonId={season.id} />
    </div>
  )
}

function RosterSummary({ seasonId, maxPlayers }: { seasonId: string; maxPlayers: number | null }) {
  const count = useSeasonPlayerCount(seasonId)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-300">
        <Icon name="account" size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">Roster de la edición</p>
        <p className="text-sm font-medium text-slate-800">
          {count.data ?? '…'} jugadoras{maxPlayers != null && ` de ${maxPlayers}`}
          <Link to="/app/organizador/inscripciones" className="ml-2 text-sky-300 underline">
            inscripciones
          </Link>
          <Link to="/femenil/tabla" className="ml-2 text-sky-300 underline">
            tabla pública
          </Link>
        </p>
      </div>
    </div>
  )
}

function RoundPanel({ round, seasonId }: { round: Round; seasonId: string }) {
  const matches = useIndMatches(round.id)
  const playersMap = usePlayersMap(seasonId)
  const blocks = useSeasonTimeBlocks(seasonId)
  const courts = useCourts()
  const setStatus = useSetRoundStatus()
  const [editing, setEditing] = useState<'new' | string | null>(null)

  const blockById = useMemo(() => new Map((blocks.data ?? []).map((b) => [b.id, b])), [blocks.data])
  const courtById = useMemo(() => new Map((courts.data ?? []).map((c) => [c.id, c])), [courts.data])

  const games = useMemo(() => {
    const listed = [...(matches.data ?? [])]
    listed.sort((a, b) => {
      const sa = a.time_block_id ? (blockById.get(a.time_block_id)?.sort_order ?? 99) : 99
      const sb = b.time_block_id ? (blockById.get(b.time_block_id)?.sort_order ?? 99) : 99
      if (sa !== sb) return sa - sb
      return (a.court_id ? (courtById.get(a.court_id)?.number ?? 99) : 99) -
             (b.court_id ? (courtById.get(b.court_id)?.number ?? 99) : 99)
    })
    return listed
  }, [matches.data, blockById, courtById])

  // Jugadoras ya programadas en la jornada (para marcar en los selects).
  const usedByMatch = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of matches.data ?? []) for (const p of g.players) m.set(p.player_id, g.id)
    return m
  }, [matches.data])

  const published = round.status === 'published'

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg text-slate-900">
            {round.name ?? `Jornada ${round.round_number}`}
          </h2>
          {round.round_date && (
            <p className="text-xs text-slate-500">lunes {longDate(round.round_date)} · {games.length} juegos</p>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            setStatus.mutate({ roundId: round.id, seasonId, status: published ? 'draft' : 'published' })
          }
          disabled={setStatus.isPending}
          className={
            published
              ? 'rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50'
              : 'rounded-lg bg-brand-400 px-3 py-2 text-sm font-semibold text-[#0c0c0f] disabled:opacity-50'
          }
        >
          {setStatus.isPending ? 'Guardando…' : published ? 'Volver a borrador' : 'Publicar jornada'}
        </button>
      </div>

      {setStatus.isError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {(setStatus.error as Error).message}
        </p>
      )}
      {!published && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
          Borrador: el público NO ve esta jornada hasta publicarla.
        </p>
      )}

      {editing === 'new' ? (
        <GameForm
          seasonId={seasonId}
          roundId={round.id}
          playersMap={playersMap.data}
          usedByMatch={usedByMatch}
          onClose={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="neu-raised flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700"
        >
          <Icon name="plus" size={16} /> Agregar juego
        </button>
      )}

      {matches.isLoading ? (
        <Loader label="Cargando juegos…" />
      ) : (
        games.map((g) =>
          editing === g.id ? (
            <GameForm
              key={g.id}
              seasonId={seasonId}
              roundId={round.id}
              match={g}
              playersMap={playersMap.data}
              usedByMatch={usedByMatch}
              onClose={() => setEditing(null)}
            />
          ) : (
            <AdminGameCard
              key={g.id}
              game={g}
              seasonId={seasonId}
              roundId={round.id}
              name={(id) => playersMap.data?.get(id)?.full_name ?? '—'}
              block={g.time_block_id ? blockById.get(g.time_block_id)?.label : undefined}
              court={g.court_id ? courtById.get(g.court_id)?.number : undefined}
              onEdit={() => setEditing(g.id)}
            />
          )
        )
      )}
    </section>
  )
}

type PlayersMap = Map<string, { id: string; full_name: string; category_code: string; is_waitlisted: boolean }>

function GameForm({
  seasonId,
  roundId,
  match,
  playersMap,
  usedByMatch,
  onClose,
}: {
  seasonId: string
  roundId: string
  match?: IndMatch
  playersMap: PlayersMap | undefined
  usedByMatch: Map<string, string>
  onClose: () => void
}) {
  const categories = useSeasonCategories(seasonId)
  const blocks = useSeasonTimeBlocks(seasonId)
  const courts = useCourts()
  const save = useSaveIndMatch()
  const del = useDeleteIndMatch()

  const initialPlayers = useMemo(() => {
    if (!match) return ['', '', '', ''] as [string, string, string, string]
    const bySideSlot = [...match.players].sort((a, b) => a.side - b.side || a.slot - b.slot)
    const ids = bySideSlot.map((p) => p.player_id)
    while (ids.length < 4) ids.push('')
    return ids.slice(0, 4) as [string, string, string, string]
  }, [match])

  const [categoryCode, setCategoryCode] = useState(match?.category_code ?? '')
  const [timeBlockId, setTimeBlockId] = useState(match?.time_block_id ?? '')
  const [courtId, setCourtId] = useState(match?.court_id ?? '')
  const [playerIds, setPlayerIds] = useState<[string, string, string, string]>(initialPlayers)

  const cats = (categories.data ?? []).filter((c) => c.is_ranking && c.is_active)
  const allPlayers = useMemo(
    () =>
      [...(playersMap?.values() ?? [])]
        .filter((p) => !p.is_waitlisted)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')),
    [playersMap]
  )

  function playerOptions(selfId: string) {
    const inCat = allPlayers.filter((p) => p.category_code === categoryCode)
    const others = allPlayers.filter((p) => p.category_code !== categoryCode)
    const taken = (p: { id: string }) => {
      const at = usedByMatch.get(p.id)
      return at != null && at !== match?.id && p.id !== selfId
    }
    return { inCat, others, taken }
  }

  function setPlayer(i: number, id: string) {
    setPlayerIds((prev) => {
      const next = [...prev] as [string, string, string, string]
      next[i] = id
      return next
    })
  }

  function onSave() {
    save.mutate(
      {
        matchId: match?.id,
        seasonId,
        roundId,
        categoryCode,
        courtId: courtId || null,
        timeBlockId: timeBlockId || null,
        playerIds,
      },
      { onSuccess: onClose }
    )
  }

  const labels = ['Pareja 1 · A', 'Pareja 1 · B', 'Pareja 2 · A', 'Pareja 2 · B']

  return (
    <div className="space-y-3 rounded-2xl border border-brand-500/30 bg-slate-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">{match ? 'Editar juego' : 'Nuevo juego'}</p>

      {(save.isError || del.isError) && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {((save.error ?? del.error) as Error).message}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Categoría</span>
          <select
            value={categoryCode}
            onChange={(e) => setCategoryCode(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-2 py-2 text-sm text-slate-800"
          >
            <option value="" disabled>Elegir</option>
            {cats.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Horario</span>
          <select
            value={timeBlockId}
            onChange={(e) => setTimeBlockId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-2 py-2 text-sm text-slate-800"
          >
            <option value="">—</option>
            {(blocks.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>{pmLabel(b.label)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Cancha</span>
          <select
            value={courtId}
            onChange={(e) => setCourtId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-2 py-2 text-sm text-slate-800"
          >
            <option value="">—</option>
            {(courts.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.number}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {playerIds.map((pid, i) => {
          const { inCat, others, taken } = playerOptions(pid)
          return (
            <label key={i} className="block">
              <span className="block text-xs font-medium text-slate-600">{labels[i]}</span>
              <select
                value={pid}
                onChange={(e) => setPlayer(i, e.target.value)}
                disabled={!categoryCode}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-2 py-2 text-sm text-slate-800"
              >
                <option value="">{categoryCode ? 'Elegir jugadora' : 'Elige categoría primero'}</option>
                {inCat.map((p) => (
                  <option key={p.id} value={p.id} disabled={taken(p)}>
                    {p.full_name}{taken(p) ? ' · ya juega' : ''}
                  </option>
                ))}
                {others.length > 0 && <option disabled>— otras categorías (sustitución) —</option>}
                {others.map((p) => (
                  <option key={p.id} value={p.id} disabled={taken(p)}>
                    {p.full_name} ({p.category_code.replace('FEM_', '') + 'a'}){taken(p) ? ' · ya juega' : ''}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={save.isPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-400 px-3 py-2 text-sm font-semibold text-[#0c0c0f] disabled:opacity-50"
        >
          <Icon name="check" size={16} /> {save.isPending ? 'Guardando…' : 'Guardar juego'}
        </button>
        {match && (
          <button
            type="button"
            onClick={() => del.mutate({ matchId: match.id, roundId }, { onSuccess: onClose })}
            disabled={del.isPending}
            className="rounded-lg border border-red-300/50 px-3 py-2 text-sm font-medium text-red-400 disabled:opacity-50"
          >
            Borrar
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function AdminGameCard({
  game,
  seasonId,
  roundId,
  name,
  block,
  court,
  onEdit,
}: {
  game: IndMatch
  seasonId: string
  roundId: string
  name: (id: string) => string
  block?: string
  court?: number
  onEdit: () => void
}) {
  const [capturing, setCapturing] = useState(false)
  const side = (n: 1 | 2) =>
    game.players
      .filter((p) => p.side === n)
      .sort((a, b) => a.slot - b.slot)
      .map((p) => name(p.player_id))
      .join(' + ')

  const r = game.result
  const score = r
    ? r.is_walkover
      ? `W.O. (pareja ${r.walkover_side} ausente)`
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
          {block ? pmLabel(block) : 'Sin horario'}
          {court != null && ` · Cancha ${court}`}
          {' · '}
          {game.category_code.replace('FEM_', '') + 'a'}
        </span>
        <button type="button" onClick={onEdit} className="text-sky-300 underline">
          Editar
        </button>
      </div>

      <p className={`mt-1.5 text-sm ${r?.winner_side === 1 ? 'font-semibold text-brand-300' : 'font-medium text-slate-800'}`}>
        {side(1)}
      </p>
      <p className={`text-sm ${r?.winner_side === 2 ? 'font-semibold text-brand-300' : 'font-medium text-slate-800'}`}>
        {side(2)}
      </p>

      {capturing ? (
        <ResultForm game={game} seasonId={seasonId} roundId={roundId} onClose={() => setCapturing(false)} />
      ) : (
        <div className="mt-2 flex items-center gap-2">
          {score && (
            <span className="rounded-lg bg-slate-50 px-2.5 py-1 font-heading text-sm tracking-wide text-slate-900">
              {score}
            </span>
          )}
          <button
            type="button"
            onClick={() => setCapturing(true)}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700"
          >
            {r ? 'Corregir resultado' : 'Capturar resultado'}
          </button>
        </div>
      )}
    </div>
  )
}

function ResultForm({
  game,
  seasonId,
  roundId,
  onClose,
}: {
  game: IndMatch
  seasonId: string
  roundId: string
  onClose: () => void
}) {
  const { profile } = useAuth()
  const save = useSaveIndResult()
  const remove = useDeleteIndResult()
  const r = game.result

  const init = (a: number | null | undefined, b: number | null | undefined): SetInput => ({
    a: a ?? null,
    b: b ?? null,
  })
  const [s1, setS1] = useState<SetInput>(init(r?.set1_side1, r?.set1_side2))
  const [s2, setS2] = useState<SetInput>(init(r?.set2_side1, r?.set2_side2))
  const [s3, setS3] = useState<SetInput>(init(r?.set3_side1, r?.set3_side2))
  const [walkover, setWalkover] = useState(r?.is_walkover ?? false)
  const [woSide, setWoSide] = useState<1 | 2 | null>(r?.walkover_side ?? null)

  function num(v: string): number | null {
    if (v.trim() === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const setRow = (
    label: string,
    val: SetInput,
    set: (s: SetInput) => void
  ) => (
    <div className="flex items-center gap-2">
      <span className="w-10 text-xs text-slate-500">{label}</span>
      <input
        type="number" min={0} max={7} inputMode="numeric"
        value={val.a ?? ''}
        onChange={(e) => set({ ...val, a: num(e.target.value) })}
        className="w-14 rounded-lg px-2 py-1.5 text-center text-sm text-slate-900"
        aria-label={`${label} pareja 1`}
      />
      <span className="text-slate-500">–</span>
      <input
        type="number" min={0} max={7} inputMode="numeric"
        value={val.b ?? ''}
        onChange={(e) => set({ ...val, b: num(e.target.value) })}
        className="w-14 rounded-lg px-2 py-1.5 text-center text-sm text-slate-900"
        aria-label={`${label} pareja 2`}
      />
    </div>
  )

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-brand-500/30 bg-slate-50 p-3">
      {(save.isError || remove.isError) && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {((save.error ?? remove.error) as Error).message}
        </p>
      )}

      {!walkover && (
        <div className="space-y-1.5">
          {setRow('Set 1', s1, setS1)}
          {setRow('Set 2', s2, setS2)}
          {setRow('Set 3', s3, setS3)}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={walkover} onChange={(e) => setWalkover(e.target.checked)} />
        Walkover (una pareja no se presentó)
      </label>
      {walkover && (
        <div className="flex gap-2">
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={woSide === n}
              onClick={() => setWoSide(n)}
              className={
                woSide === n
                  ? 'neu-pressed flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-300'
                  : 'neu-raised flex-1 rounded-lg px-2 py-1.5 text-xs text-slate-700'
              }
            >
              Ausente: pareja {n}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            save.mutate(
              {
                matchId: game.id, roundId, seasonId,
                set1: s1, set2: s2, set3: s3,
                walkover, walkoverSide: woSide,
                profileId: profile?.id ?? null,
              },
              { onSuccess: onClose }
            )
          }
          disabled={save.isPending}
          className="flex-1 rounded-lg bg-brand-400 px-3 py-2 text-sm font-semibold text-[#0c0c0f] disabled:opacity-50"
        >
          {save.isPending ? 'Guardando…' : 'Guardar resultado'}
        </button>
        {r && (
          <button
            type="button"
            onClick={() => remove.mutate({ matchId: game.id, roundId, seasonId }, { onSuccess: onClose })}
            disabled={remove.isPending}
            className="rounded-lg border border-red-300/50 px-3 py-2 text-sm text-red-400 disabled:opacity-50"
          >
            Borrar
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
          Cerrar
        </button>
      </div>
    </div>
  )
}

function PenaltiesSection({ seasonId }: { seasonId: string }) {
  const penalties = usePenalties(seasonId)
  const playersMap = usePlayersMap(seasonId)
  const add = useAddPenalty()
  const remove = useDeletePenalty()
  const [open, setOpen] = useState(false)
  const [playerId, setPlayerId] = useState('')
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')

  const players = useMemo(
    () => [...(playersMap.data?.values() ?? [])].sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')),
    [playersMap.data]
  )

  function onAdd() {
    const n = Number(points)
    if (!playerId || !Number.isFinite(n) || n <= 0 || !reason.trim()) return
    add.mutate(
      { seasonId, playerId, points: n, reason },
      { onSuccess: () => { setPlayerId(''); setPoints(''); setReason('') } }
    )
  }

  return (
    <section className="rounded-2xl bg-slate-100 p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="font-semibold text-slate-800">
          Penalizaciones{penalties.data && penalties.data.length > 0 ? ` (${penalties.data.length})` : ''}
        </span>
        <Icon name="chevron-right" size={16} className={open ? 'rotate-90' : ''} />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">
            Restan puntos en la tabla. El motivo es interno (no se publica).
          </p>

          {add.isError && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {(add.error as Error).message}
            </p>
          )}

          <div className="grid grid-cols-[1fr_4.5rem] gap-2">
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-slate-100 px-2 py-2 text-sm text-slate-800"
            >
              <option value="">Jugadora…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <input
              type="number" min={1} inputMode="numeric" placeholder="Pts"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="rounded-lg px-2 py-2 text-center text-sm text-slate-900"
            />
          </div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (interno)"
            className="w-full rounded-lg px-3 py-2 text-sm text-slate-900"
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={add.isPending}
            className="w-full rounded-lg bg-brand-400 px-3 py-2 text-sm font-semibold text-[#0c0c0f] disabled:opacity-50"
          >
            {add.isPending ? 'Guardando…' : 'Registrar penalización'}
          </button>

          {(penalties.data ?? []).map((pen) => (
            <div key={pen.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-slate-700">
                −{pen.points} · {playersMap.data?.get(pen.player_id)?.full_name ?? '—'}
                <span className="block truncate text-xs text-slate-500">{pen.reason}</span>
              </span>
              <button
                type="button"
                onClick={() => remove.mutate({ id: pen.id, seasonId })}
                className="shrink-0 text-xs text-red-400 underline"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
