import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Cambios de alineación usados por el equipo en la temporada (tope 5, spec §9).
// Regla vigente (0042): solo cuentan los cambios hechos DESPUÉS de publicado el
// rol (counts_against_limit, congelado al insertar). Los ajustes previos a la
// publicación — borradores, reenvíos, correcciones del armado — son libres y
// quedan en el log solo como auditoría. Debe filtrar IGUAL que el trigger
// enforce_change_limit del servidor, o el contador de la UI mentiría.
async function fetchChangeCount(teamId: string, seasonId: string): Promise<number> {
  const { count, error } = await supabase
    .from('lineup_change_logs')
    .select('id, round:rounds!inner(season_id)', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('counts_against_limit', true)
    .eq('round.season_id', seasonId)
  if (error) throw error
  return count ?? 0
}

export function useChangeCount(teamId: string | undefined, seasonId: string | undefined) {
  return useQuery({
    queryKey: ['change-count', teamId, seasonId],
    queryFn: () => fetchChangeCount(teamId as string, seasonId as string),
    enabled: Boolean(teamId && seasonId),
  })
}
