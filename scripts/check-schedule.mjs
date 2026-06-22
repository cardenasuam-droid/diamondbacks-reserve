import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const { data: season } = await supabase.from('seasons').select('id,name').eq('status', 'active').single()
const { data: rounds } = await supabase
  .from('rounds').select('id,round_number,name,round_date,status')
  .eq('season_id', season.id).order('round_number')
console.log('Temporada:', season.name, '· jornadas:', rounds.map((r) => `${r.round_number}(${r.status})`).join(', '))

const round = rounds[0]
const { data: matches, error } = await supabase
  .from('matches')
  .select(`
    id, scheduled_at, status, category_code,
    time_block:time_blocks(label, sort_order),
    court:courts(name, number),
    category:match_categories(name, type, sort_order),
    matchup:team_matchups(
      id,
      team_a:teams!team_a_id(id, name, color),
      team_b:teams!team_b_id(id, name, color)
    ),
    result:match_results(status, set1_team_a, set1_team_b, set2_team_a, set2_team_b, set3_team_a, set3_team_b, winner_team_id, is_walkover)
  `)
  .eq('round_id', round.id)

if (error) { console.log('ERROR embed:', error.message); process.exit(1) }
console.log(`\nJornada ${round.round_number}: ${matches.length} partidos`)
const sample = matches[0]
console.log('Ejemplo:', JSON.stringify(sample, null, 2))

// agrupar por enfrentamiento
const byMu = new Map()
for (const m of matches) {
  const k = m.matchup?.id
  if (!byMu.has(k)) byMu.set(k, [])
  byMu.get(k).push(m)
}
console.log('\nEnfrentamientos:', byMu.size)
for (const [, ms] of byMu) {
  const mu = ms[0].matchup
  console.log(`  ${mu.team_a.name} vs ${mu.team_b.name} — ${ms.length} partidos`)
}
