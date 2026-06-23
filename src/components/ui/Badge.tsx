import type { ReactNode } from 'react'

const COLORS = {
  slate: 'bg-slate-100 text-slate-600',
  blue: 'bg-blue-100 text-blue-700',
  rose: 'bg-rose-100 text-rose-700',
  purple: 'bg-purple-100 text-purple-700',
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
} as const

export type BadgeColor = keyof typeof COLORS

export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: BadgeColor }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ring-black/5 ${COLORS[color]}`}
    >
      {children}
    </span>
  )
}
