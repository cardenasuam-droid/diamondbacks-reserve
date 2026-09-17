import { Icon } from '@/components/ui/Icon'

// Piezas compartidas de los formularios de inscripción (/registro/*). Vivían
// dentro de RegisterPage; se extraen para reusarlas en el formulario americano
// sin duplicar el estilo.

export function inputCls(error?: string): string {
  // El relieve "inset" (pozo) lo da la regla global de inputs en index.css; aquí
  // solo el layout, la tinta nítida y el aro de error.
  const base = 'mt-1 w-full rounded-xl px-3 py-2.5 text-base text-slate-900'
  return error ? `${base} ring-2 ring-red-500/70` : base
}

export function Field({
  label,
  error,
  hint,
  hintIcon,
  children,
}: {
  label: string
  error?: string
  hint?: string
  hintIcon?: 'lock' | 'medal' | 'schedule'
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          {hintIcon && <Icon name={hintIcon} size={12} />}
          {hint}
        </span>
      ) : null}
    </label>
  )
}
