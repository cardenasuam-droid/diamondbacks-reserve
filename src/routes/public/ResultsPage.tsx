import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useRounds } from '@/features/schedule/useRounds'
import { useRoundMatches } from '@/features/schedule/useRoundMatches'
import { pickDefaultRound } from '@/features/schedule/defaultRound'
import { todayISO } from '@/lib/date'
import { groupByMatchup } from '@/features/schedule/groupByMatchup'
import { RoundSelector } from '@/features/schedule/RoundSelector'
import { MatchupHeader } from '@/features/schedule/MatchupHeader'
import { categoryColor } from '@/features/categories/categoryColor'
import { scoreLine, hasOfficialResult } from '@/features/schedule/score'
import { readableOnDark } from '@/lib/color'
import { formatRoundDate } from '@/lib/date'
import type { ScheduledMatch, TeamLite } from '@/features/schedule/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'

// Color del marcador = color del equipo GANADOR, aclarado hasta que se lea sobre
// la superficie oscura (readableOnDark). Con el color crudo, cuatro de los seis
// equipos tenían marcadores ilegibles (azules/verdes oscuros sobre fondo verde).
function winnerColor(m: ScheduledMatch, teamA: TeamLite | null, teamB: TeamLite | null): string {
  const w = m.result?.winner_team_id
  if (w && teamA && w === teamA.id) return readableOnDark(teamA.color)
  if (w && teamB && w === teamB.id) return readableOnDark(teamB.color)
  return '#cbd5c4' // sin ganador claro: gris verdoso claro, legible
}

export function ResultsPage() {
  const season = useActiveSeason()
  const rounds = useRounds(season.data?.id)
  const [roundId, setRoundId] = useState<string>()

  // Por defecto, la última jornada YA jugada (donde caen los marcadores que se
  // están revisando), no la última de la temporada.
  useEffect(() => {
    if (!roundId && rounds.data && rounds.data.length > 0) {
      setRoundId(pickDefaultRound(rounds.data, todayISO(), 'recent'))
    }
  }, [rounds.data, roundId])

  const matches = useRoundMatches(roundId)

  if (season.isLoading) return <Loader label="Cargando temporada…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Resultados" />
        <EmptyState icon="results" title="Aún no hay resultados" description="Los marcadores aparecerán conforme se validen." />
      </div>
    )
  }

  const selectedRound = rounds.data?.find((r) => r.id === roundId)
  const groups = groupByMatchup(matches.data ?? [])

  return (
    <div>
      <PageHeader title="Resultados" subtitle={season.data.name} />

      {rounds.isLoading ? (
        <Loader label="Cargando jornadas…" />
      ) : !rounds.data || rounds.data.length === 0 ? (
        <EmptyState icon="results" title="Sin jornadas publicadas" />
      ) : (
        <>
          <RoundSelector rounds={rounds.data} selectedId={roundId} onSelect={setRoundId} />
          {selectedRound?.round_date && (
            <p className="mb-3 text-sm text-slate-500">{formatRoundDate(selectedRound.round_date)}</p>
          )}

          {matches.isLoading ? (
            <Loader label="Cargando resultados…" />
          ) : matches.isError ? (
            <ErrorState onRetry={() => matches.refetch()} />
          ) : groups.length === 0 ? (
            <EmptyState icon="results" title="Esta jornada no tiene partidos" />
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.matchupId} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
                  <MatchupHeader teamA={g.teamA} teamB={g.teamB} />
                  <ul className="divide-y divide-slate-100">
                    {g.matches.map((m) => {
                      const official = hasOfficialResult(m.result)
                      return (
                        <li key={m.id}>
                          {/* Toda la fila enlaza al detalle del partido (jugadores,
                              desglose por equipo y puntos), igual que en el rol. */}
                          <Link
                            to={`/partidos/${m.id}`}
                            className="flex min-h-[44px] items-center justify-between gap-2 px-3 py-2 transition hover:bg-slate-50"
                          >
                            <span className="flex items-center gap-2">
                              <Badge color={categoryColor(m.category?.type)}>{m.category_code}</Badge>
                              <span className="text-sm text-slate-700">{m.category?.name}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5">
                              {official ? (
                                <span
                                  className="font-semibold tabular-nums"
                                  style={{ color: winnerColor(m, g.teamA, g.teamB) }}
                                >
                                  {scoreLine(m.result!)}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500">Pendiente</span>
                              )}
                              <Icon name="chevron-right" size={14} className="text-slate-400" />
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
