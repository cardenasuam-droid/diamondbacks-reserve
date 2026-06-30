import type { CategoryType, Gender, MatchCategory } from '@/lib/types'

// Las categorías de ranking (no mixtas) son las únicas que puede tener un
// jugador en su ficha. MIX_A/MIX_B son combinaciones derivadas, no categorías
// propias: por eso no se ofrecen al inscribirse.
export function rankingCategories(categories: MatchCategory[]): MatchCategory[] {
  return categories
    .filter((c) => c.type !== 'mixta' && c.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
}

// El género se deriva del tipo de categoría (varonil→male, femenil→female).
// 'mixta' no aplica a la ficha individual de un jugador.
export function genderForCategoryType(type: CategoryType): Gender | null {
  if (type === 'varonil') return 'male'
  if (type === 'femenil') return 'female'
  return null
}
