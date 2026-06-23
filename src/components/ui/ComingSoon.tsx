import { PageHeader } from './PageHeader'

// Placeholder honesto para secciones públicas aún no construidas. Se reemplazará
// por la página real en su sub-módulo. Mantiene la navegación sin enlaces rotos.
export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-100 px-6 py-12 text-center">
        <div className="text-4xl" aria-hidden>
          🚧
        </div>
        <p className="mt-3 font-semibold text-slate-700">En construcción</p>
        <p className="mt-1 max-w-xs text-sm text-slate-500">
          {note ?? 'Esta sección llega en un módulo próximo.'}
        </p>
      </div>
    </div>
  )
}
