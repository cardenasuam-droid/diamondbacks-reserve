import { Link, useParams } from 'react-router-dom'
import { useNewsPost } from '@/features/news/useNews'
import { formatDate } from '@/lib/date'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'

export function NewsDetailPage() {
  const { newsId } = useParams()
  const post = useNewsPost(newsId)

  if (post.isLoading) return <Loader label="Cargando…" />
  if (post.isError) return <ErrorState onRetry={() => post.refetch()} />
  if (!post.data) {
    return <EmptyState icon="📰" title="Noticia no encontrada" />
  }

  const n = post.data
  return (
    <article className="space-y-4">
      <Link to="/noticias" className="text-sm text-sky-600 underline">
        ‹ Noticias
      </Link>
      {n.image_url && (
        <img src={n.image_url} alt="" className="w-full rounded-xl object-cover" />
      )}
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{n.title}</h1>
        {formatDate(n.published_at ?? n.created_at) && (
          <p className="mt-1 text-sm text-slate-500">{formatDate(n.published_at ?? n.created_at)}</p>
        )}
      </header>
      {n.body && <p className="whitespace-pre-wrap text-slate-700">{n.body}</p>}
    </article>
  )
}
