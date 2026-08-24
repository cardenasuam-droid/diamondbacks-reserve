// Conteo de DOBLETEOS por equipo. Regla de la organizadora (2026-08-24):
// cada equipo puede hacer 3 dobleteos por temporada (un jugador repite juego en
// la misma jornada), con dos excepciones que NO cuentan:
//
//   1. El jugador es de 3a Femenil o 4a Varonil: esas categorías tienen
//      exactamente los jugadores que piden sus huecos (2 para 2), así que
//      dobletear ahí es necesidad estructural, no ventaja.
//   2. El jugador dobletea jugando una categoría SUPERIOR a la suya (el hueco
//      que cubre es más fuerte que su propio nivel): ayuda hacia arriba, no
//      ventaja hacia abajo.
//
// Los dobleteos NO se almacenan: se DERIVAN de las alineaciones publicadas
// (CLAUDE.md §3.4). Función pura con tests, como el resto del cálculo.

import {
  categoryRank,
  expandSlots,
  type EligibilityRule,
} from './validateLineup'
import type { Gender } from '@/lib/types'

/** Categorías de ranking exentas del conteo por falta estructural de jugadores. */
export const CATEGORIAS_EXENTAS = new Set(['FEM_3', 'VAR_4'])

export const LIMITE_DOBLETEOS = 3

export interface SeasonEntry {
  round_number: number
  team_id: string
  /** Categoría de PARTIDO de la entrada (la del match). */
  category_code: string
  player_1_id: string | null
  player_2_id: string | null
}

export interface DobleteoPlayer {
  id: string
  category_code: string
  gender: Gender
}

export interface DobleteoEvent {
  team_id: string
  round_number: number
  player_id: string
  /** Categoría de partido donde ocurre la aparición extra. */
  category_code: string
  exempt: boolean
  reason: 'fem3_var4' | 'categoria_superior' | null
}

interface Aparicion {
  entry: SeasonEntry
  partnerId: string | null
}

/** ¿El jugador encaja EXACTO (género + categoría) en algún hueco de estas reglas? */
function encajaExacto(p: DobleteoPlayer, slots: EligibilityRule[]): boolean {
  return slots.some(
    (s) => s.required_gender === p.gender && s.required_player_category_code === p.category_code,
  )
}

/**
 * El hueco que ocupa `p` en una entrada: si su pareja encaja exacto en un único
 * hueco, `p` ocupa el otro; si no, el hueco donde `p` encaja exacto; y si
 * tampoco, el más débil de su género (conservador: ante la duda, cuenta).
 */
function huecoDe(
  p: DobleteoPlayer,
  partner: DobleteoPlayer | undefined,
  slots: EligibilityRule[],
): EligibilityRule | null {
  if (slots.length === 0) return null
  if (slots.length === 1) return slots[0]

  if (partner) {
    const dePareja = slots
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.required_gender === partner.gender && s.required_player_category_code === partner.category_code)
    if (dePareja.length === 1) {
      const otro = slots.find((_, i) => i !== dePareja[0].i)
      if (otro) return otro
    }
  }

  const exacto = slots.find(
    (s) => s.required_gender === p.gender && s.required_player_category_code === p.category_code,
  )
  if (exacto) return exacto

  const deSuGenero = slots.filter((s) => s.required_gender === p.gender)
  if (deSuGenero.length === 0) return null
  return deSuGenero.reduce((peor, s) => {
    const rp = categoryRank(peor.required_player_category_code) ?? 0
    const rs = categoryRank(s.required_player_category_code) ?? 0
    return rs > rp ? s : peor
  })
}

export interface DobleteosResult {
  events: DobleteoEvent[]
  /** Dobleteos QUE CUENTAN por equipo (los exentos no suman). */
  countByTeam: Map<string, number>
}

export function countDobleteos(
  entries: SeasonEntry[],
  playersById: Map<string, DobleteoPlayer>,
  rules: EligibilityRule[],
): DobleteosResult {
  const slotsPorCategoria = new Map<string, EligibilityRule[]>()
  for (const r of rules) {
    const list = slotsPorCategoria.get(r.match_category_code) ?? []
    list.push(r)
    slotsPorCategoria.set(r.match_category_code, list)
  }
  const slotsDe = (cat: string) => expandSlots(slotsPorCategoria.get(cat) ?? [])

  // Apariciones por (equipo, jornada, jugador).
  const porClave = new Map<string, Aparicion[]>()
  for (const e of entries) {
    for (const [id, partner] of [
      [e.player_1_id, e.player_2_id],
      [e.player_2_id, e.player_1_id],
    ] as const) {
      if (!id) continue
      const clave = `${e.team_id}|${e.round_number}|${id}`
      const list = porClave.get(clave) ?? []
      list.push({ entry: e, partnerId: partner })
      porClave.set(clave, list)
    }
  }

  const events: DobleteoEvent[] = []

  for (const [clave, apariciones] of porClave) {
    if (apariciones.length < 2) continue
    const [team_id, roundStr, player_id] = clave.split('|')
    const p = playersById.get(player_id)
    if (!p) continue

    // La aparición BASE es donde el jugador encaja exacto en un hueco (su juego
    // natural); las demás son dobleteos. Si dobletea en su nivel Y hacia
    // arriba, la base es la de su nivel — así la aparición extra es la superior
    // y queda exenta, que es lo que la regla premia.
    const ordenadas = [...apariciones].sort((a, b) => {
      const ea = encajaExacto(p, slotsDe(a.entry.category_code)) ? 0 : 1
      const eb = encajaExacto(p, slotsDe(b.entry.category_code)) ? 0 : 1
      return ea - eb
    })

    for (const ap of ordenadas.slice(1)) {
      let exempt = false
      let reason: DobleteoEvent['reason'] = null

      if (CATEGORIAS_EXENTAS.has(p.category_code)) {
        exempt = true
        reason = 'fem3_var4'
      } else {
        const hueco = huecoDe(p, ap.partnerId ? playersById.get(ap.partnerId) : undefined, slotsDe(ap.entry.category_code))
        const rankHueco = hueco ? categoryRank(hueco.required_player_category_code) : null
        const rankJugador = categoryRank(p.category_code)
        if (rankHueco != null && rankJugador != null && rankHueco < rankJugador) {
          exempt = true
          reason = 'categoria_superior'
        }
      }

      events.push({
        team_id,
        round_number: Number(roundStr),
        player_id,
        category_code: ap.entry.category_code,
        exempt,
        reason,
      })
    }
  }

  events.sort(
    (a, b) => a.round_number - b.round_number || a.team_id.localeCompare(b.team_id),
  )

  const countByTeam = new Map<string, number>()
  for (const ev of events) {
    if (ev.exempt) continue
    countByTeam.set(ev.team_id, (countByTeam.get(ev.team_id) ?? 0) + 1)
  }

  return { events, countByTeam }
}
