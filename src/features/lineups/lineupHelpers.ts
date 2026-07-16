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

// Fecha/hora LÍMITE para enviar o editar una alineación: el sábado inmediatamente
// anterior a la jornada, 07:00 hora de México (America/Mexico_City = UTC-6 todo el
// año desde 2023, sin horario de verano). Debe coincidir con lineup_deadline() del
// servidor (migración 0035). `roundDate` es 'YYYY-MM-DD'.
export function lineupDeadline(roundDate: string): Date {
  const [y, m, d] = roundDate.split('-').map(Number)
  // getUTCDay sobre una fecha UTC pura: 0=domingo .. 6=sábado.
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const back = (dow + 1) % 7 === 0 ? 7 : (dow + 1) % 7
  const sat = new Date(Date.UTC(y, m - 1, d - back))
  const yy = sat.getUTCFullYear()
  const mm = String(sat.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(sat.getUTCDate()).padStart(2, '0')
  return new Date(`${yy}-${mm}-${dd}T07:00:00-06:00`)
}

// ¿Ya pasó el límite? (candado del lado cliente; el trigger de servidor es el
// guardián real). Sin fecha de jornada, no bloquea.
export function isLineupLocked(roundDate: string | null | undefined, now: number = Date.now()): boolean {
  if (!roundDate) return false
  return now >= lineupDeadline(roundDate).getTime()
}
