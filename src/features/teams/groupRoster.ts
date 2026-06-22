import type { MatchCategory, PublicPlayer } from '@/lib/types'

export interface RosterGroup {
  code: string
  name: string
  players: PublicPlayer[]
}

// Agrupa el roster por categoría de ranking, ordenado por sort_order de la
// categoría. Dentro de cada grupo: capitán primero, luego alfabético.
export function groupRoster(
  players: PublicPlayer[],
  categories: MatchCategory[],
): RosterGroup[] {
  const orderOf = new Map(categories.map((c) => [c.code, c.sort_order]))
  const nameOf = new Map(categories.map((c) => [c.code, c.name]))

  const byCode = new Map<string, PublicPlayer[]>()
  for (const p of players) {
    const list = byCode.get(p.category_code)
    if (list) list.push(p)
    else byCode.set(p.category_code, [p])
  }

  return [...byCode.entries()]
    .map(([code, ps]) => ({
      code,
      name: nameOf.get(code) ?? code,
      players: [...ps].sort(
        (a, b) =>
          Number(b.is_captain) - Number(a.is_captain) ||
          a.full_name.localeCompare(b.full_name, 'es'),
      ),
    }))
    .sort((a, b) => (orderOf.get(a.code) ?? 999) - (orderOf.get(b.code) ?? 999))
}
