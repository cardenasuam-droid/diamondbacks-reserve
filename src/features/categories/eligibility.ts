import type { CategoryType, Gender } from '@/lib/types'

// Género que exige una categoría de RANKING (no mixta). null para mixta, que no
// es categoría de ranking de un jugador. Fuente única para el importador y los
// formularios de gestión.
export function genderForCategoryType(type: CategoryType): Gender | null {
  if (type === 'varonil') return 'male'
  if (type === 'femenil') return 'female'
  return null
}
