// Diagnóstico de acceso: ¿qué nombres puede ver el selector de login?
// Usa el cliente anónimo (lo mismo que el navegador). Lee players_public,
// staff_public y la temporada activa.
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

const { data: seasons } = await supabase.from('seasons').select('id, name, status')
const active = (seasons ?? []).find((s) => s.status === 'active') ?? (seasons ?? [])[0]
console.log('Temporada activa:', active?.name ?? '(ninguna)')

const players = await supabase.from('players_public').select('full_name').eq('season_id', active?.id ?? '')
console.log('players_public (temporada):', players.error ? `ERROR ${players.error.message}` : players.data.length)

const staff = await supabase.from('staff_public').select('id, full_name, role')
if (staff.error) {
  console.log('staff_public: ERROR ->', staff.error.message, '(¿falta aplicar 0009?)')
} else {
  console.log('staff_public:', staff.data.length, 'filas')
  for (const s of staff.data) console.log('   -', s.full_name, '(' + s.role + ')')
}

const allPlayers = await supabase.from('players_public').select('full_name')
const bruja = (allPlayers.data ?? []).some((p) => /bruja/i.test(p.full_name)) ||
  (staff.data ?? []).some((s) => /bruja/i.test(s.full_name))
console.log('¿Existe alguien llamado "Bruja"?:', bruja ? 'SÍ' : 'NO')
