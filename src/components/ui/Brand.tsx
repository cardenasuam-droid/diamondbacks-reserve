// Marca de la liga: cuadro esmeralda con la pelota + wordmark. Reutilizable en
// cabeceras, drawer y login para una identidad consistente.
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-base text-white shadow-sm">
        🎾
      </span>
      {!compact && (
        <span className="text-base font-extrabold tracking-tight text-slate-900">
          Liga de Pádel
        </span>
      )}
    </span>
  )
}
