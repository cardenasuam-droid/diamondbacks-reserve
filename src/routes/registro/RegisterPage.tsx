import { useMemo, useState } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useCategories } from '@/features/categories/useCategories'
import { rankingCategories } from '@/features/registration/category'
import { registrationSchema, POSITION_OPTIONS } from '@/features/registration/schema'
import { useSubmitRegistration } from '@/features/registration/useSubmitRegistration'
import { Brand } from '@/components/ui/Brand'
import { Icon } from '@/components/ui/Icon'

type FieldErrors = Partial<Record<'fullName' | 'phone' | 'categoryCode' | 'position' | 'comment', string>>

// Página de inscripción PÚBLICA y AISLADA (ruta /registro, fuera del shell con
// menú y de /app). Quien entra solo ve este formulario: no hay forma de navegar
// a la app. Escribe en la bandeja player_registrations; el comité revisa después.
export function RegisterPage() {
  const season = useActiveSeason()
  const categories = useCategories()
  const submit = useSubmitRegistration(season.data?.id)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [categoryCode, setCategoryCode] = useState('')
  const [position, setPosition] = useState('')
  const [comment, setComment] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [errors, setErrors] = useState<FieldErrors>({})
  const [done, setDone] = useState(false)

  const ranking = useMemo(() => rankingCategories(categories.data ?? []), [categories.data])

  function reset() {
    setFullName('')
    setPhone('')
    setCategoryCode('')
    setPosition('')
    setComment('')
    setWebsite('')
    setErrors({})
    submit.reset()
    setDone(false)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = registrationSchema.safeParse({
      fullName,
      phone,
      categoryCode,
      position,
      comment: comment.trim() || undefined,
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
    submit.mutate({ ...parsed.data, website }, { onSuccess: () => setDone(true) })
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-12 pt-safe">
        <header className="flex items-center justify-between py-4">
          <Brand />
          <span className="text-xs font-medium tracking-wide text-slate-500">Inscripción</span>
        </header>

        <main className="rise flex-1">
          {done ? (
            <SuccessCard seasonName={season.data?.name} onAgain={reset} />
          ) : (
            <>
              <section className="mb-5">
                {season.data?.name && (
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-300">
                    {season.data.name}
                  </p>
                )}
                <h1 className="mt-1 font-heading text-2xl tracking-tight text-slate-900">
                  Inscríbete a la liga
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Ingresa tus datos para inscribirte; tu equipo será asignado el día del Draft.
                </p>
              </section>

              {!isSupabaseConfigured && (
                <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/15 p-3 text-sm text-amber-200">
                  Falta configurar Supabase (.env). El formulario no podrá enviarse aún.
                </p>
              )}

              <form
                onSubmit={onSubmit}
                className="space-y-4 rounded-3xl bg-slate-50 p-5 shadow-md"
              >
                {submit.isError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {(submit.error as Error).message}
                  </p>
                )}

                <Field label="Nombre completo" error={errors.fullName}>
                  <input
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ana Gómez Ruiz"
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
                    placeholder="55 1234 5678"
                    className={inputCls(errors.phone)}
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
                    disabled={categories.isLoading}
                    className={inputCls(errors.categoryCode)}
                  >
                    <option value="" disabled>
                      {categories.isLoading ? 'Cargando categorías…' : 'Elige una categoría'}
                    </option>
                    {ranking.map((c) => (
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

                <Field label="Comentario (opcional)" error={errors.comment}>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="¿Con quién te gustaría jugar? ¿Disponibilidad?"
                    className={inputCls(errors.comment)}
                  />
                </Field>

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

        <footer className="pt-6 text-center text-xs text-slate-600">
          Diamondbacks Reserve{season.data?.name ? ` · ${season.data.name}` : ''}
        </footer>
      </div>
    </div>
  )
}

function SuccessCard({ seasonName, onAgain }: { seasonName?: string; onAgain: () => void }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-6 text-center shadow-md">
      <span className="neu-raised mx-auto flex h-16 w-16 items-center justify-center rounded-full text-brand-300">
        <Icon name="check" size={32} />
      </span>
      <h1 className="mt-4 font-heading text-xl text-slate-900">¡Listo! Recibimos tu inscripción</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        El comité revisará tu categoría y te avisará cuando tengas equipo asignado
        {seasonName ? ` para ${seasonName}` : ''}.
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

function inputCls(error?: string): string {
  // El relieve "inset" (pozo) lo da la regla global de inputs en index.css; aquí
  // solo el layout, la tinta nítida y el aro de error.
  const base = 'mt-1 w-full rounded-xl px-3 py-2.5 text-base text-slate-900'
  return error ? `${base} ring-2 ring-red-500/70` : base
}

function Field({
  label,
  error,
  hint,
  hintIcon,
  children,
}: {
  label: string
  error?: string
  hint?: string
  hintIcon?: 'lock' | 'medal'
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          {hintIcon && <Icon name={hintIcon} size={12} />}
          {hint}
        </span>
      ) : null}
    </label>
  )
}
