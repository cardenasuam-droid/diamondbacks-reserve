import type { PlayerPosition } from '@/lib/types'

export const POSITION_LABEL: Record<PlayerPosition, string> = {
  drive: 'Drive',
  reves: 'Revés',
  ambas: 'Ambas',
}

// Lado de juego del jugador. Dato deportivo público (players_public, 0026):
// lo ven público, capitanas y organizador. Si el jugador no lo declaró, no pinta nada.
export function PositionChip({ position }: { position: PlayerPosition | null | undefined }) {
  if (!position) return null
  return (
    <span
      title={`Juega ${POSITION_LABEL[position].toLowerCase()}`}
      className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700"
    >
      {POSITION_LABEL[position]}
    </span>
  )
}
