import { useMemo, useState } from 'react'
import {
  useOpenRegistrationSeasons,
  useSeasonCategories,
  useSeasonPaidCount,
  type OpenRegistrationSeason,
} from '@/features/leagues/useLeagues'
import { useCategories } from '@/features/categories/useCategories'
import { rankingCategories } from '@/features/registration/category'
import {
  usePendingRegistrations,
  useApproveRegistration,
  useRejectRegistration,
  useVerifyPayment,
  receiptSignedUrl,
} from '@/features/registration/useRegistrations'
import type { PlayerRegistration, PlayerPosition } from '@/features/registration/types'
import type { MatchCategory } from '@/lib/types'
import { pmLabel, ageFromBirthdate } from '@/lib/format'
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

// Bandeja de inscripciones multi-liga (0049): una pestaña por edición con
// inscripción abierta. Reserve conserva su flujo (aprobar → pool del draft);
// las ligas americano aprueban directo a ficha sin equipo, con cupo visible y
// comprobante de pago verificable (0050).
export function OrganizerRegistrationsPage() {
  const open = useOpenRegistrationSeasons()
  const seasons = open.data ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = seasons.find((s) => s.id === selectedId) ?? seasons[0] ?? null

  if (open.isLoading) return <Loader label="Cargando…" />
  if (!selected) {
    return (
      <div>
        <PageHeader title="Inscripciones" />
        <EmptyState
          icon="organizer"
          title="No hay inscripciones abiertas"
          description="Abre la inscripción de una edición para recibir registros."
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Inscripciones" subtitle={`${selected.league.name} · ${selected.name}`} />

      {seasons.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {seasons.map((s) => {
            const active = s.id === selected.id
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedId(s.id)}
                className={
                  active
                    ? 'neu-pressed rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-300'
                    : 'neu-raised rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700'
                }
              >
                {tabLabel(s)}
              </button>
            )
          })}
        </div>
      )}

      <SeasonQueue key={selected.id} season={selected} />
    </div>
  )
}

function tabLabel(s: OpenRegistrationSeason): string {
  if (s.league.slug === 'reserve') return 'Reserve'
  const slug = s.league.slug
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

function SeasonQueue({ season }: { season: OpenRegistrationSeason }) {
  const isAmericano = season.league.kind === 'americano'
  const registrations = usePendingRegistrations(season.id)
  // El cupo se cuenta por PAGOS verificados (0056), no por fichas creadas.
  const paidCount = useSeasonPaidCount(season.max_players != null ? season.id : undefined)

  // Categorías ofrecidas al aprobar: las de la edición (0049); si la edición
  // no tiene catálogo (datos viejos), todas las de ranking como antes.
  const seasonCats = useSeasonCategories(season.id)
  const allCats = useCategories()
  const categories = useMemo(() => {
    const own = (seasonCats.data ?? []).filter((c) => c.is_ranking && c.is_active)
    if (own.length > 0) return own
    return rankingCategories(allCats.data ?? [])
  }, [seasonCats.data, allCats.data])

  const pending = registrations.data ?? []
  const capacity =
    season.max_players != null && paidCount.data != null
      ? { paid: paidCount.data, max: season.max_players }
      : null

  return (
    <>
      {capacity && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-300">
            <Icon name="account" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">Cupo de la edición (por pago confirmado)</p>
            <p className="text-sm font-medium text-slate-800">
              {capacity.paid} de {capacity.max} lugares pagados
              {pending.length > 0 && ` · ${pending.length} por revisar`}
            </p>
          </div>
        </div>
      )}

      <ShareLink
        url={isAmericano ? `/${season.league.slug}` : '/registro/reserve'}
        label={isAmericano ? 'Landing pública para compartir' : 'Enlace público de inscripción'}
      />

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
          description="Cuando alguien se inscriba aparecerá aquí para revisión."
        />
      ) : (
        <div className="space-y-3">
          {pending.map((r) => (
            <ReviewCard
              key={r.id}
              registration={r}
              categories={categories}
              season={season}
              // Con cupo lleno solo se frena a quien NO tiene pago verificado:
              // las pagadas ya ocupan uno de los lugares contados.
              capFull={
                capacity != null &&
                capacity.paid >= capacity.max &&
                !r.payment_verified_at
              }
            />
          ))}
        </div>
      )}
    </>
  )
}

// Tarjeta con el enlace público para compartir (WhatsApp, redes, etc.).
function ShareLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const full = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url

  async function copy() {
    try {
      await navigator.clipboard.writeText(full)
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
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800">{full}</p>
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
  season,
  capFull,
}: {
  registration: PlayerRegistration
  categories: MatchCategory[]
  season: OpenRegistrationSeason
  capFull: boolean
}) {
  const isAmericano = season.league.kind === 'americano'
  const approve = useApproveRegistration()
  const reject = useRejectRegistration()
  const verify = useVerifyPayment()
  const [categoryCode, setCategoryCode] = useState(registration.requested_category_code)
  const [localError, setLocalError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [notes, setNotes] = useState('')

  const requested = categories.find((c) => c.code === registration.requested_category_code)
  const when = new Date(registration.created_at).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
  })
  const age = registration.birthdate ? ageFromBirthdate(registration.birthdate) : null
  const paid = Boolean(registration.payment_verified_at)

  function onApprove() {
    setLocalError(null)
    const cat = categories.find((c) => c.code === categoryCode)
    if (!cat) return setLocalError('Elige una categoría válida.')
    approve.mutate({ registration, categoryCode, categoryType: cat.type, seasonId: season.id })
  }

  async function openReceipt(path: string | null) {
    if (!path) return
    try {
      const url = await receiptSignedUrl(path)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      setLocalError((e as Error).message)
    }
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
        {age != null && <Chip>{age} años</Chip>}
        {registration.blocked_time_labels && registration.blocked_time_labels.length > 0 && (
          <Chip>Evita: {registration.blocked_time_labels.map(pmLabel).join(', ')}</Chip>
        )}
      </div>

      {registration.comment && (
        <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
          “{registration.comment}”
        </p>
      )}

      {/* Pago (0050): estado + comprobante + verificación con sello. */}
      {(registration.receipt_path || paid || isAmericano) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={
              paid
                ? 'inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs font-medium text-brand-200 ring-1 ring-brand-500/30'
                : 'inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-200'
            }
          >
            <Icon name={paid ? 'check' : 'lock'} size={12} />
            {paid ? 'Pago verificado' : 'Pago por verificar'}
          </span>
          {registration.receipt_path && (
            <button
              onClick={() => void openReceipt(registration.receipt_path)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-400"
            >
              Ver comprobante
            </button>
          )}
          {registration.discount_receipt_path && (
            <>
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-300">
                <Icon name="medal" size={12} />
                Pide descuento Peak (−$250)
              </span>
              <button
                onClick={() => void openReceipt(registration.discount_receipt_path)}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-400"
              >
                Ver comprobante Peak
              </button>
            </>
          )}
          <button
            onClick={() => verify.mutate({ id: registration.id, verified: !paid })}
            disabled={verify.isPending}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 disabled:opacity-50"
          >
            {verify.isPending ? 'Guardando…' : paid ? 'Quitar verificación' : 'Marcar pago verificado'}
          </button>
        </div>
      )}

      {(approve.isError || localError) && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
              {isAmericano
                ? 'Categoría · la ficha se crea al aprobar'
                : 'Categoría · el equipo se asigna en el Draft'}
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

          {capFull && (
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
              Cupo pagado lleno y esta inscripción no tiene pago verificado.
              Libera un lugar (rechaza o quita una verificación) antes de aprobarla.
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={onApprove}
              disabled={approve.isPending || capFull}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-400 px-3 py-2 text-sm font-semibold text-[#0c0c0f] disabled:opacity-50"
            >
              <Icon name="check" size={16} />
              {approve.isPending ? 'Aprobando…' : isAmericano ? 'Aprobar inscripción' : 'Aprobar al pool'}
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
