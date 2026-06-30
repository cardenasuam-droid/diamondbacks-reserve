import { Link } from 'react-router-dom'
import { TeamCrest } from '@/components/ui/TeamCrest'
import type { TeamLite } from './types'

function TeamTag({ team, align }: { team: TeamLite | null; align: 'left' | 'right' }) {
  const layout = 'flex flex-1 items-center gap-2 ' + (align === 'right' ? 'flex-row-reverse text-right' : '')
  if (!team) {
    return (
      <div className={layout}>
        <span className="h-6 w-6 shrink-0 rounded-md bg-slate-200 ring-1 ring-black/10" aria-hidden />
        <span className="truncate font-semibold text-slate-800">—</span>
      </div>
    )
  }
  return (
    <Link to={`/equipos/${team.id}`} className={layout + ' transition hover:opacity-70'}>
      <TeamCrest name={team.name} logoUrl={team.logo_url} color={team.color} size={24} />
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
