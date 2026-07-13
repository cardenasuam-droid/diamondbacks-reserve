import type { CategoryType, Gender, MatchCategory } from '@/lib/types'

// Las categorías de RANKING son las únicas que puede tener un jugador en su ficha
// (VAR_4/5/6, FEM_3-7). Se marcan con is_ranking (0029): las de partido derivadas
// —Suma y mixtas— NO son ranking y no se ofrecen al inscribirse ni en el draft.
export function rankingCategories(categories: MatchCategory[]): MatchCategory[] {
  return categories
    .filter((c) => c.is_ranking && c.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
}

// El género se deriva del tipo de categoría (varonil→male, femenil→female).
// 'mixta' no aplica a la ficha individual de un jugador.
export function genderForCategoryType(type: CategoryType): Gender | null {
  if (type === 'varonil') return 'male'
  if (type === 'femenil') return 'female'
  return null
}
