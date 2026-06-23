// Placeholder de carga (shimmer) para contenido. El registro "product" prefiere
// skeletons antes que spinners centrados para listas/tablas/tarjetas.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} aria-hidden />
}

// Bloque típico: varias líneas dentro de una tarjeta.
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3" />
        ))}
      </div>
    </div>
  )
}
