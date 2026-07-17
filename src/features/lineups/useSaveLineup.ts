import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MatchCategory } from '@/lib/types'
import type { LineupSelection } from './validateLineup'
import type { CaptainMatchup, StoredLineup } from './types'
import { lineupQueryKey } from './useLineup'

export interface SaveLineupVars {
  matchup: CaptainMatchup
  teamId: string
  /** Reservado para los hooks de cuenta; el RPC lo recalcula del lado servidor. */
  profileId?: string | null
  existing: StoredLineup | null
  categories: MatchCategory[]
  selections: Record<string, LineupSelection>
  /** Categorías marcadas como EXCEPCIÓN real (fuera de categoría / repetido). 0038. */
  exceptionCategories?: Set<string>
  /** true = enviar/confirmar; false = guardar borrador. */
  submit: boolean
}

// Traduce errores de Postgres/Supabase a algo legible. El RPC y los triggers ya
// lanzan mensajes en español (lock 1h, límite de 5, "solo el capitán…").
function friendlyError(msg: string): string {
  if (/row-level security/i.test(msg)) {
    return 'No tienes permiso para editar esta alineación.'
  }
  return msg
}

// Guardado atómico: una sola transacción en el servidor (RPC save_lineup, 0007).
// El RPC crea/actualiza el lineup, registra los change_logs por categoría
// cambiada (el trigger valida el tope de 5) y hace upsert de las entradas.
async function saveLineup(vars: SaveLineupVars): Promise<string> {
  const { matchup, teamId, categories, selections, exceptionCategories, submit } = vars
  const matchIdByCategory = new Map(matchup.matches.map((m) => [m.category_code, m.id]))

  const entries = categories
    .filter((c) => matchIdByCategory.has(c.code))
    .map((c) => ({
      category_code: c.code,
      match_id: matchIdByCategory.get(c.code) as string,
      player_1_id: selections[c.code]?.player_1_id ?? null,
      player_2_id: selections[c.code]?.player_2_id ?? null,
      is_exception: exceptionCategories?.has(c.code) ?? false,
    }))

  const { data, error } = await supabase.rpc('save_lineup', {
    p_team_matchup_id: matchup.id,
    p_team_id: teamId,
    p_submit: submit,
    p_entries: entries,
  })
  if (error) throw new Error(friendlyError(error.message))
  return data as string
}

export function useSaveLineup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveLineup,
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({ queryKey: lineupQueryKey(vars.matchup.id, vars.teamId) })
      void qc.invalidateQueries({ queryKey: ['change-count', vars.teamId] })
    },
  })
}
