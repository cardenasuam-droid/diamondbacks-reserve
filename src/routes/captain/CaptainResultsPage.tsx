import { useMemo, useState } from 'react'
import { useCaptainTeam } from '@/features/lineups/useCaptainTeam'
import { useRounds } from '@/features/schedule/useRounds'
import { RoundSelector } from '@/features/schedule/RoundSelector'
import { hasOfficialResult, scoreLine } from '@/features/schedule/score'
import { validPadelSet } from '@/features/results/resultLogic'
import {
  useCaptainRoundMatchup,
  useReportResult,
  type CaptainMatchupMatch,
  type CaptainRoundMatchup,
} from '@/features/results/captainReport'
import { categoryColor } from '@/features/categories/categoryColor'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { TeamCrest } from '@/components/ui/TeamCrest'

// Captura de resultados por la CAPITANA (migración 0043). Ella reporta el
// marcador de los partidos de SU enfrentamiento; el resultado queda "Por
// validar" y no mueve tabla ni rating hasta que el organizador lo valida desde
// su panel. Mientras tanto es corregible (por ella o por la capitana rival).
export function CaptainResultsPage() {
  const team = useCaptainTeam()
  const rounds = useRounds(team.data?.season_id)
  const [roundId, setRoundId] = useState<string | null>(null)

  // Por defecto, la jornada MÁS RECIENTE ya jugada (hoy incluido): reportar
  // resultados mira al pasado, no a la próxima jornada como las alineaciones.
  const defaultRound = useMemo(() => {
    const list = rounds.data ?? []
    if (list.length === 0) return undefined
    const today = new Date().toISOString().slice(0, 10)
    const played = list.filter((r) => r.round_date && r.round_date <= today)
    return (played.length > 0 ? played[played.length - 1] : list[0]).id
  }, [rounds.data])

  const selected = roundId ?? defaultRound
  const matchup = useCaptainRoundMatchup(team.data?.id, selected)

  if (team.isLoading || rounds.isLoading) return <Loader label="Cargando…" />

  if (!team.data) {
    return (
      <div>
        <PageHeader title="Capturar resultados" />
        <EmptyState
          icon="results-edit"
          title="Pantalla de capitanas"
          description="Solo la capitana o co-capitana de un equipo puede reportar resultados. El organizador captura desde su propio panel."
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Capturar resultados"
        subtitle={`${team.data.name} · el organizador valida cada marcador reportado`}
      />

      {rounds.data && rounds.data.length > 0 && (
        <RoundSelector rounds={rounds.data} selectedId={selected} onSelect={setRoundId} />
      )}

      {matchup.isLoading ? (
        <Loader label="Cargando enfrentamiento…" />
      ) : matchup.isError ? (
        <ErrorState onRetry={() => matchup.refetch()} />
      ) : !matchup.data ? (
        <EmptyState icon="schedule" title="Tu equipo no juega en esta jornada" />
      ) : (
        <MatchupResults matchup={matchup.data} roundId={selected as string} teamId={team.data.id} />
      )}
    </div>
  )
}

function MatchupResults({
  matchup,
  roundId,
  teamId,
}: {
  matchup: CaptainRoundMatchup
  roundId: string
  teamId: string
}) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <span className="inline-flex items-center gap-1.5">
          <TeamCrest name={matchup.teamA.name} logoUrl={matchup.teamA.logo_url} color={matchup.teamA.color} size={22} />
          <span className="font-semibold text-slate-800">{matchup.teamA.name}</span>
        </span>
        <span className="text-xs text-slate-500">vs</span>
        <span className="inline-flex items-center gap-1.5">
          <TeamCrest name={matchup.teamB.name} logoUrl={matchup.teamB.logo_url} color={matchup.teamB.color} size={22} />
          <span className="font-semibold text-slate-800">{matchup.teamB.name}</span>
        </span>
      </div>

      <ul>
        {matchup.matches.map((m) => {
          const r = m.result
          const oficial = hasOfficialResult(r)
          // Se define sin negar el guard de arriba: la rama negativa de un
          // type-guard estrecha r a null y el acceso a status no compilaría.
          // Un 'reported' sin walkover nunca es oficial, así que no se solapan.
          const reportado = r != null && r.status === 'reported' && !r.is_walkover
          return (
            <li key={m.id} className="border-b border-slate-100 last:border-0">
              <button
                onClick={() => setOpen(open === m.id ? null : m.id)}
                disabled={oficial}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <Badge color={categoryColor(m.category?.type)}>{m.category_code}</Badge>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                  {[m.time_block?.label, m.court?.name].filter(Boolean).join(' · ')}
                </span>
                {oficial && r ? (
                  <>
                    <span className="text-sm font-medium tabular-nums text-slate-900">{scoreLine(r)}</span>
                    <Badge color="emerald">Oficial</Badge>
                  </>
                ) : reportado && r ? (
                  <>
                    <span className="text-sm font-medium tabular-nums text-slate-900">{scoreLine(r)}</span>
                    <Badge color="amber">Por validar</Badge>
                  </>
                ) : (
                  <span className="text-sm text-slate-500">Sin resultado</span>
                )}
                {!oficial && (
                  <span className="text-slate-300" aria-hidden>
                    {open === m.id ? '▾' : '›'}
                  </span>
                )}
              </button>

              {open === m.id && !oficial && (
                <ReportEditor
                  match={m}
                  matchup={matchup}
                  roundId={roundId}
                  teamId={teamId}
                  onDone={() => setOpen(null)}
                />
              )}
            </li>
          )
        })}
      </ul>

      <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
        Un marcador reportado no mueve la tabla ni el rating hasta que el organizador lo valida.
        Puedes corregirlo mientras diga “Por validar”. Si hubo walkover o retiro, avisa al
        organizador: eso se captura desde su panel.
      </p>
    </section>
  )
}

function num(s: string): number | null {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function ReportEditor({
  match,
  matchup,
  roundId,
  teamId,
  onDone,
}: {
  match: CaptainMatchupMatch
  matchup: CaptainRoundMatchup
  roundId: string
  teamId: string
  onDone: () => void
}) {
  const report = useReportResult()
  const r = match.result

  const init = (a: number | null | undefined, b: number | null | undefined) => ({
    a: a == null ? '' : String(a),
    b: b == null ? '' : String(b),
  })
  const [s1, setS1] = useState(init(r?.set1_team_a, r?.set1_team_b))
  const [s2, setS2] = useState(init(r?.set2_team_a, r?.set2_team_b))
  const [s3, setS3] = useState(init(r?.set3_team_a, r?.set3_team_b))

  // Validación espejo de la RPC (0043): feedback instantáneo; el servidor manda.
  const v1 = [num(s1.a), num(s1.b)] as const
  const v2 = [num(s2.a), num(s2.b)] as const
  const v3 = [num(s3.a), num(s3.b)] as const

  let problema: string | null = null
  if (v1[0] == null || v1[1] == null || v2[0] == null || v2[1] == null) {
    problema = 'Captura completos los sets 1 y 2.'
  } else if (!validPadelSet(v1[0], v1[1]) || !validPadelSet(v2[0], v2[1])) {
    problema = 'Marcador no válido (sets: 6-0 a 6-4, 7-5 o 7-6).'
  } else if ((v3[0] == null) !== (v3[1] == null)) {
    problema = 'El tercer set está incompleto.'
  } else if (v3[0] != null && v3[1] != null && !validPadelSet(v3[0], v3[1])) {
    problema = 'Marcador no válido en el tercer set.'
  } else if (v1[0] > v1[1] === v2[0] > v2[1] && v3[0] != null) {
    problema = 'El partido se decidió en dos sets: no captures el tercero.'
  } else if (v1[0] > v1[1] !== v2[0] > v2[1] && v3[0] == null) {
    problema = 'Empate 1-1 en sets: falta el tercer set.'
  }

  const listo = problema === null
  const tocado = s1.a !== '' || s1.b !== '' || s2.a !== '' || s2.b !== ''

  async function handleSave() {
    try {
      await report.mutateAsync({
        matchId: match.id,
        s1a: v1[0] as number,
        s1b: v1[1] as number,
        s2a: v2[0] as number,
        s2b: v2[1] as number,
        s3a: v3[0],
        s3b: v3[1],
        teamId,
        roundId,
      })
      onDone()
    } catch {
      // el error se muestra desde report.error
    }
  }

  const setRow = (
    etiqueta: string,
    valor: { a: string; b: string },
    poner: (v: { a: string; b: string }) => void,
    opcional = false,
  ) => (
    <div className="flex items-center gap-2">
      <span className="w-14 text-xs text-slate-500">
        {etiqueta}
        {opcional && <span className="text-slate-400"> (si hubo)</span>}
      </span>
      <input
        value={valor.a}
        onChange={(e) => poner({ ...valor, a: e.target.value })}
        inputMode="numeric"
        className="w-14 rounded-lg px-2 py-1.5 text-center text-sm tabular-nums"
        aria-label={`${etiqueta} ${matchup.teamA.name}`}
      />
      <span className="text-xs text-slate-400">–</span>
      <input
        value={valor.b}
        onChange={(e) => poner({ ...valor, b: e.target.value })}
        inputMode="numeric"
        className="w-14 rounded-lg px-2 py-1.5 text-center text-sm tabular-nums"
        aria-label={`${etiqueta} ${matchup.teamB.name}`}
      />
    </div>
  )

  return (
    <div className="space-y-3 bg-slate-50 px-3 py-3">
      {/* Orientación explícita: la izquierda SIEMPRE es el equipo A del
          enfrentamiento (como en el rol público), no "mi equipo". Se resalta
          cuál es el suyo para que nadie invierta el marcador. */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className={matchup.myTeamIsA ? 'font-bold text-slate-800' : ''}>
          {matchup.teamA.name}
          {matchup.myTeamIsA && ' (tu equipo)'}
        </span>
        <span>·</span>
        <span className={!matchup.myTeamIsA ? 'font-bold text-slate-800' : ''}>
          {matchup.teamB.name}
          {!matchup.myTeamIsA && ' (tu equipo)'}
        </span>
      </div>

      {setRow('Set 1', s1, setS1)}
      {setRow('Set 2', s2, setS2)}
      {setRow('Set 3', s3, setS3, true)}

      {tocado && problema && <p className="text-xs text-amber-300">{problema}</p>}
      {report.isError && (
        <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
          {(report.error as Error).message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!listo || report.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {report.isPending ? 'Reportando…' : 'Reportar marcador'}
        </button>
        <button onClick={onDone} className="px-2 text-xs text-slate-500 hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  )
}
