// Motor de validación de alineaciones. EL CORAZÓN DE LA APP (CLAUDE.md §1, §4).
//
// Función pura, sin dependencias de red ni de React: recibe la selección del
// capitán + el roster + las reglas de elegibilidad (data-driven, tabla
// category_eligibility_rules) y devuelve todos los problemas encontrados.
// La UI decide si permite enviar (solo cuando `valid === true`); los triggers
// de servidor (lock, límite de cambios) son la otra mitad del blindaje.
//
// Reglas que hace cumplir (spec §8.2, §8.3):
//   - cada categoría debe quedar completa (2 jugadores)
//   - el mismo jugador no puede ir dos veces en una categoría
//   - solo jugadores del propio equipo
//   - cada jugador debe cumplir género + categoría de ranking requeridos
//   - las mixtas se arman con el perfil correcto (1 + 1)
//   - un jugador no puede aparecer en más de una categoría de la jornada
//
// EXCEPCIÓN por falta de jugadores (confirmada por la capitana): para las
// categorías marcadas en `exceptionCategories`, se relaja la regla de categoría y
// la de "no repetir en la jornada":
//   - el jugador debe seguir siendo del GÉNERO del hueco,
//   - y de categoría IGUAL O MÁS DÉBIL (número mayor: 4a es más fuerte que 5a),
//   - y sí puede repetirse (dobletear) en esa categoría de excepción.
// Un jugador MÁS FUERTE o de otro género sigue siendo inválido (no es excepción).

import type { Gender, MatchCategory } from '@/lib/types'

// Jugador del roster con los datos que la validación necesita.
export interface EligiblePlayer {
  id: string
  full_name: string
  gender: Gender
  category_code: string // categoría de ranking del jugador (no-mixta)
  team_id: string
}

// Regla de elegibilidad (una fila de category_eligibility_rules).
export interface EligibilityRule {
  match_category_code: string
  required_gender: Gender
  required_player_category_code: string
  required_count: number
}

// La pareja propuesta para una categoría.
export interface LineupSelection {
  category_code: string
  player_1_id: string | null
  player_2_id: string | null
}

export type IssueCode =
  | 'incomplete' // falta uno o ambos jugadores
  | 'duplicate_in_category' // el mismo jugador dos veces en la categoría
  | 'foreign_player' // jugador de otro equipo
  | 'unknown_player' // id que no está en el roster
  | 'ineligible' // no cumple género/categoría requerida
  | 'duplicate_in_round' // alineado en más de una categoría de la jornada

export interface LineupIssue {
  category_code: string
  code: IssueCode
  message: string
  player_id?: string
}

export interface LineupValidation {
  valid: boolean
  issues: LineupIssue[]
  /** Categorías completas y legales (sin ningún issue). Útil para el progreso en UI. */
  completeCategories: string[]
}

// Rango de una categoría de ranking por su número (4a, 5a…). MAYOR número = MÁS
// DÉBIL (4a es más fuerte que 5a). VAR_4 -> 4, FEM_7 -> 7. Sin número → null.
export function categoryRank(code: string): number | null {
  const m = /(\d+)/.exec(code)
  return m ? parseInt(m[1], 10) : null
}

// Una regla con required_count 2 son DOS huecos que llenar por separado.
function expandSlots(rules: EligibilityRule[]): EligibilityRule[] {
  const slots: EligibilityRule[] = []
  for (const r of rules) {
    for (let i = 0; i < r.required_count; i++) slots.push(r)
  }
  return slots
}

/**
 * Devuelve los jugadores que NO caben en ningún hueco, emparejando jugadores con
 * huecos de forma óptima (cada hueco a un jugador distinto).
 *
 * Antes esto era un bucle codicioso: recorría los huecos en orden y se quedaba
 * con el primer jugador que encajara. Con la EXCEPCIÓN activada un jugador puede
 * encajar en varios huecos a la vez, y el bucle se comía al jugador equivocado.
 *
 * Caso real que rompía (Legacy, 7a Suma = 1 de 3a + 1 de 4a): con la excepción
 * puesta, el hueco de 3a se llevaba a la jugadora de 4a —porque "4a es igual o
 * más débil que 3a" es cierto— y luego la de 3a se quedaba sin hueco y salía
 * marcada como no elegible. Una alineación perfectamente legal se rechazaba, y
 * encima ACTIVAR la excepción convertía en inválida una categoría que sin ella
 * era válida.
 *
 * Ahora se busca un emparejamiento completo por caminos aumentantes: si existe
 * alguna forma de repartir a los jugadores entre los huecos, se encuentra.
 */
function jugadoresSinHueco(
  players: EligiblePlayer[],
  slots: EligibilityRule[],
  encaja: (p: EligiblePlayer, slot: EligibilityRule) => boolean,
): EligiblePlayer[] {
  const jugadorDelHueco: (number | null)[] = new Array(slots.length).fill(null)

  const intentar = (pi: number, visitados: Set<number>): boolean => {
    for (let si = 0; si < slots.length; si++) {
      if (visitados.has(si) || !encaja(players[pi], slots[si])) continue
      visitados.add(si)
      const ocupante = jugadorDelHueco[si]
      // El hueco está libre, o su ocupante puede irse a otro hueco.
      if (ocupante === null || intentar(ocupante, visitados)) {
        jugadorDelHueco[si] = pi
        return true
      }
    }
    return false
  }

  const sinHueco: EligiblePlayer[] = []
  for (let pi = 0; pi < players.length; pi++) {
    if (!intentar(pi, new Set())) sinHueco.push(players[pi])
  }
  return sinHueco
}

// "2 de 4a Varonil" | "1 de 5a Varonil y 1 de 4a Femenil"
function describeRequirement(
  rules: EligibilityRule[],
  nameOf: (code: string) => string,
): string {
  return rules
    .map((r) => `${r.required_count} de ${nameOf(r.required_player_category_code)}`)
    .join(' y ')
}

export function validateLineup(
  teamId: string,
  selections: LineupSelection[],
  roster: EligiblePlayer[],
  rules: EligibilityRule[],
  categories: MatchCategory[],
  exceptionCategories: Set<string> = new Set(),
): LineupValidation {
  const nameOf = (code: string) => categories.find((c) => c.code === code)?.name ?? code
  const rosterById = new Map(roster.map((p) => [p.id, p]))

  const rulesByCat = new Map<string, EligibilityRule[]>()
  for (const r of rules) {
    const list = rulesByCat.get(r.match_category_code)
    if (list) list.push(r)
    else rulesByCat.set(r.match_category_code, [r])
  }

  const selByCat = new Map(selections.map((s) => [s.category_code, s]))
  // Orden de las categorías de PARTIDO (0029): match_sort_order; cae a sort_order.
  const sortedCats = [...categories].sort(
    (a, b) => (a.match_sort_order ?? a.sort_order) - (b.match_sort_order ?? b.sort_order),
  )

  const issues: LineupIssue[] = []
  const completeCategories: string[] = []
  // Para "no jugar dos veces en la jornada": primera categoría donde apareció.
  const firstSeenCategory = new Map<string, string>()

  for (const cat of sortedCats) {
    const code = cat.code
    const catName = cat.name
    const isException = exceptionCategories.has(code)
    const sel =
      selByCat.get(code) ?? { category_code: code, player_1_id: null, player_2_id: null }
    const before = issues.length

    const filled = [sel.player_1_id, sel.player_2_id].filter(
      (x): x is string => Boolean(x),
    )

    // Incompleta: faltan jugadores.
    if (filled.length < 2) {
      issues.push({
        category_code: code,
        code: 'incomplete',
        message: `Error en ${catName}: falta seleccionar ${
          filled.length === 0 ? 'la pareja' : 'un segundo jugador'
        }.`,
      })
    }

    // Mismo jugador dos veces en la misma categoría (nunca, ni con excepción).
    const duplicateInCat =
      Boolean(sel.player_1_id) && sel.player_1_id === sel.player_2_id
    if (duplicateInCat) {
      issues.push({
        category_code: code,
        code: 'duplicate_in_category',
        player_id: sel.player_1_id ?? undefined,
        message: `Error en ${catName}: no puedes alinear al mismo jugador dos veces.`,
      })
    }

    // Resolver jugadores y comprobar pertenencia al equipo.
    const resolved: EligiblePlayer[] = []
    for (const id of filled) {
      const p = rosterById.get(id)
      if (!p) {
        issues.push({
          category_code: code,
          code: 'unknown_player',
          player_id: id,
          message: `Error en ${catName}: jugador no encontrado en el roster.`,
        })
        continue
      }
      if (p.team_id !== teamId) {
        issues.push({
          category_code: code,
          code: 'foreign_player',
          player_id: id,
          message: `Error en ${catName}: ${p.full_name} no pertenece a tu equipo.`,
        })
        continue
      }
      resolved.push(p)
    }

    // Duplicado en la jornada: un jugador puede estar en A LO SUMO una categoría
    // NORMAL. Las apariciones por EXCEPCIÓN son libres (no cuentan ni se marcan),
    // así que un jugador puede tener su categoría normal + dobletear por excepción.
    for (const p of new Map(resolved.map((r) => [r.id, r])).values()) {
      if (isException) continue
      const seen = firstSeenCategory.get(p.id)
      if (seen) {
        issues.push({
          category_code: code,
          code: 'duplicate_in_round',
          player_id: p.id,
          message: `Error en ${catName}: ${p.full_name} ya está alineado en ${seen}. No puede jugar dos partidos en la misma jornada.`,
        })
      } else {
        firstSeenCategory.set(p.id, catName)
      }
    }

    // Elegibilidad: solo cuando la categoría tiene exactamente 2 jugadores
    // válidos y distintos.
    const catRules = rulesByCat.get(code) ?? []
    if (resolved.length === 2 && !duplicateInCat) {
      const slots = expandSlots(catRules)
      const encaja = (p: EligiblePlayer, slot: EligibilityRule): boolean => {
        if (p.gender !== slot.required_gender) return false
        if (!isException) return p.category_code === slot.required_player_category_code
        // Excepción: mismo género + categoría IGUAL O MÁS DÉBIL (número mayor).
        const reqRank = categoryRank(slot.required_player_category_code)
        const pr = categoryRank(p.category_code)
        return reqRank != null && pr != null && pr >= reqRank
      }
      // Lo que sobra no encaja en ningún hueco de la categoría.
      for (const p of jugadoresSinHueco(resolved, slots, encaja)) {
        issues.push({
          category_code: code,
          code: 'ineligible',
          player_id: p.id,
          message: isException
            ? `Error en ${catName}: ${p.full_name} no cumple ni con excepción (debe ser del mismo género y de categoría igual o más débil).`
            : `Error en ${catName}: ${p.full_name} no cumple los requisitos (${describeRequirement(
                catRules,
                nameOf,
              )}).`,
        })
      }
    }

    if (issues.length === before) completeCategories.push(code)
  }

  return { valid: issues.length === 0, issues, completeCategories }
}
