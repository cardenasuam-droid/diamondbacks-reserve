import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useLeagueSeason, useSeasonCategories } from '@/features/leagues/useLeagues'
import {
  useRegistrationStatus,
  useAttachReceipt,
  type RegistrationStatusRow,
} from '@/features/registration/useRegistrationStatus'
import { getRegToken, saveRegToken } from '@/lib/regToken'
import { Linkify } from '@/components/ui/Linkify'
import { Icon } from '@/components/ui/Icon'
import { Loader } from '@/components/ui/Loader'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// "Mi inscripción" (0057): /registro/:leagueSlug/estado. La jugadora confirma
// que su alta llegó y sube comprobantes pendientes. La credencial es el token
// del enlace mágico (?t=…) o el recordado en el dispositivo; nunca hay lista
// de inscripciones ni datos privados (el RPC no devuelve teléfono ni fecha de
// nacimiento). Usa la edición VIGENTE de la liga, no la abierta: el estado
// sigue consultable después de cerrar inscripciones.
export function RegistrationStatusPage() {
  const { leagueSlug } = useParams<{ leagueSlug: string }>()
  const [searchParams] = useSearchParams()
  const seasonQ = useLeagueSeason(leagueSlug)
  const season = seasonQ.data

  // El de la URL manda (aunque venga roto: no caer en silencio a otro token
  // guardado que podría ser de OTRA persona en este teléfono); si no hay ?t=,
  // el recordado en el dispositivo. Un token que no es uuid se trata como
  // enlace inválido sin llegar a la red.
  const urlToken = searchParams.get('t')
  const storedToken = season ? getRegToken(season.id) : null
  const rawToken = urlToken ?? storedToken
  const token = rawToken && UUID_RE.test(rawToken) ? rawToken : null

  const statusQ = useRegistrationStatus(token)
  const row = statusQ.data
  // Las categorías se traducen con el catálogo de LA EDICIÓN DE LA FILA (un
  // enlace viejo puede ser de una edición anterior a la vigente).
  const categoriesQ = useSeasonCategories(row?.season_id)

  // Quien llega por el enlace en otro teléfono: recordamos el token aquí
  // también, para que la próxima visita no necesite el ?t=.
  useEffect(() => {
    if (urlToken && row) saveRegToken(row.season_id, urlToken)
  }, [urlToken, row])

  if (seasonQ.isLoading || (token && statusQ.isLoading)) {
    return (
      <div data-league={leagueSlug} className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-md px-4 pt-16">
          <Loader label="Cargando…" />
        </div>
      </div>
    )
  }

  const league = season?.league
  // null cuando la edición no pregunta categoría (0058): el comité la asigna.
  const categoryName = row?.requested_category_code
    ? (categoriesQ.data ?? []).find((c) => c.code === row.requested_category_code)?.name ??
      row.requested_category_code
    : null
  // Instrucciones de pago solo si la fila es de la edición vigente: las de
  // otra edición podrían ya no aplicar.
  const paymentInstructions =
    row && season && row.season_id === season.id ? season.payment_instructions : null

  return (
    <div data-league={leagueSlug} className="min-h-full bg-slate-50">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-12 pt-safe">
        <header className="pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">
            {league?.name ?? 'Diamondbacks Pádel'}
          </p>
          <h1 className="mt-1 font-heading text-2xl tracking-tight text-slate-900">
            Mi inscripción
          </h1>
        </header>

        <main className="rise flex-1 pt-4">
          {!token ? (
            <NoTokenCard
              leagueSlug={leagueSlug ?? ''}
              registrationOpen={Boolean(season?.registration_open)}
              badLink={Boolean(rawToken)}
            />
          ) : statusQ.isError ? (
            <div className="rounded-3xl bg-slate-100 p-6 text-center shadow-md">
              <p className="text-sm leading-relaxed text-slate-500">
                No pudimos consultar tu inscripción. Revisa tu conexión e inténtalo de
                nuevo.
              </p>
              <button
                onClick={() => void statusQ.refetch()}
                className="neu-raised mx-auto mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                <Icon name="refresh" size={16} /> Reintentar
              </button>
            </div>
          ) : !row ? (
            <NoTokenCard
              leagueSlug={leagueSlug ?? ''}
              registrationOpen={Boolean(season?.registration_open)}
              badLink
            />
          ) : (
            <StatusCard
              row={row}
              token={token}
              leagueSlug={leagueSlug ?? ''}
              categoryName={categoryName}
              paymentInstructions={paymentInstructions}
            />
          )}
        </main>

        <footer className="pt-6 text-center text-xs text-slate-600">
          <Link to={`/${leagueSlug}`} className="underline">
            {league?.name ?? 'Volver a la liga'}
          </Link>
        </footer>
      </div>
    </div>
  )
}

function NoTokenCard({
  leagueSlug,
  registrationOpen,
  badLink,
}: {
  leagueSlug: string
  registrationOpen: boolean
  badLink?: boolean
}) {
  return (
    <div className="rounded-3xl bg-slate-100 p-6 text-center shadow-md">
      <span className="neu-raised mx-auto flex h-16 w-16 items-center justify-center rounded-full text-slate-500">
        <Icon name="search" size={28} />
      </span>
      <h2 className="mt-4 font-heading text-xl text-slate-900">
        {badLink ? 'No encontramos esta inscripción' : 'No hay una inscripción guardada aquí'}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        {badLink
          ? 'El enlace no corresponde a ninguna inscripción. Revisa que lo hayas copiado completo, o escribe a la organizadora.'
          : 'Si ya te inscribiste desde otro teléfono, abre el enlace de "Mi inscripción" que copiaste al enviarla: este dispositivo lo recordará.'}
      </p>
      {registrationOpen && (
        <Link
          to={`/registro/${leagueSlug}`}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-300 px-4 py-3 font-semibold text-[#1a1405] shadow-sm"
        >
          Inscribirme
          <Icon name="chevron-right" size={18} />
        </Link>
      )}
    </div>
  )
}

function StatusCard({
  row,
  token,
  leagueSlug,
  categoryName,
  paymentInstructions,
}: {
  row: RegistrationStatusRow
  token: string
  leagueSlug: string
  categoryName: string | null
  paymentInstructions: string | null
}) {
  const attach = useAttachReceipt()
  const [copied, setCopied] = useState(false)
  const rejected = row.status === 'rejected'
  // El servidor bloquea adjuntos si la alta fue rechazada o el pago ya se
  // verificó; la UI esconde los controles en esos casos.
  const canUpload = !rejected && !row.payment_verified

  const statusUrl = `/registro/${leagueSlug}/estado?t=${token}`
  const fullUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${statusUrl}` : statusUrl

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  function onPick(kind: 'payment' | 'discount') {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = '' // permite volver a elegir el mismo archivo
      if (file) attach.mutate({ token, kind, file })
    }
  }

  const createdLabel = new Date(row.created_at).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-4">
      {/* Confirmación: esto es lo que la jugadora viene a comprobar. */}
      <div className="rounded-3xl bg-slate-100 p-6 text-center shadow-md">
        <span
          className={`neu-raised mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
            rejected ? 'text-slate-500' : 'text-brand-300'
          }`}
        >
          <Icon name={rejected ? 'ban' : 'check'} size={32} />
        </span>
        <h2 className="mt-4 font-heading text-xl text-slate-900">
          {rejected ? 'Inscripción no aceptada' : 'Tu inscripción está registrada'}
        </h2>
        <p className="mt-1 text-base font-semibold text-slate-800">{row.full_name}</p>
        <p className="mt-0.5 text-sm text-slate-500">
          {categoryName ? `${categoryName} · enviada el ${createdLabel}` : `Enviada el ${createdLabel}`}
        </p>

        {rejected ? (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/15 p-3 text-left text-sm text-amber-200">
            El comité no pudo aceptar esta inscripción. Si crees que es un error,
            escribe a la organizadora.
          </p>
        ) : row.payment_verified ? (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-3 py-1.5 text-xs font-semibold text-brand-200 ring-1 ring-brand-500/30">
            <Icon name="check" size={14} />
            Pago confirmado — tu lugar está apartado
          </p>
        ) : (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/30">
            <Icon name="waitlist" size={14} />
            Pago por verificar
          </p>
        )}
      </div>

      {/* Comprobantes: estado y adjunto tardío. */}
      {!rejected && (
        <div className="rounded-3xl bg-slate-100 p-5 shadow-md">
          <p className="text-sm font-medium text-slate-700">Comprobantes</p>

          {attach.isError && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {(attach.error as Error).message}
            </p>
          )}

          <ReceiptRow
            label="Comprobante de pago"
            done={row.has_receipt}
            canUpload={canUpload}
            uploading={attach.isPending && attach.variables?.kind === 'payment'}
            onChange={onPick('payment')}
          />
          <ReceiptRow
            label="Comprobante torneo Peak Padel (descuento $250)"
            done={row.has_discount_receipt}
            canUpload={canUpload}
            uploading={attach.isPending && attach.variables?.kind === 'discount'}
            onChange={onPick('discount')}
          />

          {row.payment_verified ? (
            <p className="mt-3 text-center text-[11px] text-slate-500">
              Tu pago ya fue confirmado; no hace falta subir nada más.
            </p>
          ) : (
            <p className="mt-3 text-center text-[11px] text-slate-500">
              Imagen o PDF, máx. 5 MB. Tu lugar se aparta cuando el comité confirma
              tu pago.
            </p>
          )}

          {paymentInstructions && !row.payment_verified && (
            <div className="mt-3 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">¿Cómo pagar?</p>
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-500">
                <Linkify text={paymentInstructions} />
              </p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => void copy()}
        className="neu-raised flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700"
      >
        <Icon name="share" size={16} />
        {copied ? 'Enlace copiado' : 'Copiar mi enlace'}
      </button>
      <p className="text-center text-[11px] leading-relaxed text-slate-500">
        Guarda tu enlace: con él puedes ver tu inscripción desde cualquier teléfono.
      </p>
    </div>
  )
}

function ReceiptRow({
  label,
  done,
  canUpload,
  uploading,
  onChange,
}: {
  label: string
  done: boolean
  canUpload: boolean
  uploading: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="mt-2.5 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          done
            ? 'bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30'
            : 'bg-slate-200 text-slate-500'
        }`}
      >
        <Icon name={done ? 'check' : 'import'} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">
          {done ? 'Recibido' : 'Sin subir'}
        </span>
      </span>
      {canUpload && (
        <label
          className={`neu-raised shrink-0 cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 ${
            uploading ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          {uploading ? 'Subiendo…' : done ? 'Reemplazar' : 'Subir'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={onChange}
          />
        </label>
      )}
    </div>
  )
}
