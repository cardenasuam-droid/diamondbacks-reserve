import { TeamCrest } from '@/components/ui/TeamCrest'
import type { Team } from '@/lib/types'

// Selector de equipo en chips (con el color de cada equipo). Tap = elige.
// includePool añade una opción "← Pool (sin equipo)" que devuelve null.
// excludeTeamId oculta el equipo actual (al mover de equipo). Compartido entre
// el pool (asignar) y el roster (mover/regresar al pool).
export function TeamPicker({
  teams,
  excludeTeamId,
  includePool = false,
  pending = false,
  onPick,
}: {
  teams: Team[]
  excludeTeamId?: string | null
  includePool?: boolean
  pending?: boolean
  onPick: (teamId: string | null) => void
}) {
  const list = excludeTeamId ? teams.filter((t) => t.id !== excludeTeamId) : teams

  return (
    <div className="flex flex-wrap gap-2">
      {list.map((t) => (
        <button
          key={t.id}
          onClick={() => onPick(t.id)}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-slate-100 py-1.5 pl-1.5 pr-3 text-sm font-medium text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-400 disabled:opacity-50"
        >
          <TeamCrest name={t.name} logoUrl={t.logo_url} color={t.color} size={22} />
          {t.name}
        </button>
      ))}
      {includePool && (
        <button
          onClick={() => onPick(null)}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:ring-amber-400 disabled:opacity-50"
        >
          ← Pool (sin equipo)
        </button>
      )}
    </div>
  )
}
