interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Algo salió mal',
  description = 'No pudimos cargar la información. Inténtalo de nuevo.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <div className="text-3xl" aria-hidden>
        ⚠️
      </div>
      <p className="mt-2 font-semibold text-red-800">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-red-700">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg border border-red-300 bg-slate-100 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}
