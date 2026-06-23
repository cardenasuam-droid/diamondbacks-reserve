// Diagnóstico de la cuenta "Bruja" con la clave anon (solo lecturas públicas).
// Confirma: ¿está en staff_public? ¿en players_public? ¿staff_has_account la ve?
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

const { data: staff, error: se } = await supabase.from('staff_public').select('*')
console.log('staff_public:', se ? `ERROR ${se.message}` : JSON.stringify(staff))

const brujaStaff = (staff ?? []).filter((s) => s.full_name?.trim().toLowerCase() === 'bruja')
for (const s of brujaStaff) {
  const { data, error } = await supabase.rpc('staff_has_account', { p_staff_id: s.id })
  console.log(`  staff "Bruja" id=${s.id} role=${s.role} -> staff_has_account=${error ? `ERR ${error.message}` : data}`)
}

const { data: players, error: pe } = await supabase.from('players_public').select('id, full_name')
const brujaPlayers = (players ?? []).filter((p) => p.full_name?.trim().toLowerCase() === 'bruja')
console.log('players llamados Bruja:', pe ? `ERROR ${pe.message}` : JSON.stringify(brujaPlayers))
for (const p of brujaPlayers) {
  const { data, error } = await supabase.rpc('player_has_account', { p_player_id: p.id })
  console.log(`  player "Bruja" id=${p.id} -> player_has_account=${error ? `ERR ${error.message}` : data}`)
}
