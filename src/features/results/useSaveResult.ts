import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { recomputeRatings, invalidateRating } from '@/features/rating/useRecomputeRatings'
import { deriveResult, type SetInput } from './resultLogic'

export interface SaveResultVars {
  matchId: string
  teamAId: string
  teamBId: string
  set1: SetInput
  set2: SetInput
  set3: SetInput
  walkover: boolean
  walkoverTeamId: string | null
  profileId: string | null
  /** Solo para invalidar la jornada en pantalla. */
  roundId: string
  /** Para recalcular el rating al guardar. Sin ella, no se recalcula. */
  seasonId?: string
}

// Captura/validación directa de un resultado por el organizador. Guarda solo
// marcadores + ganador + walkover; los puntos los derivan las vistas (§3.4).
async function saveResult(vars: SaveResultVars): Promise<void> {
  const { matchId, teamAId, teamBId, set1, set2, set3, walkover, walkoverTeamId, profileId } = vars
  const now = new Date().toISOString()

  let payload: Record<string, unknown>

  if (walkover) {
    if (!walkoverTeamId) {
      throw new Error('Indica qué equipo no se presentó.')
    }
    const winner = walkoverTeamId === teamAId ? teamBId : teamAId
    payload = {
      match_id: matchId,
      is_walkover: true,
      walkover_team_id: walkoverTeamId,
      winner_team_id: winner,
      status: 'walkover',
      set1_team_a: null, set1_team_b: null,
      set2_team_a: null, set2_team_b: null,
      set3_team_a: null, set3_team_b: null,
      validated_by: profileId,
      validated_at: now,
    }
  } else {
    const d = deriveResult([set1, set2, set3])
    if (d.error) throw new Error(d.error)
    if (!d.decided) throw new Error('Marcador incompleto: falta un set decisivo.')
    const winner = d.winnerSide === 'a' ? teamAId : teamBId
    payload = {
      match_id: matchId,
      is_walkover: false,
      walkover_team_id: null,
      winner_team_id: winner,
      status: 'validated',
      set1_team_a: set1.a, set1_team_b: set1.b,
      set2_team_a: set2.a, set2_team_b: set2.b,
      set3_team_a: set3.a, set3_team_b: set3.b,
      validated_by: profileId,
      validated_at: now,
    }
  }

  const { error } = await supabase
    .from('match_results')
    .upsert(payload, { onConflict: 'match_id' })
  if (error) {
    throw new Error(
      /row-level security/i.test(error.message)
        ? 'No tienes permiso para guardar resultados.'
        : error.message,
    )
  }

  // Rating: recálculo COMPLETO de la temporada (0039/0040). Va después del
  // upsert y no dentro de él a propósito. El resultado ya está guardado; si el
  // recálculo falla, el error dice exactamente eso en vez de aparentar que se
  // perdió el marcador. El organizador puede reintentar desde su panel.
  //
  // Completo y no incremental porque este upsert SOBRESCRIBE el resultado
  // anterior sin dejar rastro: corregir un marcador de la jornada 1 cambia todos
  // los deltas posteriores y no hay estado viejo del que restar.
  if (vars.seasonId) {
    try {
      await recomputeRatings(vars.seasonId)
    } catch (e) {
      throw new Error(
        'El resultado se guardó correctamente, pero el rating no se pudo recalcular: ' +
          (e instanceof Error ? e.message : String(e)) +
          '. Puedes reintentarlo desde el panel de rating.',
      )
    }
  }
}

// Claves que dependen de un resultado. Se invalidan igual al guardar que al
// borrar: si divergieran, una de las dos operaciones dejaría pantallas viejas.
function invalidateResult(
  qc: ReturnType<typeof useQueryClient>,
  vars: { roundId: string; matchId: string },
) {
  void qc.invalidateQueries({ queryKey: ['round-matches', vars.roundId] })
  void qc.invalidateQueries({ queryKey: ['standings'] })
  void qc.invalidateQueries({ queryKey: ['player-rankings'] })
  // Huecos que ya existían antes del rating: la pantalla pública del partido
  // y las alineaciones publicadas se quedaban con el marcador viejo tras
  // corregir un resultado.
  void qc.invalidateQueries({ queryKey: ['match-detail', vars.matchId] })
  // El desglose por equipo del detalle lee per_team_match: cambia con cada
  // guardado/borrado igual que el marcador.
  void qc.invalidateQueries({ queryKey: ['match-team-stats', vars.matchId] })
  void qc.invalidateQueries({ queryKey: ['published-lineups'] })
  // El reporte de la capitana vive en su propia caché.
  void qc.invalidateQueries({ queryKey: ['captain-round-matchup'] })
  invalidateRating(qc)
}

export function useSaveResult() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveResult,
    onSuccess: (_v, vars) => invalidateResult(qc, vars),
  })
}

export interface DeleteResultVars {
  matchId: string
  roundId: string
  seasonId?: string
}

// Borrar un resultado: para el marcador capturado en el partido equivocado, que
// hasta ahora quedaba oficial (moviendo tabla y rating) y solo se quitaba con SQL
// a mano. La RLS "organizer all" ya permitía el DELETE; faltaba la puerta.
//
// Tras borrar hay que RECALCULAR: el rating es una reproducción de la temporada
// y el partido borrado debe dejar de contar. Sin esto, los deltas de ese partido
// se quedarían fosilizados en el rating de sus cuatro jugadores.
async function deleteResult(vars: DeleteResultVars): Promise<void> {
  const { error } = await supabase.from('match_results').delete().eq('match_id', vars.matchId)
  if (error) {
    throw new Error(
      /row-level security/i.test(error.message)
        ? 'No tienes permiso para borrar resultados.'
        : error.message,
    )
  }

  if (vars.seasonId) {
    try {
      await recomputeRatings(vars.seasonId)
    } catch (e) {
      throw new Error(
        'El resultado se borró, pero el rating no se pudo recalcular: ' +
          (e instanceof Error ? e.message : String(e)) +
          '. Puedes reintentarlo desde el panel de rating.',
      )
    }
  }
}

export function useDeleteResult() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteResult,
    onSuccess: (_v, vars) => invalidateResult(qc, vars),
  })
}
