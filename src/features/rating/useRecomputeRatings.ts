import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DEFAULT_RATING_SETTINGS, type RatingSettings } from './computeRating'
import { replaySeason, type RatingAdjustment, type RatingMatch } from './replaySeason'

// Recálculo del rating de una temporada.
//
// Lee todo lo que hace falta, corre el motor puro (replaySeason) y escribe el
// resultado con la RPC apply_rating_events, que borra y regenera los eventos en
// una sola transacción. Recalcular es idempotente: mismas entradas, mismo
// resultado, siempre.

interface FilaSemilla {
  id: string
  rating_seed: number | null
}

interface FilaAjuste {
  player_id: string
  delta: number
  round: { round_number: number } | null
}

// Forma que devuelve PostgREST con los embeds de abajo.
interface FilaPartido {
  id: string
  round_id: string
  category_code: string
  scheduled_at: string | null
  round: { round_number: number; season_id: string } | null
  matchup: { team_a_id: string; team_b_id: string } | null
  result: {
    status: string
    is_walkover: boolean
    walkover_team_id: string | null
    set1_team_a: number | null
    set1_team_b: number | null
    set2_team_a: number | null
    set2_team_b: number | null
    set3_team_a: number | null
    set3_team_b: number | null
  } | null
  entries: Array<{
    player_1_id: string | null
    player_2_id: string | null
    lineup: { team_id: string } | null
  }>
}

async function leerAjustes(seasonId: string): Promise<RatingAdjustment[]> {
  // Si el usuario no es organizador la RLS devuelve 0 filas; el recálculo lo
  // corre el organizador, así que en la práctica siempre los ve.
  const { data, error } = await supabase
    .from('player_rating_adjustments')
    .select('player_id, delta, round:rounds(round_number)')
    .eq('season_id', seasonId)
  if (error) throw error
  return ((data ?? []) as unknown as FilaAjuste[]).map((a) => ({
    player_id: a.player_id,
    delta: Number(a.delta),
    round_number: a.round?.round_number ?? null,
  }))
}

async function leerSettings(): Promise<RatingSettings> {
  const { data, error } = await supabase
    .from('rating_settings')
    .select('k_factor, divisor, mov_base, mov_step, mov_min, mov_max, count_walkovers')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  if (!data) return DEFAULT_RATING_SETTINGS
  // Postgres serializa numeric como string: hay que coercionar o la aritmética
  // concatena en vez de sumar (mismo cuidado que usePlayerRankings).
  return {
    k_factor: Number(data.k_factor),
    divisor: Number(data.divisor),
    mov_base: Number(data.mov_base),
    mov_step: Number(data.mov_step),
    mov_min: Number(data.mov_min),
    mov_max: Number(data.mov_max),
    count_walkovers: Boolean(data.count_walkovers),
  }
}

async function leerSemillas(seasonId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('players')
    .select('id, rating_seed')
    .eq('season_id', seasonId)
  if (error) throw error
  const m = new Map<string, number>()
  for (const p of (data ?? []) as FilaSemilla[]) {
    if (p.rating_seed != null) m.set(p.id, Number(p.rating_seed))
  }
  return m
}

async function leerPartidos(seasonId: string): Promise<RatingMatch[]> {
  // Un solo viaje: partido + jornada + enfrentamiento + resultado + las dos
  // alineaciones con sus parejas. lineup_entries se ata por match_id Y por
  // category_code: el UPSERT de save_lineup nunca borra, así que una categoría
  // que dejó de tener match_id podría dejar una entrada huérfana.
  const { data, error } = await supabase
    .from('matches')
    .select(
      `id, round_id, category_code, scheduled_at,
       round:rounds!inner(round_number, season_id),
       matchup:team_matchups(team_a_id, team_b_id),
       result:match_results(status, is_walkover, walkover_team_id,
         set1_team_a, set1_team_b, set2_team_a, set2_team_b, set3_team_a, set3_team_b),
       entries:lineup_entries(player_1_id, player_2_id, lineup:lineups(team_id))`,
    )
    .eq('rounds.season_id', seasonId)
  if (error) throw error

  const filas = (data ?? []) as unknown as FilaPartido[]
  const out: RatingMatch[] = []

  for (const f of filas) {
    if (!f.round || !f.matchup || !f.result) continue

    const parejaDe = (teamId: string): readonly [string, string] | null => {
      const e = f.entries.find((x) => x.lineup?.team_id === teamId)
      if (!e || !e.player_1_id || !e.player_2_id) return null
      return [e.player_1_id, e.player_2_id] as const
    }

    out.push({
      match_id: f.id,
      season_id: f.round.season_id,
      round_id: f.round_id,
      round_number: f.round.round_number,
      scheduled_at: f.scheduled_at,
      category_code: f.category_code,
      team_a_id: f.matchup.team_a_id,
      team_b_id: f.matchup.team_b_id,
      sets: [
        { a: f.result.set1_team_a, b: f.result.set1_team_b },
        { a: f.result.set2_team_a, b: f.result.set2_team_b },
        { a: f.result.set3_team_a, b: f.result.set3_team_b },
      ],
      result_status: f.result.status,
      is_walkover: f.result.is_walkover,
      walkover_team_id: f.result.walkover_team_id,
      pair_a: parejaDe(f.matchup.team_a_id),
      pair_b: parejaDe(f.matchup.team_b_id),
    })
  }

  return out
}

export interface RecomputeResult {
  eventos: number
  jugadores: number
  partidosContados: number
  descartes: Record<string, number>
}

export async function recomputeRatings(seasonId: string): Promise<RecomputeResult> {
  const [settings, seeds, matches, adjustments] = await Promise.all([
    leerSettings(),
    leerSemillas(seasonId),
    leerPartidos(seasonId),
    leerAjustes(seasonId),
  ])

  const { events, finales, descartes } = replaySeason({ seeds, matches, adjustments, settings })

  const finals = [...finales].map(([player_id, v]) => ({
    player_id,
    rating: v.rating,
    matches: v.matches,
  }))

  const { data, error } = await supabase.rpc('apply_rating_events', {
    p_season_id: seasonId,
    p_events: events,
    p_finals: finals,
  })
  if (error) {
    throw new Error(
      /Solo el organizador/i.test(error.message)
        ? 'No tienes permiso para recalcular el rating.'
        : error.message,
    )
  }

  const porMotivo: Record<string, number> = {}
  for (const d of descartes) porMotivo[d.motivo] = (porMotivo[d.motivo] ?? 0) + 1

  const res = (data ?? {}) as { events?: number; players?: number }
  return {
    eventos: res.events ?? events.length,
    jugadores: res.players ?? finals.length,
    partidosContados: events.length / 4,
    descartes: porMotivo,
  }
}

/** Claves de caché que dependen del rating. */
export function invalidateRating(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['players_public'] })
  void qc.invalidateQueries({ queryKey: ['rating-events'] })
}

export function useRecomputeRatings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (seasonId: string) => recomputeRatings(seasonId),
    onSuccess: () => invalidateRating(qc),
  })
}
