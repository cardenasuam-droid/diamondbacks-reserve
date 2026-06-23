import { useState } from 'react'
import { useAllNews } from '@/features/news/useNews'
import { useSaveNews, useDeleteNews } from '@/features/news/contentMutations'
import { MediaField } from '@/features/news/MediaField'
import { formatDate } from '@/lib/date'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import type { NewsPost } from '@/features/news/types'

interface Draft {
  id?: string
  title: string
  body: string
  image_url: string
  published: boolean
}

const EMPTY: Draft = { title: '', body: '', image_url: '', published: false }

export function NewsManagerPage() {
  const news = useAllNews()
  const save = useSaveNews()
  const del = useDeleteNews()
  const [draft, setDraft] = useState<Draft | null>(null)

  function edit(n: NewsPost) {
    setDraft({
      id: n.id,
      title: n.title,
      body: n.body ?? '',
      image_url: n.image_url ?? '',
      published: n.published,
    })
  }

  async function handleSave(publish?: boolean) {
    if (!draft) return
    const published = publish ?? draft.published
    await save.mutateAsync({ ...draft, audience: 'public', published })
    setDraft(null)
  }

  if (news.isLoading) return <Loader label="Cargando noticias…" />
  if (news.isError) return <ErrorState onRetry={() => news.refetch()} />

  return (
    <div className="space-y-4">
      <PageHeader title="Noticias" subtitle="Crear y publicar comunicados" />

      {!draft ? (
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Nueva noticia
        </button>
      ) : (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Título"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-medium"
          />
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="Contenido…"
            rows={6}
            className="w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
          <MediaField
            label="Imagen (opcional)"
            value={draft.image_url}
            onChange={(url) => setDraft({ ...draft, image_url: url })}
            accept="image/*"
            folder="news"
          />
          {save.isError && (
            <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
              {(save.error as Error).message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSave(false)}
              disabled={!draft.title.trim() || save.isPending}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Guardar borrador
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={!draft.title.trim() || save.isPending}
              className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {save.isPending ? 'Guardando…' : 'Publicar'}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-lg px-3 py-2 text-sm text-slate-500"
            >
              Cancelar
            </button>
          </div>
        </section>
      )}

      <ul className="space-y-2">
        {(news.data ?? []).map((n) => (
          <li
            key={n.id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-sm"
          >
            <span className="flex-1">
              <span className="block font-medium text-slate-800">{n.title}</span>
              <span className="text-xs text-slate-500">{formatDate(n.created_at)}</span>
            </span>
            <Badge color={n.published ? 'emerald' : 'slate'}>
              {n.published ? 'Publicada' : 'Borrador'}
            </Badge>
            <button onClick={() => edit(n)} className="text-sm text-sky-300 underline">
              Editar
            </button>
            <button
              onClick={() => {
                if (confirm(`¿Eliminar "${n.title}"?`)) void del.mutate(n.id)
              }}
              className="text-sm text-rose-600 underline"
            >
              Borrar
            </button>
          </li>
        ))}
        {(news.data ?? []).length === 0 && (
          <li className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm text-slate-500">
            Aún no hay noticias.
          </li>
        )}
      </ul>
    </div>
  )
}
