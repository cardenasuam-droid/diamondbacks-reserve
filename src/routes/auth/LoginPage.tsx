import { useMemo, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/features/auth/context'
import { roleLabel } from '@/features/auth/roles'
import { emailSchema, passwordSchema, phoneLast4Schema, normalizeEmail } from '@/features/auth/schema'
import { loginPlayer, loginStaff, playerHasAccount, registerPlayer } from '@/features/auth/playerAuth'
import { loginStaffMember, registerStaffMember, staffHasAccount } from '@/features/auth/staffAuth'
import { useStaffPublic } from '@/features/auth/useStaffPublic'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { useTeams } from '@/features/teams/useTeams'
import { teamColor } from '@/lib/color'
import { Loader } from '@/components/ui/Loader'

interface Identity {
  id: string
  kind: 'player' | 'staff'
  name: string
  sublabel: string
  color: string | null
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'

  const [mode, setMode] = useState<'list' | 'email'>('list')

  if (session) {
    navigate(from, { replace: true })
    return null
  }
  const onDone = () => navigate(from, { replace: true })

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold">Entrar</h1>
        <p className="mt-1 text-sm text-slate-600">
          {mode === 'list'
            ? 'Elige tu nombre y usa tu contraseña.'
            : 'Acceso por correo (respaldo).'}
        </p>
      </div>

      {!isSupabaseConfigured && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Falta configurar Supabase (.env). El login no funcionará hasta entonces.
        </p>
      )}

      {mode === 'list' ? <IdentityLogin onDone={onDone} /> : <EmailLogin onDone={onDone} />}

      <div className="text-center text-sm">
        {mode === 'list' ? (
          <button onClick={() => setMode('email')} className="text-slate-400 underline">
            Acceso por correo
          </button>
        ) : (
          <button onClick={() => setMode('list')} className="text-slate-500 underline">
            Volver a elegir nombre
          </button>
        )}
      </div>

      <p className="text-center text-sm">
        <Link to="/" className="text-slate-500 underline">
          Volver al inicio
        </Link>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Selector unificado: jugadores (roster) + staff (lista semilla).
// ---------------------------------------------------------------------------
function IdentityLogin({ onDone }: { onDone: () => void }) {
  const season = useActiveSeason()
  const players = usePublicPlayers(season.data?.id)
  const teams = useTeams(season.data?.id)
  const staff = useStaffPublic()

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Identity | null>(null)
  const [hasAccount, setHasAccount] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const identities = useMemo<Identity[]>(() => {
    const teamById = new Map((teams.data ?? []).map((t) => [t.id, t]))
    const list: Identity[] = []
    for (const p of players.data ?? []) {
      const t = teamById.get(p.team_id)
      list.push({ id: p.id, kind: 'player', name: p.full_name, sublabel: t?.name ?? '', color: t?.color ?? null })
    }
    for (const s of staff.data ?? []) {
      list.push({ id: s.id, kind: 'staff', name: s.full_name, sublabel: roleLabel(s.role), color: null })
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [players.data, teams.data, staff.data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? identities.filter((i) => i.name.toLowerCase().includes(q)) : identities).slice(0, 40)
  }, [identities, query])

  async function pick(identity: Identity) {
    setSelected(identity)
    setError(null)
    setHasAccount(null)
    setChecking(true)
    try {
      const exists =
        identity.kind === 'player'
          ? await playerHasAccount(identity.id)
          : await staffHasAccount(identity.id)
      setHasAccount(exists)
    } catch {
      setError('No se pudo comprobar la cuenta. Inténtalo de nuevo.')
    } finally {
      setChecking(false)
    }
  }

  // El staff es opcional: no bloqueamos el selector si su lista aún carga/falla
  // (p. ej. antes de aplicar la migración 0009).
  if (season.isLoading || players.isLoading) {
    return <Loader label="Cargando…" />
  }

  if (identities.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Aún no hay nombres cargados. Si eres staff, usa "Acceso por correo" (abajo).
      </p>
    )
  }

  if (!selected) {
    return (
      <div className="space-y-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca tu nombre…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        />
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {filtered.map((i) => (
            <li key={`${i.kind}-${i.id}`}>
              <button
                onClick={() => pick(i)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
              >
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5"
                  style={{ backgroundColor: teamColor(i.color) }}
                  aria-hidden
                />
                <span className="flex-1 truncate font-medium text-slate-800">{i.name}</span>
                <span className="truncate text-xs text-slate-400">{i.sublabel}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-3 text-sm text-slate-500">Sin coincidencias.</li>
          )}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5"
          style={{ backgroundColor: teamColor(selected.color) }}
          aria-hidden
        />
        <span className="flex-1">
          <span className="block font-semibold text-slate-800">{selected.name}</span>
          <span className="block text-xs text-slate-500">{selected.sublabel}</span>
        </span>
        <button
          onClick={() => {
            setSelected(null)
            setHasAccount(null)
            setError(null)
          }}
          className="text-sm text-sky-600 underline"
        >
          Cambiar
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {checking || hasAccount === null ? (
        <Loader label="Comprobando…" />
      ) : hasAccount ? (
        <PasswordLoginForm
          onError={setError}
          onSubmit={(password) =>
            selected.kind === 'player'
              ? loginPlayer({ playerId: selected.id, password })
              : loginStaffMember({ staffId: selected.id, password })
          }
          onDone={onDone}
        />
      ) : selected.kind === 'player' ? (
        <VerifyRegisterForm
          hint="Es tu primera vez: confirma tu identidad con los últimos 4 dígitos de tu teléfono y crea una contraseña."
          verifyLabel="Últimos 4 dígitos de tu teléfono"
          numeric
          maxLength={4}
          placeholder="1234"
          validateVerify={(v) => (phoneLast4Schema.safeParse(v).success ? null : 'Escribe los últimos 4 dígitos.')}
          onRegister={(verify, password) =>
            registerPlayer({ playerId: selected.id, phoneLast4: verify, password, fullName: selected.name })
          }
          onError={setError}
          onDone={onDone}
        />
      ) : (
        <VerifyRegisterForm
          hint="Primer acceso de staff: escribe tu código de acceso y crea una contraseña."
          verifyLabel="Código de acceso"
          placeholder="Tu código"
          validateVerify={(v) => (v.trim() ? null : 'Escribe tu código de acceso.')}
          onRegister={(verify, password) =>
            registerStaffMember({ staffId: selected.id, code: verify, password, fullName: selected.name })
          }
          onError={setError}
          onDone={onDone}
        />
      )}
    </div>
  )
}

function PasswordLoginForm({
  onSubmit,
  onDone,
  onError,
}: {
  onSubmit: (password: string) => Promise<void>
  onDone: () => void
  onError: (m: string | null) => void
}) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    onError(null)
    setLoading(true)
    try {
      await onSubmit(password)
      onDone()
    } catch (err) {
      onError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Tu contraseña">
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        />
      </Field>
      <SubmitButton loading={loading} label="Entrar" />
    </form>
  )
}

function VerifyRegisterForm({
  hint,
  verifyLabel,
  placeholder,
  numeric,
  maxLength,
  validateVerify,
  onRegister,
  onDone,
  onError,
}: {
  hint: string
  verifyLabel: string
  placeholder?: string
  numeric?: boolean
  maxLength?: number
  validateVerify: (v: string) => string | null
  onRegister: (verify: string, password: string) => Promise<void>
  onDone: () => void
  onError: (m: string | null) => void
}) {
  const [verify, setVerify] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    onError(null)
    const vErr = validateVerify(verify)
    if (vErr) return onError(vErr)
    const pw = passwordSchema.safeParse(password)
    if (!pw.success) return onError(pw.error.issues[0]?.message ?? 'Contraseña no válida')
    if (password !== password2) return onError('Las contraseñas no coinciden.')

    setLoading(true)
    try {
      await onRegister(verify, password)
      onDone()
    } catch (err) {
      onError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">{hint}</p>
      <Field label={verifyLabel}>
        <input
          inputMode={numeric ? 'numeric' : undefined}
          autoFocus
          maxLength={maxLength}
          value={verify}
          onChange={(e) => setVerify(numeric ? e.target.value.replace(/\D/g, '') : e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        />
      </Field>
      <Field label="Crea una contraseña">
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        />
      </Field>
      <Field label="Repite la contraseña">
        <input
          type="password"
          autoComplete="new-password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        />
      </Field>
      <SubmitButton loading={loading} label="Crear cuenta y entrar" />
    </form>
  )
}

function EmailLogin({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Correo no válido')
    setLoading(true)
    try {
      await loginStaff({ email: normalizeEmail(parsed.data), password })
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <Field label="Correo">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        />
      </Field>
      <Field label="Contraseña">
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        />
      </Field>
      <SubmitButton loading={loading} label="Entrar" />
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white disabled:opacity-50"
    >
      {loading ? 'Un momento…' : label}
    </button>
  )
}
