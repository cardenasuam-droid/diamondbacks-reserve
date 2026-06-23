import { Link } from 'react-router-dom'
import { teamColor } from '@/lib/color'
import type { TeamLite } from './types'

function TeamTag({ team, align }: { team: TeamLite | null; align: 'left' | 'right' }) {
  const layout = 'flex flex-1 items-center gap-2 ' + (align === 'right' ? 'flex-row-reverse text-right' : '')
  const dot = (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5"
      style={{ backgroundColor: teamColor(team?.color) }}
      aria-hidden
    />
  )
  if (!team) {
    return (
      <div className={layout}>
        {dot}
        <span className="truncate font-semibold text-slate-800">—</span>
      </div>
    )
  }
  return (
    <Link to={`/equipos/${team.id}`} className={layout + ' transition hover:opacity-70'}>
      {dot}
      <span className="truncate font-semibold text-slate-800 underline decoration-transparent hover:decoration-inherit">
        {team.name}
      </span>
    </Link>
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
