import { supabase } from '@/lib/supabase'

// El email de Supabase Auth es sintético, derivado del player_id público. El
// jugador nunca lo ve ni lo escribe. Debe coincidir con lo que espera el trigger
// handle_new_user (0008).
// TLD real: Supabase Auth rechaza dominios reservados como `.local`. No se
// envía correo a esta dirección (Confirm email OFF); es solo un identificador.
const PLAYER_EMAIL_DOMAIN = 'players.diamondbackspadel.org'

export function playerAuthEmail(playerId: string): string {
  return `${playerId}@${PLAYER_EMAIL_DOMAIN}`
}

/** ¿Este email es el sintético de un jugador? (para no mostrarlo en la UI). */
export function isPlayerAuthEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.endsWith(`@${PLAYER_EMAIL_DOMAIN}`))
}

/** ¿Es un email sintético (jugador o staff)? La UI muestra el nombre, no esto. */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  return Boolean(email && /@(players|staff)\.diamondbackspadel\.org$/.test(email))
}

export async function playerHasAccount(playerId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('player_has_account', { p_player_id: playerId })
  if (error) throw error
  return Boolean(data)
}

const CLAIM_REASON: Record<string, string> = {
  not_found: 'No encontramos a ese jugador.',
  already_claimed: 'Este jugador ya tiene cuenta. Inicia sesión con tu contraseña.',
  no_phone: 'Este jugador no tiene teléfono registrado. Pide acceso al organizador.',
  wrong_phone: 'Los últimos 4 dígitos del teléfono no coinciden.',
  rate_limited: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
}

function friendlyAuthError(msg: string): string {
  if (/already registered|already exists/i.test(msg)) {
    return 'Este jugador ya tiene cuenta. Inicia sesión con tu contraseña.'
  }
  if (/database error/i.test(msg)) return 'No se pudo crear la cuenta. Verifica tus datos.'
  if (/password/i.test(msg)) return 'La contraseña no cumple los requisitos (mínimo 6 caracteres).'
  return msg
}

// Primer registro de un jugador: verifica el teléfono (mensaje claro) y crea la
// cuenta. El trigger 0008 re-verifica como candado de seguridad.
export async function registerPlayer(opts: {
  playerId: string
  phoneLast4: string
  password: string
  fullName: string
}): Promise<void> {
  const { data, error } = await supabase.rpc('verify_player_claim', {
    p_player_id: opts.playerId,
    p_phone_last4: opts.phoneLast4,
  })
  if (error) throw new Error('No se pudo verificar. Inténtalo de nuevo.')
  const res = data as { ok: boolean; reason: string }
  if (!res.ok) throw new Error(CLAIM_REASON[res.reason] ?? 'No se pudo crear la cuenta.')

  const { error: signErr } = await supabase.auth.signUp({
    email: playerAuthEmail(opts.playerId),
    password: opts.password,
    options: {
      data: { player_id: opts.playerId, phone_last4: opts.phoneLast4, full_name: opts.fullName },
    },
  })
  if (signErr) throw new Error(friendlyAuthError(signErr.message))
}

export async function loginPlayer(opts: { playerId: string; password: string }): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: playerAuthEmail(opts.playerId),
    password: opts.password,
  })
  if (error) throw new Error('Contraseña incorrecta. Inténtalo de nuevo.')
}

export async function loginStaff(opts: { email: string; password: string }): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: opts.email,
    password: opts.password,
  })
  if (error) throw new Error('Correo o contraseña incorrectos.')
}
