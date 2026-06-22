// Verifica la consulta de useCaptainMatchup contra la BD demo SIN login:
// team_matchups y rounds publicados son de lectura pública, así que el cliente
// anónimo basta para validar la sintaxis de embeds (!inner), el filtro sobre
// recurso embebido (round.season_id) y el .or() de pertenencia de equipo.
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

const SELECT = `
  id, team_a_id, team_b_id,
  round:rounds!inner(id, round_number, name, round_date, status, season_id),
  team_a:teams!team_a_id(id, name, color),
  team_b:teams!team_b_id(id, name, color),
  matches(id, category_code, scheduled_at, time_block:time_blocks(label, sort_order), court:courts(name, number))
`

const { data: season } = await supabase
  .from('seasons')
  .select('id, name')
  .eq('status', 'active')
  .single()
console.log('Temporada activa:', season?.name)

const { data: teams } = await supabase
  .from('teams')
  .select('id, name')
  .eq('season_id', season.id)
  .limit(1)
const team = teams?.[0]
console.log('Equipo de prueba:', team?.name, `(${team?.id})`)

const { data, error } = await supabase
  .from('team_matchups')
  .select(SELECT)
  .eq('round.season_id', season.id)
  .eq('round.status', 'published')
  .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)

if (error) {
  console.log('ERROR consulta matchup:', error.message)
  process.exit(1)
}

console.log(`\nEnfrentamientos del equipo (${data.length}):`)
for (const m of data) {
  const isA = m.team_a_id === team.id
  const opp = isA ? m.team_b?.name : m.team_a?.name
  console.log(
    `  J${m.round.round_number} vs ${opp} — ${m.matches.length} partidos — round=${m.round.status}`,
  )
}
