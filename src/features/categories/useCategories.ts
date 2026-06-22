import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MatchCategory } from '@/lib/types'

// Catálogo de categorías (data-driven; nombres y orden vienen de la BD).
// Reutilizable en rosters, rol y resultados.
async function fetchCategories(): Promise<MatchCategory[]> {
  const { data, error } = await supabase
    .from('match_categories')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as MatchCategory[]
}

export function useCategories() {
  return useQuery({
    queryKey: ['match-categories'],
    queryFn: fetchCategories,
    staleTime: 30 * 60_000, // casi inmutable
  })
}
