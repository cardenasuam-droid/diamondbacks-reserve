import { useState } from 'react'
import { teamColor } from '@/lib/color'
import { initialsOf } from './Avatar'

// Escudo de equipo: su logo, o un monograma (iniciales sobre el color del equipo)
// si no hay logo o no carga. Cuadrado de esquinas redondeadas a propósito —
// distingue al EQUIPO (escudo cuadrado) del JUGADOR (Avatar circular). El logo va
// sobre una placa blanca con `object-contain` para que cualquier logo subido por
// el organizador (transparente, oscuro o de color) se lea sobre el tema ónix.
// El nombre del equipo siempre acompaña al escudo, así que la imagen es decorativa.
export function TeamCrest({
  name,
  logoUrl,
  color,
  size = 32,
  className = '',
}: {
  name: string
  logoUrl?: string | null
  color?: string | null
  size?: number
  className?: string
}) {
  const [ok, setOk] = useState(true)
  const radius = Math.max(6, Math.round(size * 0.28))
  const box = { width: size, height: size, borderRadius: radius }

  if (logoUrl && ok) {
    return (
      <img
        src={logoUrl}
        alt=""
        loading="lazy"
        style={box}
        onError={() => setOk(false)}
        className={'shrink-0 bg-white object-contain p-0.5 ring-1 ring-black/10 ' + className}
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{ ...box, backgroundColor: teamColor(color, '#475569'), fontSize: size * 0.42 }}
      className={
        'inline-flex shrink-0 items-center justify-center font-bold uppercase leading-none text-white ring-1 ring-black/10 ' +
        className
      }
    >
      {initialsOf(name)}
    </span>
  )
}
