import { useState } from 'react'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useRounds } from '@/features/schedule/useRounds'
import { RoundSelector } from '@/features/schedule/RoundSelector'
import { useRoundLineups } from '@/features/lineups/useRoundLineups'
import { lineupStatusLabel } from '@/features/lineups/lineupHelpers'
import { teamColor } from '@/lib/color'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import type { TeamLite } from '@/features/schedule/types'
import type { RoundLineupStatus } from '@/features/lineups/useRoundLineups'

export function OrganizerLineupsPage() {
  const season = useActiveSeason()
  const rounds = useRounds(season.data?.id)
  const [roundId, setRoundId] = useState<string | undefined>()
  const selected = roundId ?? rounds.data?.[0]?.id
  const lineups = useRoundLineups(selected)

  if (season.isLoading || rounds.isLoading) return <Loader label="Cargando…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Estado de alineaciones" />
        <EmptyState icon="✅" title="No hay temporada activa" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Estado de alineaciones" subtitle={season.data.name} />

      {rounds.data && rounds.data.length > 0 ? (
        <RoundSelector rounds={rounds.data} selectedId={selected} onSelect={setRoundId} />
      ) : (
        <EmptyState icon="📅" title="No hay jornadas" />
      )}

      {lineups.isLoading ? (
        <Loader label="Cargando alineaciones…" />
      ) : lineups.isError ? (
        <ErrorState onRetry={() => lineups.refetch()} />
      ) : !lineups.data || lineups.data.length === 0 ? (
        <EmptyState icon="✅" title="Sin enfrentamientos en esta jornada" />
      ) : (
        <div className="space-y-2">
          {lineups.data.map((mu) => (
            <div
              key={mu.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <TeamRow team={mu.team_a} lineups={mu.lineups} />
              <div className="border-t border-slate-100" />
              <TeamRow team={mu.team_b} lineups={mu.lineups} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TeamRow({ team, lineups }: { team: TeamLite | null; lineups: RoundLineupStatus[] }) {
  const lineup = lineups.find((l) => l.team_id === team?.id)
  const status = lineup?.status
  const done = Boolean(status && status !== 'draft')

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5"
        style={{ backgroundColor: teamColor(team?.color) }}
        aria-hidden
      />
      <span className="flex-1 truncate font-medium text-slate-800">{team?.name ?? '—'}</span>
      <Badge color={done ? 'emerald' : status === 'draft' ? 'amber' : 'slate'}>
        {lineupStatusLabel(status)}
      </Badge>
    </div>
  )
}
