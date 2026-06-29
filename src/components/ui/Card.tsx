import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Tarjeta base de la app: superficie neumórfica EXTRUIDA (mismo tono que el fondo
// ónix-esmeralda + sombra dual = relieve suave). `interactive`/`to` realzan al
// pasar el cursor (sube + sombra más profunda). Un único lenguaje en toda la app.
const BASE = 'rounded-3xl bg-slate-50 shadow-sm'
const INTERACTIVE = 'transition duration-200 hover:-translate-y-0.5 hover:shadow-md'

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
