import { teamColor } from '@/lib/color'

// Iniciales de un nombre: hasta 2 letras (primera de las dos primeras palabras).
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}

// Foto del jugador, o sus iniciales sobre el color del equipo si no hay foto.
export function Avatar({
  name,
  photoUrl,
  color,
  size = 40,
  className = '',
}: {
  name: string
  photoUrl?: string | null
  color?: string | null
  size?: number
  className?: string
}) {
  const dimension = { width: size, height: size }

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={dimension}
        className={'shrink-0 rounded-full object-cover ring-1 ring-black/10 ' + className}
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{ ...dimension, backgroundColor: teamColor(color, '#475569'), fontSize: size * 0.4 }}
      className={
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-1 ring-black/10 ' +
        className
      }
    >
      {initialsOf(name)}
    </span>
  )
}
