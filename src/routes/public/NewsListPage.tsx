import { Link } from 'react-router-dom'
import { usePublishedNews } from '@/features/news/useNews'
import { formatDate } from '@/lib/date'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'

export function NewsListPage() {
  const news = usePublishedNews()

  if (news.isLoading) return <Loader label="Cargando noticias…" />
  if (news.isError) return <ErrorState onRetry={() => news.refetch()} />

  return (
    <div>
      <PageHeader title="Noticias" subtitle="Avisos y comunicados de la liga" />
      {!news.data || news.data.length === 0 ? (
        <EmptyState icon="📰" title="Aún no hay noticias" description="Cuando se publiquen, aparecerán aquí." />
      ) : (
        <ul className="space-y-3">
          {news.data.map((n) => (
            <li key={n.id}>
              <Link
                to={`/noticias/${n.id}`}
                className="block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:border-slate-300"
              >
                {n.image_url && (
                  <img src={n.image_url} alt="" className="h-40 w-full object-cover" loading="lazy" />
                )}
                <div className="p-4">
                  <h2 className="font-semibold text-slate-800">{n.title}</h2>
                  {formatDate(n.published_at ?? n.created_at) && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatDate(n.published_at ?? n.created_at)}
                    </p>
                  )}
                  {n.body && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{n.body}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
