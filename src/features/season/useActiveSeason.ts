import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Season } from '@/lib/types'

// Temporada "actual": la marcada como 'active'; si no hay, la más reciente.
// Toda página pública se scopea a esta temporada.
async function fetchActiveSeason(): Promise<Season | null> {
  const { data, error } = await supabase.from('seasons').select('*')
  if (error) throw error
  const seasons = (data ?? []) as Season[]
  if (seasons.length === 0) return null

  const active = seasons.find((s) => s.status === 'active')
  if (active) return active

  // Fallback determinista: por start_date (desc), luego created_at (desc).
  return [...seasons].sort((a, b) => {
    const da = a.start_date ?? a.created_at
    const db = b.start_date ?? b.created_at
    return db.localeCompare(da)
  })[0]
}

export function useActiveSeason() {
  return useQuery({
    queryKey: ['active-season'],
    queryFn: fetchActiveSeason,
    staleTime: 5 * 60_000,
  })
}
