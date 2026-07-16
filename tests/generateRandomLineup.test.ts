import { generateRandomLineup, type GenPlayer } from '@/features/lineups/generateRandomLineup'
import type { EligibilityRule } from '@/features/lineups/validateLineup'

// rng determinista (LCG) para tests reproducibles.
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const RULES: EligibilityRule[] = [
  { match_category_code: 'VAR_4', required_gender: 'male', required_player_category_code: 'VAR_4', required_count: 2 },
  { match_category_code: 'MIX_A', required_gender: 'male', required_player_category_code: 'VAR_5', required_count: 1 },
  { match_category_code: 'MIX_A', required_gender: 'female', required_player_category_code: 'FEM_4', required_count: 1 },
]

const CATS = ['VAR_4', 'MIX_A']

const FULL_ROSTER: GenPlayer[] = [
  { id: 'v4a', gender: 'male', category_code: 'VAR_4' },
  { id: 'v4b', gender: 'male', category_code: 'VAR_4' },
  { id: 'v5', gender: 'male', category_code: 'VAR_5' },
  { id: 'f4', gender: 'female', category_code: 'FEM_4' },
]

// Comprueba que una entrada cumple los perfiles (género + categoría) de su categoría.
function entryIsEligible(
  entry: { category_code: string; player_1_id: string; player_2_id: string },
  roster: GenPlayer[],
): boolean {
  const rules = RULES.filter((r) => r.match_category_code === entry.category_code)
  const need: { gender: string; cat: string }[] = []
  for (const r of rules) for (let i = 0; i < r.required_count; i++) need.push({ gender: r.required_gender, cat: r.required_player_category_code })
  const players = [entry.player_1_id, entry.player_2_id].map((id) => roster.find((p) => p.id === id)!)
  if (players.some((p) => !p)) return false
  if (players[0].id === players[1].id) return false
  // Emparejamiento perfecto jugador↔hueco.
  const pool = [...players]
  for (const slot of need) {
    const i = pool.findIndex((p) => p.gender === slot.gender && p.category_code === slot.cat)
    if (i < 0) return false
    pool.splice(i, 1)
  }
  return pool.length === 0
}

describe('generateRandomLineup', () => {
  it('con roster completo llena todas las categorías, válidas y sin repetir jugador', () => {
    const entries = generateRandomLineup(CATS, FULL_ROSTER, RULES, seededRng(1))
    expect(entries.map((e) => e.category_code).sort()).toEqual(['MIX_A', 'VAR_4'])
    for (const e of entries) expect(entryIsEligible(e, FULL_ROSTER)).toBe(true)
    // Ningún jugador en dos categorías.
    const ids = entries.flatMap((e) => [e.player_1_id, e.player_2_id])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('es estable para varias semillas (siempre válido, nunca repite jugador)', () => {
    for (let seed = 0; seed < 25; seed++) {
      const entries = generateRandomLineup(CATS, FULL_ROSTER, RULES, seededRng(seed))
      for (const e of entries) expect(entryIsEligible(e, FULL_ROSTER)).toBe(true)
      const ids = entries.flatMap((e) => [e.player_1_id, e.player_2_id])
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('roster corto: llena lo posible y deja el resto vacío (sin inválidas)', () => {
    // Falta el segundo VAR_4 → VAR_4 no se puede armar; MIX_A sí.
    const short: GenPlayer[] = [
      { id: 'v4a', gender: 'male', category_code: 'VAR_4' },
      { id: 'v5', gender: 'male', category_code: 'VAR_5' },
      { id: 'f4', gender: 'female', category_code: 'FEM_4' },
    ]
    const entries = generateRandomLineup(CATS, short, RULES, seededRng(3))
    expect(entries.map((e) => e.category_code)).toEqual(['MIX_A'])
    expect(entryIsEligible(entries[0], short)).toBe(true)
  })

  it('sin jugadores no genera nada', () => {
    expect(generateRandomLineup(CATS, [], RULES, seededRng(5))).toEqual([])
  })
})
