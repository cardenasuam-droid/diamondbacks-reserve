// Prueba qué dominios acepta el SIGNUP de Supabase. Los rechazados NO crean
// usuario (la validación ocurre antes). Se detiene en el primer aceptado para
// minimizar usuarios de prueba creados.
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
  'staff.app',
  'example.com',
  'gmail.com',
]

for (const d of domains) {
  const email = `liga-probe@${d}`
  const { data, error } = await supabase.auth.signUp({ email, password: 'Probe-123456' })
  if (error) {
    console.log(`RECHAZADO  ${email}  ->  [${error.status}] ${error.message}`)
  } else {
    console.log(`ACEPTADO   ${email}  ->  user=${data.user?.id ?? 'none'} (BORRAR este usuario de prueba)`)
    break
  }
}
