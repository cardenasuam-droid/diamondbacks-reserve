import { useState } from 'react'
import { useAllDocuments } from '@/features/news/useDocuments'
import { useSaveDocument } from '@/features/news/contentMutations'
import { MediaField } from '@/features/news/MediaField'
import { formatDate } from '@/lib/date'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'

export function ReglamentoManagerPage() {
  const docs = useAllDocuments()
  const save = useSaveDocument()

  const [title, setTitle] = useState('Reglamento oficial')
  const [version, setVersion] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [done, setDone] = useState(false)

  async function publish() {
    setDone(false)
    await save.mutateAsync({ title, version, file_url: fileUrl })
    setDone(true)
    setFileUrl('')
    setVersion('')
  }

  if (docs.isLoading) return <Loader label="Cargando…" />
  if (docs.isError) return <ErrorState onRetry={() => docs.refetch()} />

  return (
    <div className="space-y-4">
      <PageHeader title="Reglamento" subtitle="Publicar el documento vigente (PDF)" />

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block">
          <span className="block text-sm font-medium text-slate-700">Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700">Versión (opcional)</span>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="p. ej. 2026.1"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <MediaField
          label="Archivo PDF"
          value={fileUrl}
          onChange={setFileUrl}
          accept="application/pdf"
          folder="reglamento"
        />

        {save.isError && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {(save.error as Error).message}
          </p>
        )}
        {done && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            ✅ Reglamento publicado como vigente.
          </p>
        )}

        <button
          onClick={publish}
          disabled={!title.trim() || !fileUrl.trim() || save.isPending}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {save.isPending ? 'Publicando…' : 'Publicar como vigente'}
        </button>
      </section>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">Versiones</h2>
        <ul className="space-y-2">
          {(docs.data ?? []).map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <span className="flex-1">
                <span className="block font-medium text-slate-800">{d.title}</span>
                <span className="text-xs text-slate-400">
                  {d.version ? `v${d.version} · ` : ''}
                  {formatDate(d.created_at)}
                </span>
              </span>
              {d.is_active && <Badge color="emerald">Vigente</Badge>}
              <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-600 underline">
                Abrir
              </a>
            </li>
          ))}
          {(docs.data ?? []).length === 0 && (
            <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Aún no hay reglamento publicado.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
