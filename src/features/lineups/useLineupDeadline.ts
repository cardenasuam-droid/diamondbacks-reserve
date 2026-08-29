import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// La fecha/hora LÍMITE para enviar o editar una alineación la decide EL SERVIDOR:
// la función lineup_deadline(round_date), la MISMA que usan los triggers
// enforce_lineup_lock y enforce_entry_lock. La UI ya no la recalcula.
//
// Antes se duplicaba aquí la fórmula "sábado anterior 07:00" y se desincronizó en
// cuanto la organizadora autorizó excepciones por jornada (J6 y J7): el cliente
// bloqueaba jornadas que el servidor tenía abiertas. Con una sola fuente de
// verdad, cualquier excepción futura se aplica en la base y la app la respeta
// sin tocar código ni volver a desplegar.
async function fetchLineupDeadline(roundDate: string): Promise<Date> {
  const { data, error } = await supabase.rpc('lineup_deadline', { p_round_date: roundDate })
  if (error) throw error
  if (typeof data !== 'string') {
    throw new Error('El servidor no devolvió la fecha límite de la jornada.')
  }
  return new Date(data)
}

export function useLineupDeadline(roundDate: string | null | undefined) {
  return useQuery({
    queryKey: ['lineup-deadline', roundDate],
    queryFn: () => fetchLineupDeadline(roundDate as string),
    enabled: Boolean(roundDate),
    // El límite de una jornada es fijo: no hace falta refrescarlo seguido.
    staleTime: 5 * 60 * 1000,
  })
}
