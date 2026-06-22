import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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
}

export function useSaveResult() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveResult,
    onSuccess: (_v, vars) => {
      void qc.invalidateQueries({ queryKey: ['round-matches', vars.roundId] })
      void qc.invalidateQueries({ queryKey: ['standings'] })
      void qc.invalidateQueries({ queryKey: ['player-rankings'] })
    },
  })
}
