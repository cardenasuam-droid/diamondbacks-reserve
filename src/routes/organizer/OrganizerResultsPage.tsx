import { useState } from 'react'
import { useAuth } from '@/features/auth/context'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useRounds } from '@/features/schedule/useRounds'
import { RoundSelector } from '@/features/schedule/RoundSelector'
import { useRoundMatches } from '@/features/schedule/useRoundMatches'
import { groupByMatchup } from '@/features/schedule/groupByMatchup'
import { scoreLine, hasOfficialResult } from '@/features/schedule/score'
import { categoryColor } from '@/features/categories/categoryColor'
import { teamColor } from '@/lib/color'
import { deriveResult, type SetInput } from '@/features/results/resultLogic'
import { useSaveResult } from '@/features/results/useSaveResult'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import type { ScheduledMatch, TeamLite } from '@/features/schedule/types'

export function OrganizerResultsPage() {
  const season = useActiveSeason()
  const rounds = useRounds(season.data?.id)
  const [roundId, setRoundId] = useState<string | undefined>()
  const selected = roundId ?? rounds.data?.[0]?.id
  const matches = useRoundMatches(selected)
  const [openMatch, setOpenMatch] = useState<string | null>(null)

  if (season.isLoading || rounds.isLoading) return <Loader label="Cargando…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Resultados" />
        <EmptyState icon="results-edit" title="No hay temporada activa" />
      </div>
    )
  }

  const groups = matches.data ? groupByMatchup(matches.data) : []

  return (
    <div>
      <PageHeader title="Resultados" subtitle={season.data.name} />

      {rounds.data && rounds.data.length > 0 ? (
        <RoundSelector rounds={rounds.data} selectedId={selected} onSelect={setRoundId} />
      ) : (
        <EmptyState icon="schedule" title="No hay jornadas" />
      )}

      {matches.isLoading ? (
        <Loader label="Cargando partidos…" />
      ) : matches.isError ? (
        <ErrorState onRetry={() => matches.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState icon="results-edit" title="Sin partidos en esta jornada" />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section
              key={g.matchupId}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                <TeamDot team={g.teamA} />
                <span className="font-semibold text-slate-800">{g.teamA?.name ?? '—'}</span>
                <span className="text-xs text-slate-500">vs</span>
                <span className="font-semibold text-slate-800">{g.teamB?.name ?? '—'}</span>
              </div>

              <ul>
                {g.matches.map((m) => (
                  <li key={m.id} className="border-b border-slate-100 last:border-0">
                    <button
                      onClick={() => setOpenMatch(openMatch === m.id ? null : m.id)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
                    >
                      <Badge color={categoryColor(m.category?.type)}>{m.category_code}</Badge>
                      <span className="flex-1 text-sm text-slate-700">{m.category?.name}</span>
                      <span className="text-sm font-medium tabular-nums text-slate-900">
                        {hasOfficialResult(m.result) ? scoreLine(m.result) : 'Sin resultado'}
                      </span>
                      <span className="text-slate-300" aria-hidden>
                        {openMatch === m.id ? '▾' : '›'}
                      </span>
                    </button>

                    {openMatch === m.id && (
                      <ResultEditor
                        match={m}
                        teamA={g.teamA}
                        teamB={g.teamB}
                        roundId={selected as string}
                        onDone={() => setOpenMatch(null)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function TeamDot({ team }: { team: TeamLite | null }) {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5"
      style={{ backgroundColor: teamColor(team?.color) }}
      aria-hidden
    />
  )
}

function num(s: string): number | null {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function ResultEditor({
  match,
  teamA,
  teamB,
  roundId,
  onDone,
}: {
  match: ScheduledMatch
  teamA: TeamLite | null
  teamB: TeamLite | null
  roundId: string
  onDone: () => void
}) {
  const { profile } = useAuth()
  const save = useSaveResult()
  const r = match.result

  const init = (a: number | null | undefined, b: number | null | undefined) => ({
    a: a == null ? '' : String(a),
    b: b == null ? '' : String(b),
  })
  const [s1, setS1] = useState(init(r?.set1_team_a, r?.set1_team_b))
  const [s2, setS2] = useState(init(r?.set2_team_a, r?.set2_team_b))
  const [s3, setS3] = useState(init(r?.set3_team_a, r?.set3_team_b))
  const [walkover, setWalkover] = useState(Boolean(r?.is_walkover))
  const [walkoverTeamId, setWalkoverTeamId] = useState<string>('')

  const sets: SetInput[] = [
    { a: num(s1.a), b: num(s1.b) },
    { a: num(s2.a), b: num(s2.b) },
    { a: num(s3.a), b: num(s3.b) },
  ]
  const derived = deriveResult(sets)
  const winnerName =
    !walkover && derived.winnerSide
      ? derived.winnerSide === 'a'
        ? teamA?.name
        : teamB?.name
      : walkover && walkoverTeamId
        ? walkoverTeamId === teamA?.id
          ? teamB?.name
          : teamA?.name
        : null

  const canSave = walkover ? Boolean(walkoverTeamId) : derived.decided

  async function handleSave() {
    try {
      await save.mutateAsync({
        matchId: match.id,
        teamAId: teamA?.id ?? '',
        teamBId: teamB?.id ?? '',
        set1: sets[0],
        set2: sets[1],
        set3: sets[2],
        walkover,
        walkoverTeamId: walkover ? walkoverTeamId : null,
        profileId: profile?.id ?? null,
        roundId,
      })
      onDone()
    } catch {
      // se muestra desde save.error
    }
  }

  return (
    <div className="space-y-3 bg-slate-50 px-3 py-3">
      {!walkover && (
        <div className="space-y-2">
          {[
            { label: 'Set 1', v: s1, set: setS1 },
            { label: 'Set 2', v: s2, set: setS2 },
            { label: 'Set 3', v: s3, set: setS3 },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-2">
              <span className="w-12 text-xs text-slate-500">{row.label}</span>
              <ScoreInput
                value={row.v.a}
                onChange={(a) => row.set((p) => ({ ...p, a }))}
                label={`${teamA?.name ?? 'A'} ${row.label}`}
              />
              <span className="text-slate-500">–</span>
              <ScoreInput
                value={row.v.b}
                onChange={(b) => row.set((p) => ({ ...p, b }))}
                label={`${teamB?.name ?? 'B'} ${row.label}`}
              />
            </div>
          ))}
          <p className="text-[11px] text-slate-500">
            {teamA?.name} (izquierda) – {teamB?.name} (derecha). Deja el Set 3 vacío si se ganó en 2.
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={walkover} onChange={(e) => setWalkover(e.target.checked)} />
        Walkover (un equipo no se presentó)
      </label>

      {walkover && (
        <select
          value={walkoverTeamId}
          onChange={(e) => setWalkoverTeamId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">— ¿Quién no se presentó? —</option>
          {teamA && <option value={teamA.id}>{teamA.name}</option>}
          {teamB && <option value={teamB.id}>{teamB.name}</option>}
        </select>
      )}

      {!walkover && derived.error && (
        <p className="text-xs text-rose-600">{derived.error}</p>
      )}
      {winnerName && (
        <p className="text-sm text-emerald-700">
          Ganador: <span className="font-semibold">{winnerName}</span>
          {walkover ? ' (6-0, 6-0)' : ''}
        </p>
      )}
      {save.isError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {(save.error as Error).message}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={onDone}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave || save.isPending}
          className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {save.isPending ? 'Guardando…' : 'Guardar y validar'}
        </button>
      </div>
    </div>
  )
}

function ScoreInput({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-14 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-sm tabular-nums"
    />
  )
}
