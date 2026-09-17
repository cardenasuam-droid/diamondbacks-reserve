import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/features/auth/context'
import { useMyPlayerPrefill } from '@/features/registration/usePrefill'
import { SHIRT_SIZES } from '@/lib/shirtSize'
import {
  useLeagueOpenSeason,
  useSeasonCategories,
  useSeasonTimeBlocks,
  useSeasonPaidCount,
} from '@/features/leagues/useLeagues'
import {
  americanoRegistrationSchema,
  MAX_BLOCKED_SLOTS,
} from '@/features/registration/schemaAmericano'
import { POSITION_OPTIONS } from '@/features/registration/schema'
import { useSubmitAmericanoRegistration } from '@/features/registration/useSubmitAmericano'
import { Field, inputCls } from './fields'
import { pmLabel, longDate } from '@/lib/format'
import { Icon } from '@/components/ui/Icon'
import { Loader } from '@/components/ui/Loader'
import { ShirtSizePicker } from '@/components/ui/ShirtSizePicker'
import type { ShirtSize } from '@/lib/shirtSize'

type FieldErrors = Partial<
  Record<
    'fullName' | 'phone' | 'categoryCode' | 'position' | 'shirtSize' | 'birthdate' | 'blockedSlots' | 'comment',
    string
  >
>

// Inscripción pública de una liga formato AMERICANO (individual, pareja
// rotativa): /registro/:leagueSlug. Campos calcados del formulario real de la
// 5a edición + comprobante de pago (plan §4.6). Aislada del shell, con el
// tema de la liga ([data-league]).
export function RegisterAmericanoPage() {
  const { leagueSlug } = useParams<{ leagueSlug: string }>()
  const seasonQ = useLeagueOpenSeason(leagueSlug)
  const season = seasonQ.data
  const categoriesQ = useSeasonCategories(season?.id)
  const blocksQ = useSeasonTimeBlocks(season?.id)
  // El cupo se cuenta por PAGOS confirmados (0056), no por aprobaciones.
  const countQ = useSeasonPaidCount(season?.id)
  const submit = useSubmitAmericanoRegistration(season?.id)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [categoryCode, setCategoryCode] = useState('')
  const [position, setPosition] = useState('')
  const [shirtSize, setShirtSize] = useState<ShirtSize | ''>('')
  const [birthdate, setBirthdate] = useState('')
  const [blockedSlots, setBlockedSlots] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [discountFile, setDiscountFile] = useState<File | null>(null)
  const [website, setWebsite] = useState('') // honeypot
  const [errors, setErrors] = useState<FieldErrors>({})
  const [done, setDone] = useState(false)

  // Precarga para quien ya tiene cuenta (0055): sus datos de la ficha llegan
  // ya puestos (editables) en vez de teclearlos otra vez. Cada campo solo se
  // rellena si sigue vacío; la categoría espera a que cargue el catálogo de
  // la edición y solo aplica si es una de las que aquí se juegan.
  const { session } = useAuth()
  const prefill = useMyPlayerPrefill(Boolean(session))
  const prefillDone = useRef(false)
  const prefillCatDone = useRef(false)
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null)

  const categories = useMemo(
    () => (categoriesQ.data ?? []).filter((c) => c.is_ranking && c.is_active),
    [categoriesQ.data]
  )

  useEffect(() => {
    const d = prefill.data
    if (!d || done) return
    if (!prefillDone.current) {
      prefillDone.current = true
      if (d.full_name) setFullName((v) => v || d.full_name!)
      if (d.phone) setPhone((v) => v || d.phone!)
      if (d.position) setPosition((v) => v || d.position!)
      if (d.shirt_size && (SHIRT_SIZES as readonly string[]).includes(d.shirt_size)) {
        setShirtSize((v) => v || (d.shirt_size as ShirtSize))
      }
      setPrefilledFrom(d.full_name ?? 'tu perfil')
    }
    if (!prefillCatDone.current && categories.length > 0) {
      prefillCatDone.current = true
      if (d.category_code && categories.some((c) => c.code === d.category_code)) {
        setCategoryCode((v) => v || d.category_code!)
      }
    }
  }, [prefill.data, categories, done])
  const blocks = blocksQ.data ?? []
  const remaining =
    season?.max_players != null && countQ.data != null
      ? Math.max(season.max_players - countQ.data, 0)
      : null

  function toggleSlot(label: string) {
    setBlockedSlots((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    )
  }

  function reset() {
    setFullName('')
    setPhone('')
    setCategoryCode('')
    setPosition('')
    setShirtSize('')
    setBirthdate('')
    setBlockedSlots([])
    setComment('')
    setReceiptFile(null)
    setDiscountFile(null)
    setWebsite('')
    setErrors({})
    submit.reset()
    setDone(false)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const schema = americanoRegistrationSchema(blocks.map((b) => b.label))
    const parsed = schema.safeParse({
      fullName,
      phone,
      categoryCode,
      position,
      shirtSize,
      birthdate,
      blockedSlots,
      comment,
    })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !next[key as keyof FieldErrors]) {
          next[key as keyof FieldErrors] = issue.message
        }
      }
      setErrors(next)
      return
    }
    setErrors({})
    submit.mutate(
      { ...parsed.data, receiptFile, discountFile, website },
      { onSuccess: () => setDone(true) }
    )
  }

  if (seasonQ.isLoading) {
    return (
      <div data-league={leagueSlug} className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-md px-4 pt-16">
          <Loader label="Cargando…" />
        </div>
      </div>
    )
  }

  if (!season || season.league.kind !== 'americano') {
    return (
      <div data-league={leagueSlug} className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-md px-4 pb-12 pt-16">
          <div className="rounded-3xl bg-slate-100 p-6 text-center shadow-md">
            <h1 className="font-heading text-xl text-slate-900">Inscripción no disponible</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Esta liga no tiene inscripciones abiertas por ahora. Consulta los avisos
              o escribe a la organizadora.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const league = season.league

  return (
    <div data-league={league.slug} className="min-h-full bg-slate-50">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-12 pt-safe">
        <header className="pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">
            {league.name}
          </p>
        </header>

        <main className="rise flex-1 pt-3">
          {done ? (
            <SuccessCard onAgain={reset} />
          ) : (
            <>
              <section className="mb-5">
                <h1 className="font-heading text-2xl tracking-tight text-slate-900">
                  Inscríbete · {season.name}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {season.start_date && season.end_date
                    ? `8 jornadas, todos los lunes: del ${longDate(season.start_date)} al ${longDate(season.end_date)}. `
                    : ''}
                  Juegas individual, con pareja distinta cada jornada; a la fase final
                  se llega con pareja fija según resultados.
                </p>
                {season.max_players != null && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-3 py-1 text-xs font-medium text-brand-200 ring-1 ring-brand-500/30">
                    <Icon name="account" size={12} />
                    Cupo: {season.max_players} jugadoras
                    {remaining != null && ` · quedan ${remaining} lugares`}
                  </p>
                )}
              </section>

              {prefilledFrom && (
                <p className="mb-4 flex items-center gap-2 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3 text-sm text-brand-200">
                  <Icon name="account" size={16} />
                  <span>
                    Precargamos tus datos de tu perfil ({prefilledFrom}). Revísalos y
                    edita lo que haga falta.
                  </span>
                </p>
              )}

              {remaining === 0 && (
                <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/15 p-3 text-sm text-amber-200">
                  El cupo está lleno. Puedes inscribirte de todos modos: quedarás en
                  lista de espera y el comité te avisará si se libera un lugar.
                </p>
              )}

              {!isSupabaseConfigured && (
                <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/15 p-3 text-sm text-amber-200">
                  Falta configurar Supabase (.env). El formulario no podrá enviarse aún.
                </p>
              )}

              <form onSubmit={onSubmit} className="space-y-4 rounded-3xl bg-slate-100 p-5 shadow-md">
                {submit.isError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {(submit.error as Error).message}
                  </p>
                )}

                <Field
                  label="Nombre y primer apellido"
                  error={errors.fullName}
                  hint="Así aparecerás en la app y el rol."
                >
                  <input
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ana Gómez"
                    className={inputCls(errors.fullName)}
                  />
                </Field>

                <Field
                  label="Teléfono"
                  error={errors.phone}
                  hint="Privado. Servirá para verificar tu identidad cuando entres a la app."
                  hintIcon="lock"
                >
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="614 123 4567"
                    className={inputCls(errors.phone)}
                  />
                </Field>

                <Field label="Fecha de nacimiento" error={errors.birthdate}>
                  <input
                    type="date"
                    value={birthdate}
                    min="1920-01-01"
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setBirthdate(e.target.value)}
                    className={inputCls(errors.birthdate)}
                  />
                </Field>

                <Field
                  label="Categoría que solicitas"
                  error={errors.categoryCode}
                  hint="Sujeta a revisión del comité."
                  hintIcon="medal"
                >
                  <select
                    value={categoryCode}
                    onChange={(e) => setCategoryCode(e.target.value)}
                    disabled={categoriesQ.isLoading}
                    className={inputCls(errors.categoryCode)}
                  >
                    <option value="" disabled>
                      {categoriesQ.isLoading ? 'Cargando categorías…' : 'Elige tu categoría'}
                    </option>
                    {categories.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <div>
                  <span className="block text-sm font-medium text-slate-700">Posición de juego</span>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {POSITION_OPTIONS.map((p) => {
                      const active = position === p.value
                      return (
                        <button
                          key={p.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setPosition(p.value)}
                          className={
                            active
                              ? 'neu-pressed rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-300'
                              : 'neu-raised rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700'
                          }
                        >
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                  {errors.position && <p className="mt-1 text-xs text-red-600">{errors.position}</p>}
                </div>

                <div>
                  <span className="block text-sm font-medium text-slate-700">
                    Horarios que prefieres NO jugar
                  </span>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Opcional, máximo {MAX_BLOCKED_SLOTS}. Menos horarios disponibles limita
                    compañeras y rivales.
                  </p>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {blocks.map((b) => {
                      const active = blockedSlots.includes(b.label)
                      const full = !active && blockedSlots.length >= MAX_BLOCKED_SLOTS
                      return (
                        <button
                          key={b.id}
                          type="button"
                          aria-pressed={active}
                          disabled={full}
                          onClick={() => toggleSlot(b.label)}
                          className={
                            active
                              ? 'neu-pressed rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-300'
                              : 'neu-raised rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-40'
                          }
                        >
                          {pmLabel(b.label)}
                        </button>
                      )
                    })}
                  </div>
                  {errors.blockedSlots && (
                    <p className="mt-1 text-xs text-red-600">{errors.blockedSlots}</p>
                  )}
                </div>

                <div>
                  <span className="block text-sm font-medium text-slate-700">Talla de playera</span>
                  <div className="mt-1.5">
                    <ShirtSizePicker value={shirtSize || null} onChange={(s) => setShirtSize(s)} />
                  </div>
                  {errors.shirtSize && <p className="mt-1 text-xs text-red-600">{errors.shirtSize}</p>}
                </div>

                <Field label="Comentario (opcional)" error={errors.comment}>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Algo que el comité deba saber"
                    className={inputCls(errors.comment)}
                  />
                </Field>

                {season.payment_instructions && (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">Pago de inscripción</p>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-500">
                      {linkify(season.payment_instructions)}
                    </p>
                    <label className="neu-raised mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700">
                      <Icon name="plus" size={16} />
                      <span className="min-w-0 truncate">
                        {receiptFile ? receiptFile.name : 'Subir comprobante de pago'}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                        className="hidden"
                        onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <label className="neu-raised mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700">
                      <Icon name="medal" size={16} />
                      <span className="min-w-0 truncate">
                        {discountFile
                          ? discountFile.name
                          : 'Comprobante torneo Peak Padel (descuento $250)'}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                        className="hidden"
                        onChange={(e) => setDiscountFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <p className="mt-1.5 text-center text-[11px] text-slate-500">
                      Ambos opcionales al enviar · imagen o PDF, máx. 5 MB. Tu lugar se
                      aparta cuando el comité confirma tu pago.
                    </p>
                  </div>
                )}

                {/* Honeypot anti-bot: oculto para humanos, tentador para bots. */}
                <div aria-hidden className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden">
                  <label>
                    No llenar
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submit.isPending || !isSupabaseConfigured}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-300 px-4 py-3.5 font-semibold text-[#1a1405] shadow-sm disabled:opacity-50"
                >
                  {submit.isPending ? 'Enviando…' : 'Enviar inscripción'}
                  {!submit.isPending && <Icon name="chevron-right" size={18} />}
                </button>
              </form>
            </>
          )}
        </main>

        <footer className="pt-6 text-center text-xs text-slate-600">{league.name}</footer>
      </div>
    </div>
  )
}

// URLs del texto de pago como enlaces reales (el texto vive en la base,
// seasons.payment_instructions, y se edita sin deploy).
function linkify(text: string): React.ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-sky-300 underline"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

function SuccessCard({ onAgain }: { onAgain: () => void }) {
  return (
    <div className="rounded-3xl bg-slate-100 p-6 text-center shadow-md">
      <span className="neu-raised mx-auto flex h-16 w-16 items-center justify-center rounded-full text-brand-300">
        <Icon name="check" size={32} />
      </span>
      <h1 className="mt-4 font-heading text-xl text-slate-900">¡Listo! Recibimos tu inscripción</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        El comité revisará tu categoría y confirmará tu lugar. Te contactaremos por
        teléfono si hace falta algo más.
      </p>
      <button
        onClick={onAgain}
        className="neu-raised mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700"
      >
        <Icon name="plus" size={16} /> Inscribir a otra persona
      </button>
    </div>
  )
}
