import { useState } from 'react'
import { useAuth } from '@/features/auth/context'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useRounds } from '@/features/schedule/useRounds'
import { RoundSelector } from '@/features/schedule/RoundSelector'
import { useRoundMatches } from '@/features/schedule/useRoundMatches'
import { groupByMatchup } from '@/features/schedule/groupByMatchup'
import { scoreLine, hasOfficialResult } from '@/features/schedule/score'
import { categoryColor } from '@/features/categories/categoryColor'
import { TeamCrest } from '@/components/ui/TeamCrest'
import { deriveResult, type SetInput } from '@/features/results/resultLogic'
import { useSaveResult, useDeleteResult } from '@/features/results/useSaveResult'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
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
  // Se extrae aquí porque dentro del .map() TypeScript pierde el estrechamiento
  // del early return de arriba.
  const seasonId = season.data.id

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
              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-100 bg-slate-50 px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <TeamCrest name={g.teamA?.name ?? '—'} logoUrl={g.teamA?.logo_url} color={g.teamA?.color} size={22} />
                  <span className="font-semibold text-slate-800">{g.teamA?.name ?? '—'}</span>
                </span>
                <span className="text-xs text-slate-500">vs</span>
                <span className="inline-flex items-center gap-1.5">
                  <TeamCrest name={g.teamB?.name ?? '—'} logoUrl={g.teamB?.logo_url} color={g.teamB?.color} size={22} />
                  <span className="font-semibold text-slate-800">{g.teamB?.name ?? '—'}</span>
                </span>
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
                      {/* Reportado por capitana (0043): el marcador se muestra con
                          la marca "Por validar" — abrir el editor lo pre-llena y
                          Guardar lo convierte en oficial. Se evalúa ANTES que el
                          guard de oficial: la rama negativa de un type-guard
                          estrecha m.result a null y rompería el acceso a status. */}
                      {m.result && m.result.status === 'reported' && !m.result.is_walkover ? (
                        <>
                          <span className="text-sm font-medium tabular-nums text-slate-900">
                            {scoreLine(m.result)}
                          </span>
                          <Badge color="amber">Por validar</Badge>
                        </>
                      ) : hasOfficialResult(m.result) ? (
                        <span className="text-sm font-medium tabular-nums text-slate-900">
                          {scoreLine(m.result)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500">Sin resultado</span>
                      )}
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
                        seasonId={seasonId}
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
  seasonId,
  onDone,
}: {
  match: ScheduledMatch
  teamA: TeamLite | null
  teamB: TeamLite | null
  roundId: string
  /** Necesaria para recalcular el rating al guardar (0039/0040). */
  seasonId: string
  onDone: () => void
}) {
  const { profile } = useAuth()
  const save = useSaveResult()
  const del = useDeleteResult()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const r = match.result
  // Un reporte de capitana (0043) aún no cuenta para tabla ni rating: borrarlo es
  // "descartar", no "corregir un oficial". El walkover se guarda como oficial.
  const esReporte = r?.status === 'reported' && !r.is_walkover

  const init = (a: number | null | undefined, b: number | null | undefined) => ({
    a: a == null ? '' : String(a),
    b: b == null ? '' : String(b),
  })
  const [s1, setS1] = useState(init(r?.set1_team_a, r?.set1_team_b))
  const [s2, setS2] = useState(init(r?.set2_team_a, r?.set2_team_b))
  const [s3, setS3] = useState(init(r?.set3_team_a, r?.set3_team_b))
  const [walkover, setWalkover] = useState(Boolean(r?.is_walkover))
  // Se pre-llena con el equipo ausente ya guardado: sin esto, reabrir un walkover
  // obligaba a re-elegirlo de memoria y a ciegas (la fila solo muestra "W.O."), y
  // errar invierte 3 puntos, sets, juegos y el rating sin ningún aviso.
  const [walkoverTeamId, setWalkoverTeamId] = useState<string>(r?.walkover_team_id ?? '')

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
        seasonId,
      })
      onDone()
    } catch {
      // se muestra desde save.error
    }
  }

  async function handleDelete() {
    try {
      await del.mutateAsync({ matchId: match.id, roundId, seasonId })
      onDone()
    } catch {
      // se muestra desde del.error
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
          className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
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
        <p className="text-sm text-emerald-300">
          Ganador: <span className="font-semibold">{winnerName}</span>
          {walkover ? ' (6-0, 6-0)' : ''}
        </p>
      )}
      {save.isError && (
        <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
          {(save.error as Error).message}
        </p>
      )}
      {del.isError && (
        <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
          {(del.error as Error).message}
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
          disabled={!canSave || save.isPending || del.isPending}
          className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {save.isPending ? 'Guardando…' : 'Guardar y validar'}
        </button>
      </div>

      {/* Borrar: solo si YA hay algo guardado. El texto cambia según el estado
          porque son dos acciones distintas para el organizador:
            · reportado por capitana → DESCARTAR el reporte (no contaba aún).
            · validado/walkover      → BORRAR un resultado oficial (sí contaba;
              la tabla y el rating se recalculan).
          Confirmación inline (no window.confirm, patrón del repo). */}
      {r && (
        <div className="border-t border-slate-200 pt-3">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 text-xs text-slate-600">
                {esReporte
                  ? 'Se descarta el reporte de la capitana y el partido vuelve a “Sin resultado”. Podrá volver a capturarse. ¿Seguro?'
                  : 'Se borra el marcador oficial y el partido vuelve a “Sin resultado”. La tabla y el rating se recalculan. ¿Seguro?'}
              </span>
              <button
                onClick={handleDelete}
                disabled={del.isPending}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {del.isPending ? 'Borrando…' : esReporte ? 'Sí, descartar' : 'Sí, borrar'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 text-xs text-slate-500 hover:underline"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              <Icon name="ban" size={16} />
              {esReporte ? 'Descartar reporte' : 'Borrar resultado'}
            </button>
          )}
        </div>
      )}
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
      className="w-14 rounded-lg border border-slate-300 bg-slate-100 px-2 py-1.5 text-center text-sm tabular-nums"
    />
  )
}
