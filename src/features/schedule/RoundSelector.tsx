import type { Round } from './types'

interface RoundSelectorProps {
  rounds: Round[]
  selectedId: string | undefined
  onSelect: (id: string) => void
}

// Selector horizontal de jornadas (J1, J2, …). Scrollable en móvil.
export function RoundSelector({ rounds, selectedId, onSelect }: RoundSelectorProps) {
  return (
    <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {rounds.map((r) => {
        const active = r.id === selectedId
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={
              'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ' +
              (active
                ? 'bg-brand-600 text-white'
                : 'border border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-100')
            }
          >
            J{r.round_number}
          </button>
        )
      })}
    </div>
  )
}
