import { useState } from 'react'
import { teamColor } from '@/lib/color'
import { imageThumb } from '@/lib/image'
import { initialsOf } from './Avatar'

// Hex (#RGB o #RRGGBB) + alfa de 2 dígitos → #RRGGBBAA. Normaliza el corto a largo.
function withAlpha(hex: string, alpha: string): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return `#${h}${alpha}`
}

// Escudo de equipo: su logo, o un monograma (iniciales sobre el color del equipo)
// si no hay logo o no carga. Cuadrado de esquinas redondeadas a propósito —
// distingue al EQUIPO (escudo cuadrado) del JUGADOR (Avatar circular). El logo va
// sobre una placa blanca con `object-contain` para que cualquier logo subido por
// el organizador (transparente, oscuro o de color) se lea sobre el tema ónix.
// `glow` añade un halo del color del equipo para usos hero (escudo grande). El
// nombre del equipo siempre acompaña al escudo, así que la imagen es decorativa.
export function TeamCrest({
  name,
  logoUrl,
  color,
  size = 32,
  glow = false,
  className = '',
}: {
  name: string
  logoUrl?: string | null
  color?: string | null
  size?: number
  glow?: boolean
  className?: string
}) {
  const [ok, setOk] = useState(true)
  const radius = Math.max(6, Math.round(size * 0.28))
  const c = teamColor(color, '#475569')
  // El glow reemplaza el ring de Tailwind (ambos son box-shadow) por un halo +
  // filo del color del equipo. Sin glow, el ring-black/10 de la clase manda.
  const glowShadow = glow
    ? `0 12px 34px -10px ${withAlpha(c, 'b3')}, 0 0 0 1px ${withAlpha(c, '66')}`
    : undefined
  const box = { width: size, height: size, borderRadius: radius, boxShadow: glowShadow }

  if (logoUrl && ok) {
    // Logo redimensionado por el servidor (contain = sin recorte). Menos egress.
    const src = imageThumb(logoUrl, { width: Math.round(size * 2), quality: 75, resize: 'contain' }) ?? logoUrl
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        style={box}
        onError={() => setOk(false)}
        className={'shrink-0 bg-white object-contain p-0.5 ring-1 ring-black/10 ' + className}
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{ ...box, backgroundColor: c, fontSize: size * 0.42 }}
      className={
        'inline-flex shrink-0 items-center justify-center font-bold uppercase leading-none text-white ring-1 ring-black/10 ' +
        className
      }
    >
      {initialsOf(name)}
    </span>
  )
}
