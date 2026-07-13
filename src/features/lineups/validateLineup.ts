// Motor de validación de alineaciones. EL CORAZÓN DE LA APP (CLAUDE.md §1, §4).
//
// Función pura, sin dependencias de red ni de React: recibe la selección del
// capitán + el roster + las reglas de elegibilidad (data-driven, tabla
// category_eligibility_rules) y devuelve todos los problemas encontrados.
// La UI decide si permite enviar (solo cuando `valid === true`); los triggers
// de servidor (lock 1h, límite de cambios) son la otra mitad del blindaje.
//
// Reglas que hace cumplir (spec §8.2, §8.3):
//   - cada categoría debe quedar completa (2 jugadores)
//   - el mismo jugador no puede ir dos veces en una categoría
//   - solo jugadores del propio equipo
//   - cada jugador debe cumplir género + categoría de ranking requeridos
//   - las mixtas se arman con el perfil correcto (1 + 1)
//   - un jugador no puede aparecer en más de una categoría de la jornada

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

    // Mismo jugador dos veces en la misma categoría.
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

    // Duplicado en la jornada: cada jugador distinto cuenta una vez por categoría.
    for (const p of new Map(resolved.map((r) => [r.id, r])).values()) {
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
    // válidos y distintos. Si está incompleta o tiene ajenos/desconocidos, esos
    // errores ya se reportaron y no añadimos ruido.
    const catRules = rulesByCat.get(code) ?? []
    if (resolved.length === 2 && !duplicateInCat) {
      const pool = [...resolved]
      for (const rule of catRules) {
        let need = rule.required_count
        for (let i = pool.length - 1; i >= 0 && need > 0; i--) {
          if (
            pool[i].gender === rule.required_gender &&
            pool[i].category_code === rule.required_player_category_code
          ) {
            pool.splice(i, 1)
            need--
          }
        }
      }
      // Lo que sobra no encaja en ningún hueco de la categoría.
      for (const p of pool) {
        issues.push({
          category_code: code,
          code: 'ineligible',
          player_id: p.id,
          message: `Error en ${catName}: ${p.full_name} no cumple los requisitos (${describeRequirement(
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
