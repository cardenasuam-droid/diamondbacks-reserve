import { useActiveReglamento } from '@/features/news/useDocuments'
import { formatDate } from '@/lib/date'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'

export function ReglamentoPage() {
  const doc = useActiveReglamento()

  if (doc.isLoading) return <Loader label="Cargando reglamento…" />
  if (doc.isError) return <ErrorState onRetry={() => doc.refetch()} />

  return (
    <div>
      <PageHeader title="Reglamento" subtitle="Documento oficial de la liga" />
      {!doc.data ? (
        <EmptyState icon="📄" title="Aún no hay reglamento" description="Cuando se publique, podrás abrirlo aquí." />
      ) : (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{doc.data.title}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {doc.data.version ? `Versión ${doc.data.version}` : 'Vigente'}
              {formatDate(doc.data.created_at) ? ` · ${formatDate(doc.data.created_at)}` : ''}
            </p>
          </div>
          <a
            href={doc.data.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            📄 Abrir reglamento (PDF)
          </a>
        </div>
      )}
    </div>
  )
}
