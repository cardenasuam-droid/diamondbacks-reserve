// Verificación de conexión + esquema usando el mismo cliente que la app.
// Lee las claves de .env. Uso: node scripts/check-db.mjs
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

const expected = {
  match_categories: 9,
  category_eligibility_rules: 11,
  time_blocks: 3,
  courts: 9,
  seasons: 0,
  teams: 0,
  players: 0,
  rounds: 0,
  matches: 0,
  match_results: 0,
  // vistas públicas
  players_public: 0,
  team_standings: 0,
  player_rankings: 0,
  head_to_head: 0,
}

let allOk = true
for (const [rel, exp] of Object.entries(expected)) {
  const { count, error } = await supabase.from(rel).select('*', { count: 'exact', head: true })
  if (error) {
    allOk = false
    console.log(`[ERR] ${rel.padEnd(28)} -> ${error.code ?? ''} ${error.message}`)
  } else {
    const ok = count === exp
    if (!ok) allOk = false
    console.log(`[${ok ? 'OK ' : '!! '}] ${rel.padEnd(28)} = ${count}  (esperado ${exp})`)
  }
}
console.log(allOk ? '\nTODO CORRECTO ✅' : '\nHay diferencias ⚠️')
