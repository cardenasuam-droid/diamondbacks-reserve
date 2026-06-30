import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Elemento a la izquierda del título (p. ej. el escudo del equipo). */
  leading?: ReactNode
}

export function PageHeader({ title, subtitle, leading }: PageHeaderProps) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {leading}
      <div className="min-w-0">
        <h1 className="font-heading text-2xl tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
  )
}
