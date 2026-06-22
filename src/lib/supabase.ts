import { createClient } from '@supabase/supabase-js'

// Cliente único de Supabase para todo el frontend.
// Las claves vienen de .env (ver .env.example). La service_role JAMÁS aquí.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** true cuando .env tiene URL + anon key. La UI lo usa para avisar si falta config. */
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured && import.meta.env.DEV && import.meta.env.MODE !== 'test') {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env y rellena los valores de tu proyecto.',
  )
}

// Placeholders válidos para que la app y los tests arranquen sin .env: createClient
// exige una URL bien formada. Sin red real hasta que se configuren las claves.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      // OTP por email; la sesión persiste hasta cerrar sesión (CLAUDE.md §3.3).
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
