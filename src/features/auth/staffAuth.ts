import { supabase } from '@/lib/supabase'

// Email sintético del staff, derivado del staff_member.id público. Debe coincidir
// con lo que espera el trigger handle_new_user (0009).
// TLD real: Supabase Auth rechaza `.local`. No se envía correo (Confirm email OFF).
const STAFF_EMAIL_DOMAIN = 'staff.diamondbackspadel.org'

export function staffAuthEmail(staffId: string): string {
  return `${staffId}@${STAFF_EMAIL_DOMAIN}`
}

export async function staffHasAccount(staffId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('staff_has_account', { p_staff_id: staffId })
  if (error) throw error
  return Boolean(data)
}

const CLAIM_REASON: Record<string, string> = {
  not_found: 'No encontramos ese acceso de staff.',
  already_claimed: 'Este acceso ya tiene cuenta. Inicia sesión con tu contraseña.',
  no_code: 'Este acceso no tiene código configurado. Contacta al administrador.',
  wrong_code: 'Código de acceso incorrecto.',
}

function friendlyAuthError(msg: string): string {
  if (/already registered|already exists/i.test(msg)) {
    return 'Este acceso ya tiene cuenta. Inicia sesión con tu contraseña.'
  }
  if (/database error/i.test(msg)) return 'No se pudo crear la cuenta. Verifica el código.'
  if (/password/i.test(msg)) return 'La contraseña no cumple los requisitos (mínimo 6 caracteres).'
  return msg
}

// Primer acceso de un staff: verifica el código y crea la cuenta. El trigger
// 0009 re-verifica como candado.
export async function registerStaffMember(opts: {
  staffId: string
  code: string
  password: string
  fullName: string
}): Promise<void> {
  const { data, error } = await supabase.rpc('verify_staff_claim', {
    p_staff_id: opts.staffId,
    p_code: opts.code,
  })
  if (error) throw new Error('No se pudo verificar. Inténtalo de nuevo.')
  const res = data as { ok: boolean; reason: string }
  if (!res.ok) throw new Error(CLAIM_REASON[res.reason] ?? 'No se pudo crear la cuenta.')

  const { error: signErr } = await supabase.auth.signUp({
    email: staffAuthEmail(opts.staffId),
    password: opts.password,
    options: { data: { staff_id: opts.staffId, access_code: opts.code, full_name: opts.fullName } },
  })
  if (signErr) throw new Error(friendlyAuthError(signErr.message))
}

export async function loginStaffMember(opts: { staffId: string; password: string }): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: staffAuthEmail(opts.staffId),
    password: opts.password,
  })
  if (error) throw new Error('Contraseña incorrecta. Inténtalo de nuevo.')
}
