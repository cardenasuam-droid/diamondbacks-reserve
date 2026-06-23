import type { ReactNode } from 'react'

// Pills translúcidos para tema oscuro: fondo tenue del color + texto claro del
// mismo tono. El slate usa el neutro invertido (chip oscuro, texto claro).
const COLORS = {
  slate: 'bg-slate-200/70 text-slate-700',
  blue: 'bg-blue-500/15 text-blue-300',
  rose: 'bg-rose-500/15 text-rose-300',
  purple: 'bg-purple-500/15 text-purple-300',
  amber: 'bg-amber-500/15 text-amber-300',
  emerald: 'bg-emerald-500/15 text-emerald-300',
} as const

export type BadgeColor = keyof typeof COLORS

export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: BadgeColor }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ring-white/10 ${COLORS[color]}`}
    >
      {children}
    </span>
  )
}
