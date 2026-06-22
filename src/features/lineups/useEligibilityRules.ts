import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EligibilityRule } from './validateLineup'

// Reglas de elegibilidad data-driven (CLAUDE.md §4). Casi inmutables.
async function fetchRules(): Promise<EligibilityRule[]> {
  const { data, error } = await supabase
    .from('category_eligibility_rules')
    .select('match_category_code, required_gender, required_player_category_code, required_count')
  if (error) throw error
  return (data ?? []) as EligibilityRule[]
}

export function useEligibilityRules() {
  return useQuery({
    queryKey: ['eligibility-rules'],
    queryFn: fetchRules,
    staleTime: 30 * 60_000,
  })
}
