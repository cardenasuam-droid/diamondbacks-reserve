// Sonda de validación de email de Supabase Auth SIN crear usuarios.
// signInWithPassword valida el formato del email primero:
//   "Email address ... is invalid"  -> dominio/format RECHAZADO
//   "Invalid login credentials"      -> formato OK (solo no existe la cuenta)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const domains = [
  'staff.diamondbackspadel.org',
  'diamondbackspadel.org',
  'players.local',
  'example.com',
  'gmail.com',
  'staff.app',
  'liga.dev',
]

for (const d of domains) {
  const { error } = await supabase.auth.signInWithPassword({
    email: `probe-xyz@${d}`,
    password: 'placeholder-123456',
  })
  const msg = error?.message ?? 'NO ERROR'
  const verdict = /invalid login credentials/i.test(msg)
    ? 'FORMATO OK'
    : /invalid/i.test(msg)
      ? 'RECHAZADO'
      : msg
  console.log(`${d.padEnd(32)} -> ${verdict}   (${msg})`)
}
