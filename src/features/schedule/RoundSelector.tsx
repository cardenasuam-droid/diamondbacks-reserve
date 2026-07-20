import { useEffect, useRef } from 'react'
import type { Round } from './types'

interface RoundSelectorProps {
  rounds: Round[]
  selectedId: string | undefined
  onSelect: (id: string) => void
}

// Selector horizontal de jornadas (J1, J2, …). Scrollable en móvil. Desplaza el
// chip activo a la vista: con 10 jornadas y viewport de 375px, el seleccionado
// puede nacer fuera de pantalla y parecer que no hay selección.
export function RoundSelector({ rounds, selectedId, onSelect }: RoundSelectorProps) {
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [selectedId])

  return (
    <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {rounds.map((r) => {
        const active = r.id === selectedId
        return (
          <button
            key={r.id}
            ref={active ? activeRef : undefined}
            onClick={() => onSelect(r.id)}
            aria-pressed={active}
            className={
              'flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ' +
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
