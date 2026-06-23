import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  icon?: IconName
  title: string
  description?: string
}

export function EmptyState({ icon = 'search', title, description }: EmptyStateProps) {
  return (
    <div className="rise flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-gradient-to-b from-white to-stone-50 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100">
        <Icon name={icon} size={26} />
      </span>
      <p className="mt-3 font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-slate-500">{description}</p>}
    </div>
  )
}
