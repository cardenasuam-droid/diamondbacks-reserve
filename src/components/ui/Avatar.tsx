import { teamColor } from '@/lib/color'
import { imageThumb } from '@/lib/image'

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
    // Miniatura redimensionada por el servidor (Pro) a ~2× para pantallas retina:
    // ~10 KB en vez de la foto full-res. Corta el cached egress drásticamente.
    const src = imageThumb(photoUrl, { width: Math.round(size * 2), quality: 65, resize: 'cover' }) ?? photoUrl
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
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
