// Generador de alineación ALEATORIA pero VÁLIDA, para el cierre automático de la
// jornada (Fase 2): cuando un equipo no envió alineación, el organizador la genera
// al azar al "cerrar y publicar". Corre en el cliente (navegador del organizador)
// y se guarda con save_lineup (el organizador salta el candado). Es lógica pura y
// testeable — el espejo positivo de validateLineup.
//
// Reglas que respeta (mismas que validateLineup):
//   - 2 jugadores por categoría, con el perfil género + categoría de ranking exigido
//   - mixtas 1+1
//   - un jugador NO puede quedar en más de una categoría de la jornada
// Comportamiento con roster corto (decisión del dueño): llena las categorías que
// pueda de forma válida y DEJA VACÍAS las que no alcancen (se manejan como faltantes).

import type { Gender } from '@/lib/types'
import type { EligibilityRule } from './validateLineup'

export interface GenPlayer {
  id: string
  gender: Gender
  category_code: string // categoría de ranking del jugador (no-mixta)
}

export interface GeneratedEntry {
  category_code: string
  player_1_id: string
  player_2_id: string
}

interface Slot {
  gender: Gender
  category_code: string
}

// Los 2 huecos exigidos por una categoría (expande required_count).
function slotsFor(catCode: string, rules: EligibilityRule[]): Slot[] {
  const slots: Slot[] = []
  for (const r of rules.filter((x) => x.match_category_code === catCode)) {
    for (let i = 0; i < r.required_count; i++) {
      slots.push({ gender: r.required_gender, category_code: r.required_player_category_code })
    }
  }
  return slots
}

// Baraja una copia con Fisher–Yates usando el rng inyectado (determinista en tests).
function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Arma una alineación válida al azar. Devuelve una entrada por cada categoría que
// SÍ pudo llenar (2 jugadores válidos y distintos, sin repetir jugador en la
// jornada). Las que no alcanzan quedan fuera del arreglo.
export function generateRandomLineup(
  categories: readonly string[],
  roster: readonly GenPlayer[],
  rules: readonly EligibilityRule[],
  rng: () => number = Math.random,
): GeneratedEntry[] {
  const rulesArr = [...rules]
  const used = new Set<string>()
  const entries: GeneratedEntry[] = []

  // Orden aleatorio de categorías: reparte quién se queda sin cubrir cuando el
  // roster no alcanza (greedy; suficiente para el auto-relleno).
  for (const cat of shuffled(categories, rng)) {
    const slots = slotsFor(cat, rulesArr)
    if (slots.length !== 2) continue // categoría sin regla clara: no la generamos

    const picked: string[] = []
    let ok = true
    for (const slot of slots) {
      const candidates = shuffled(
        roster.filter(
          (p) => p.gender === slot.gender && p.category_code === slot.category_code && !used.has(p.id),
        ),
        rng,
      )
      const choice = candidates[0]
      if (!choice) {
        ok = false
        break
      }
      picked.push(choice.id)
      used.add(choice.id)
    }

    if (ok && picked.length === 2) {
      entries.push({ category_code: cat, player_1_id: picked[0], player_2_id: picked[1] })
    } else {
      // No alcanzó: libera los que había apartado para esta categoría fallida.
      for (const id of picked) used.delete(id)
    }
  }

  return entries
}
