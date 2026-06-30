import { useMemo, useState } from 'react'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useCategories } from '@/features/categories/useCategories'
import { rankingCategories } from '@/features/registration/category'
import {
  usePendingRegistrations,
  useApproveRegistration,
  useRejectRegistration,
} from '@/features/registration/useRegistrations'
import type { PlayerRegistration, PlayerPosition } from '@/features/registration/types'
import type { MatchCategory } from '@/lib/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Icon } from '@/components/ui/Icon'

const POSITION_LABEL: Record<PlayerPosition, string> = {
  drive: 'Drive',
  reves: 'Revés',
  ambas: 'Ambas',
}

export function OrganizerRegistrationsPage() {
  const season = useActiveSeason()
  const registrations = usePendingRegistrations(season.data?.id)
  const categories = useCategories()
  const ranking = useMemo(() => rankingCategories(categories.data ?? []), [categories.data])

  if (season.isLoading) return <Loader label="Cargando…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Inscripciones" />
        <EmptyState
          icon="organizer"
          title="No hay temporada activa"
          description="Activa una temporada para recibir inscripciones."
        />
      </div>
    )
  }

  const pending = registrations.data ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inscripciones"
        subtitle={`${season.data.name} · ${pending.length} pendiente${pending.length === 1 ? '' : 's'}`}
      />

      <ShareLink />

      {registrations.isLoading ? (
        <Loader label="Cargando inscripciones…" />
      ) : registrations.isError ? (
        <ErrorState
          description="No pudimos cargar las inscripciones."
          onRetry={() => void registrations.refetch()}
        />
      ) : pending.length === 0 ? (
        <EmptyState
          icon="account"
          title="Sin inscripciones pendientes"
          description="Cuando alguien se inscriba en /registro aparecerá aquí para revisión."
        />
      ) : (
        <div className="space-y-3">
          {pending.map((r) => (
            <ReviewCard
              key={r.id}
              registration={r}
              categories={ranking}
              seasonId={season.data!.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Tarjeta con el enlace público para compartir (WhatsApp, redes, etc.).
function ShareLink() {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/registro` : '/registro'

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-300">
        <Icon name="share" size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">Enlace público de inscripción</p>
        <p className="truncate text-sm font-medium text-slate-800">{url}</p>
      </div>
      <button
        onClick={copy}
        className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400"
      >
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

function ReviewCard({
  registration,
  categories,
  seasonId,
}: {
  registration: PlayerRegistration
  categories: MatchCategory[]
  seasonId: string
}) {
  const approve = useApproveRegistration()
  const reject = useRejectRegistration()
  const [categoryCode, setCategoryCode] = useState(registration.requested_category_code)
  const [localError, setLocalError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [notes, setNotes] = useState('')

  const requested = categories.find((c) => c.code === registration.requested_category_code)
  const when = new Date(registration.created_at).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
  })

  function onApprove() {
    setLocalError(null)
    const cat = categories.find((c) => c.code === categoryCode)
    if (!cat) return setLocalError('Elige una categoría válida.')
    approve.mutate({ registration, categoryCode, categoryType: cat.type, seasonId })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{registration.full_name}</p>
          <p className="mt-0.5 text-sm text-slate-600">
            <a href={`tel:${registration.phone}`} className="text-sky-300 underline">
              {registration.phone}
            </a>
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-500">{when}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip>Pide: {requested?.name ?? registration.requested_category_code}</Chip>
        <Chip>Posición: {POSITION_LABEL[registration.position]}</Chip>
        {registration.shirt_size && <Chip>Talla: {registration.shirt_size}</Chip>}
      </div>

      {registration.comment && (
        <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
          “{registration.comment}”
        </p>
      )}

      {(approve.isError || localError) && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {localError ?? (approve.error as Error).message}
        </p>
      )}

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Motivo (opcional, interno)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
          <div className="flex gap-2">
            <button
              onClick={() => reject.mutate({ id: registration.id, notes })}
              disabled={reject.isPending}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {reject.isPending ? 'Rechazando…' : 'Confirmar rechazo'}
            </button>
            <button
              onClick={() => setRejecting(false)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <label className="mt-3 block">
            <span className="block text-xs font-medium text-slate-600">
              Categoría · el equipo se asigna en el Draft
            </span>
            <select
              value={categoryCode}
              onChange={(e) => setCategoryCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-2 py-2 text-sm text-slate-800 outline-none focus:border-sky-500"
            >
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3 flex gap-2">
            <button
              onClick={onApprove}
              disabled={approve.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-400 px-3 py-2 text-sm font-semibold text-[#0c0c0f] disabled:opacity-50"
            >
              <Icon name="check" size={16} />
              {approve.isPending ? 'Aprobando…' : 'Aprobar al pool'}
            </button>
            <button
              onClick={() => setRejecting(true)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
            >
              Rechazar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">
      {children}
    </span>
  )
}
