import { useEffect, useState } from 'react'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useRounds } from '@/features/schedule/useRounds'
import { useRoundMatches } from '@/features/schedule/useRoundMatches'
import { groupByMatchup } from '@/features/schedule/groupByMatchup'
import { RoundSelector } from '@/features/schedule/RoundSelector'
import { MatchupHeader } from '@/features/schedule/MatchupHeader'
import { categoryColor } from '@/features/categories/categoryColor'
import { formatRoundDate } from '@/lib/date'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'

export function SchedulePage() {
  const season = useActiveSeason()
  const rounds = useRounds(season.data?.id)
  const [roundId, setRoundId] = useState<string>()

  // Por defecto, la última jornada disponible.
  useEffect(() => {
    if (!roundId && rounds.data && rounds.data.length > 0) {
      setRoundId(rounds.data[rounds.data.length - 1].id)
    }
  }, [rounds.data, roundId])

  const matches = useRoundMatches(roundId)

  if (season.isLoading) return <Loader label="Cargando temporada…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Rol de juegos" />
        <EmptyState icon="schedule" title="Aún no hay rol" description="El calendario aparecerá cuando el organizador publique las jornadas." />
      </div>
    )
  }

  const selectedRound = rounds.data?.find((r) => r.id === roundId)
  const groups = groupByMatchup(matches.data ?? [])

  return (
    <div>
      <PageHeader title="Rol de juegos" subtitle={season.data.name} />

      {rounds.isLoading ? (
        <Loader label="Cargando jornadas…" />
      ) : !rounds.data || rounds.data.length === 0 ? (
        <EmptyState icon="schedule" title="Sin jornadas publicadas" />
      ) : (
        <>
          <RoundSelector rounds={rounds.data} selectedId={roundId} onSelect={setRoundId} />
          {selectedRound?.round_date && (
            <p className="mb-3 text-sm text-slate-500">{formatRoundDate(selectedRound.round_date)}</p>
          )}

          {matches.isLoading ? (
            <Loader label="Cargando partidos…" />
          ) : matches.isError ? (
            <ErrorState onRetry={() => matches.refetch()} />
          ) : groups.length === 0 ? (
            <EmptyState icon="schedule" title="Esta jornada no tiene partidos" />
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.matchupId} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
                  <MatchupHeader teamA={g.teamA} teamB={g.teamB} />
                  <ul className="divide-y divide-slate-100">
                    {g.matches.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="flex items-center gap-2">
                          <Badge color={categoryColor(m.category?.type)}>{m.category_code}</Badge>
                          <span className="text-sm text-slate-700">{m.category?.name}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-slate-500">
                          {m.time_block?.label} · {m.court?.name}
                        </span>
                      </li>
                    ))}
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
