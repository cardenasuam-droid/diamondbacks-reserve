// Loader simple, centrado. Mobile-first.
export function Loader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600"
        aria-hidden
      />
      <span className="text-sm">{label}</span>
    </div>
  )
}
