import { SHIRT_SIZES, type ShirtSize } from '@/lib/shirtSize'

// Selector segmentado de talla (XS–XXL). Mismo lenguaje de botones que el de
// posición en el registro (neu-raised/neu-pressed). Reutilizado en registro,
// perfil y gestión del organizador.
export function ShirtSizePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ShirtSize | null
  onChange: (size: ShirtSize) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {SHIRT_SIZES.map((s) => {
        const active = value === s
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(s)}
            className={
              active
                ? 'neu-pressed rounded-lg px-1 py-2 text-sm font-semibold text-brand-300 disabled:opacity-50'
                : 'neu-raised rounded-lg px-1 py-2 text-sm font-medium text-slate-700 disabled:opacity-50'
            }
          >
            {s}
          </button>
        )
      })}
    </div>
  )
}
