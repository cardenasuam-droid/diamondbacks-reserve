// Helpers puros del editor de alineaciones (testeables sin red ni React).

import type { Gender, LineupStatus, MatchCategory } from '@/lib/types'
import type { EligibilityRule, LineupSelection } from './validateLineup'
import type { StoredEntry } from './types'

// Etiqueta en español del estado de una alineación (UI).
const LINEUP_STATUS_LABEL: Record<LineupStatus, string> = {
  draft: 'Borrador',
  submitted: 'Enviada',
  modified: 'Modificada',
  locked: 'Bloqueada',
  validated: 'Validada',
  admin_edited: 'Editada por organizador',
}

export function lineupStatusLabel(status: LineupStatus | null | undefined): string {
  return status ? LINEUP_STATUS_LABEL[status] : 'Sin empezar'
}

// Mapa categoría -> selección, inicializado con todas las categorías vacías y
// rellenado con lo ya guardado. Garantiza una entrada por cada categoría.
export function selectionsFromEntries(
  entries: StoredEntry[],
  categories: MatchCategory[],
): Record<string, LineupSelection> {
  const map: Record<string, LineupSelection> = {}
  for (const c of categories) {
    map[c.code] = { category_code: c.code, player_1_id: null, player_2_id: null }
  }
  for (const e of entries) {
    map[e.category_code] = {
      category_code: e.category_code,
      player_1_id: e.player_1_id,
      player_2_id: e.player_2_id,
    }
  }
  return map
}

// Clave estable de una pareja: conjunto NO ordenado de ids (cambiar el orden de
// los dos jugadores no es un cambio real).
function pairKey(sel: LineupSelection | undefined): string {
  return [sel?.player_1_id ?? '', sel?.player_2_id ?? ''].sort().join('|')
}

// Categorías cuya pareja cambió entre dos estados. Una modificación cuenta por
// partido (spec §9.2): esta lista es la base para registrar lineup_change_logs.
export function changedCategories(
  prev: Record<string, LineupSelection>,
  next: Record<string, LineupSelection>,
  categories: MatchCategory[],
): string[] {
  return categories
    .filter((c) => pairKey(prev[c.code]) !== pairKey(next[c.code]))
    .map((c) => c.code)
}

export interface SlotRequirement {
  gender: Gender
  category_code: string
}

// Perfil exigido por cada uno de los 2 huecos de una categoría. Para las no
// mixtas ambos huecos son iguales; para las mixtas, uno por regla.
//   VAR_4 -> [{male,VAR_4}, {male,VAR_4}]
//   MIX_A -> [{male,VAR_5}, {female,FEM_4}]
export function slotRequirements(
  catCode: string,
  rules: EligibilityRule[],
): SlotRequirement[] {
  const slots: SlotRequirement[] = []
  for (const r of rules.filter((x) => x.match_category_code === catCode)) {
    for (let i = 0; i < r.required_count; i++) {
      slots.push({ gender: r.required_gender, category_code: r.required_player_category_code })
    }
  }
  return slots.slice(0, 2)
}

// El instante LÍMITE ya no se calcula aquí: lo devuelve el servidor
// (useLineupDeadline → RPC lineup_deadline). Estos dos helpers solo COMPARAN y
// FORMATEAN esa fecha, así que no pueden desincronizarse de la base.

// ¿Ya pasó el límite? Mientras no se conozca la fecha (cargando, o jornada sin
// fecha), la UI no bloquea: el trigger del servidor es el guardián real.
export function isPastDeadline(
  deadline: Date | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!deadline) return false
  return now >= deadline.getTime()
}

// Texto del límite en hora de México. Se deriva SIEMPRE de la fecha que devolvió
// el servidor — nunca de una frase fija — para que una jornada con excepción se
// lea correctamente sin tocar código.
export function formatDeadline(deadline: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(deadline)
}
