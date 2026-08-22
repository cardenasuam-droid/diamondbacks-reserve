import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Desglose por equipo de UN partido, leído de la vista per_team_match (0003).
//
// A propósito NO se recalcula nada en el cliente: esa vista es la única fuente
// de verdad de puntos/sets/juegos (CLAUDE.md §3.4) y es exactamente la que
// alimenta la tabla de posiciones y el ranking. Leerla aquí garantiza que la
// pantalla del partido muestra LOS MISMOS números que suma la tabla — incluido
// el walkover, que la vista sintetiza como 2-0 en sets, 12-0 en juegos y 3/0
// puntos aunque los sets guardados estén en NULL.
//
// Devuelve 0 filas si el resultado no es oficial (la vista filtra
// validated/walkover/corrected), y 2 filas (una por equipo) cuando lo es.
export interface MatchTeamStats {
  team_id: string
  won: boolean
  sets_won: number
  sets_lost: number
  games_won: number
  games_lost: number
  points: number
}

async function fetchMatchTeamStats(matchId: string): Promise<Map<string, MatchTeamStats>> {
  const { data, error } = await supabase
    .from('per_team_match')
    .select('team_id, won, sets_won, sets_lost, games_won, games_lost, points')
    .eq('match_id', matchId)
  if (error) throw error

  const out = new Map<string, MatchTeamStats>()
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    // Los agregados de la vista pueden llegar serializados como string
    // (bigint/numeric de Postgres): se coercionan igual que usePlayerRankings.
    out.set(String(r.team_id), {
      team_id: String(r.team_id),
      won: Boolean(r.won),
      sets_won: Number(r.sets_won),
      sets_lost: Number(r.sets_lost),
      games_won: Number(r.games_won),
      games_lost: Number(r.games_lost),
      points: Number(r.points),
    })
  }
  return out
}

export function useMatchTeamStats(matchId: string | undefined) {
  return useQuery({
    queryKey: ['match-team-stats', matchId],
    queryFn: () => fetchMatchTeamStats(matchId as string),
    enabled: Boolean(matchId),
  })
}
