import type { CategoryType } from '@/lib/types'
import type { BadgeColor } from '@/components/ui/Badge'

// Color de badge por tipo de categoría (compartido en roster, rol y resultados).
export const CATEGORY_TYPE_COLOR: Record<CategoryType, BadgeColor> = {
  varonil: 'blue',
  femenil: 'rose',
  mixta: 'purple',
}

export function categoryColor(type: CategoryType | null | undefined): BadgeColor {
  return type ? CATEGORY_TYPE_COLOR[type] : 'slate'
}
