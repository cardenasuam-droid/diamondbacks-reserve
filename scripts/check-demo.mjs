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

async function count(rel) {
  const { count, error } = await supabase.from(rel).select('*', { count: 'exact', head: true })
  return error ? `ERR ${error.message}` : count
}

console.log('seasons          =', await count('seasons'))
console.log('teams            =', await count('teams'))
console.log('players_public   =', await count('players_public'))
console.log('matches          =', await count('matches'))
console.log('match_results    =', await count('match_results'))
console.log('team_standings   =', await count('team_standings'))

// Tabla de posiciones ordenada como la verá el público
const { data: season } = await supabase.from('seasons').select('*').eq('status', 'active').single()
const { data: rows } = await supabase
  .from('team_standings')
  .select('team_name,played,won,points,set_diff,game_diff')
  .eq('season_id', season.id)
  .order('points', { ascending: false })
console.log(`\nTabla "${season.name}":`)
for (const t of rows ?? []) {
  console.log(
    `  ${t.team_name.padEnd(11)} PJ ${t.played}  PG ${t.won}  DS ${t.set_diff >= 0 ? '+' : ''}${t.set_diff}  Pts ${t.points}`,
  )
}
