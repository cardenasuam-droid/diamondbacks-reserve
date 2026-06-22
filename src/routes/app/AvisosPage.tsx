import { useEffect } from 'react'
import {
  useMyNotifications,
  markAvisosSeen,
  whatsappShareUrl,
  type AppNotification,
} from '@/features/notifications/useNotifications'
import { roleLabel } from '@/features/auth/roles'
import { formatDate } from '@/lib/date'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'

function audienceTag(n: AppNotification): string {
  if (n.target_user_id) return 'Para ti'
  if (n.target_team_id) return 'Tu equipo'
  if (n.target_role) return roleLabel(n.target_role)
  return 'General'
}

export function AvisosPage() {
  const avisos = useMyNotifications()

  // Al abrir, todo queda "leído" (quita el punto de la campana).
  useEffect(() => {
    if (avisos.isSuccess) markAvisosSeen()
  }, [avisos.isSuccess, avisos.data])

  if (avisos.isLoading) return <Loader label="Cargando avisos…" />
  if (avisos.isError) return <ErrorState onRetry={() => avisos.refetch()} />

  return (
    <div>
      <PageHeader title="Avisos" subtitle="Comunicados de la liga" />
      {!avisos.data || avisos.data.length === 0 ? (
        <EmptyState icon="🔔" title="No tienes avisos" description="Aquí aparecerán los comunicados que te lleguen." />
      ) : (
        <ul className="space-y-3">
          {avisos.data.map((n) => (
            <li key={n.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <span className="flex-1 font-semibold text-slate-800">{n.title}</span>
                <Badge color="emerald">{audienceTag(n)}</Badge>
              </div>
              {formatDate(n.created_at) && (
                <p className="mt-0.5 text-xs text-slate-500">{formatDate(n.created_at)}</p>
              )}
              {n.body && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{n.body}</p>}
              <a
                href={whatsappShareUrl(n.title, n.body)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                Compartir por WhatsApp ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
