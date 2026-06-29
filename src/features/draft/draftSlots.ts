// Generación pura del board del draft (orden snake). Espeja la lógica del RPC
// start_draft (0015): se usa para PREVISUALIZAR el board en el setup y es el
// corazón calculable del módulo (CLAUDE.md §1) → tests obligatorios.

export interface DraftSlot {
  pick_number: number // orden global del pick (1-based)
  category_code: string
  round: number
  team_id: string
}

export interface CategoryCount {
  code: string // se asume ya en el orden de draft (sort_order)
  count: number
}

// Genera la lista ordenada de slots: por cada categoría (en el orden recibido),
// reparte a TODOS sus jugadores entre los equipos en snake (ronda impar 1→N,
// par N→1), creando solo tantos slots como jugadores haya (última ronda parcial).
export function generateDraftSlots(
  teamsInOrder: { id: string }[],
  categoryCounts: CategoryCount[],
): DraftSlot[] {
  const n = teamsInOrder.length
  const slots: DraftSlot[] = []
  if (n < 1) return slots

  let pick = 0
  for (const { code, count } of categoryCounts) {
    if (count <= 0) continue
    const rounds = Math.ceil(count / n)
    let made = 0
    for (let r = 1; r <= rounds; r++) {
      for (let i = 1; i <= n; i++) {
        if (made >= count) break
        // snake (0-based): impar ascendente 0..n-1, par descendente n-1..0
        const idx = r % 2 === 1 ? i - 1 : n - i
        pick += 1
        slots.push({
          pick_number: pick,
          category_code: code,
          round: r,
          team_id: teamsInOrder[idx].id,
        })
        made += 1
      }
    }
  }
  return slots
}
