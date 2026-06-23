// Trae un jugador y un equipo TOP de la demo con TODAS sus columnas de stats,
// para previsualizar el diseño con datos reales (anon, solo lecturas públicas).
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

const { data: teams } = await supabase.from('team_standings').select('*')
const topTeams = (teams ?? []).sort((a, b) => b.points - a.points).slice(0, 1)
console.log('TOP TEAM:\n', JSON.stringify(topTeams[0], null, 2))

const { data: players } = await supabase
  .from('player_rankings')
  .select('*')
  .gt('matches_played', 0)
const topPlayers = (players ?? [])
  .sort((a, b) => b.points_contributed - a.points_contributed)
  .slice(0, 1)
console.log('\nTOP PLAYER:\n', JSON.stringify(topPlayers[0], null, 2))
console.log('\ncounts:', { teams: teams?.length, players: players?.length })
