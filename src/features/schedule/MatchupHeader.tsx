import { teamColor } from '@/lib/color'
import type { TeamLite } from './types'

function TeamTag({ team, align }: { team: TeamLite | null; align: 'left' | 'right' }) {
  return (
    <div className={'flex flex-1 items-center gap-2 ' + (align === 'right' ? 'flex-row-reverse text-right' : '')}>
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5"
        style={{ backgroundColor: teamColor(team?.color) }}
        aria-hidden
      />
      <span className="truncate font-semibold text-slate-800">{team?.name ?? '—'}</span>
    </div>
  )
}

// Encabezado "Equipo A vs Equipo B" con puntos de color.
export function MatchupHeader({ teamA, teamB }: { teamA: TeamLite | null; teamB: TeamLite | null }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
      <TeamTag team={teamA} align="left" />
      <span className="shrink-0 text-xs font-medium text-slate-500">vs</span>
      <TeamTag team={teamB} align="right" />
    </div>
  )
}
