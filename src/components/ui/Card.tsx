import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Tarjeta base de la app: fondo con un degradado sutil (blanco→stone), borde fino,
// esquinas suaves y sombra premium. `interactive`/`to` añaden el realce al pasar
// el cursor (subir + sombra). Mantiene un único lenguaje visual en todas las pantallas.
const BASE =
  'rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-stone-50 shadow-sm'
const INTERACTIVE =
  'transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md'

export function Card({
  children,
  className = '',
  interactive = false,
  to,
  style,
}: {
  children: ReactNode
  className?: string
  interactive?: boolean
  to?: string
  style?: CSSProperties
}) {
  const cls = `${BASE} ${interactive || to ? INTERACTIVE : ''} ${className}`
  if (to) {
    return (
      <Link to={to} className={`block ${cls}`} style={style}>
        {children}
      </Link>
    )
  }
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  )
}
