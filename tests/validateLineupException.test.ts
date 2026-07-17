import {
  validateLineup,
  categoryRank,
  type EligiblePlayer,
  type EligibilityRule,
  type LineupSelection,
} from '@/features/lineups/validateLineup'
import type { MatchCategory } from '@/lib/types'

const cat = (code: string, order: number): MatchCategory => ({
  code,
  name: code,
  type: 'varonil',
  sort_order: order,
  is_active: true,
  is_ranking: false,
  is_match: true,
  match_sort_order: order,
})

const P = (id: string, category_code: string, gender: 'male' | 'female' = 'male'): EligiblePlayer => ({
  id,
  full_name: id,
  gender,
  category_code,
  team_id: 'T',
})

const RULES: EligibilityRule[] = [
  { match_category_code: 'VAR_5', required_gender: 'male', required_player_category_code: 'VAR_5', required_count: 2 },
  { match_category_code: 'VAR_6', required_gender: 'male', required_player_category_code: 'VAR_6', required_count: 2 },
]
const CATS = [cat('VAR_5', 2), cat('VAR_6', 3)]

const sel = (category_code: string, p1: string, p2: string): LineupSelection => ({
  category_code,
  player_1_id: p1,
  player_2_id: p2,
})

describe('categoryRank', () => {
  it('extrae el número (mayor = más débil); null si no hay', () => {
    expect(categoryRank('VAR_4')).toBe(4)
    expect(categoryRank('FEM_7')).toBe(7)
    expect(categoryRank('MIX_A')).toBeNull()
  })
})

describe('validateLineup — excepción', () => {
  it('SIN excepción, un jugador fuera de categoría es inelegible', () => {
    const roster = [P('a', 'VAR_6'), P('b', 'VAR_5')]
    const v = validateLineup('T', [sel('VAR_5', 'a', 'b')], roster, RULES, [cat('VAR_5', 2)])
    expect(v.valid).toBe(false)
    expect(v.issues.some((i) => i.code === 'ineligible' && i.player_id === 'a')).toBe(true)
  })

  it('CON excepción, un jugador más DÉBIL (número mayor) sí se permite', () => {
    const roster = [P('a', 'VAR_6'), P('b', 'VAR_5')]
    const v = validateLineup('T', [sel('VAR_5', 'a', 'b')], roster, RULES, [cat('VAR_5', 2)], new Set(['VAR_5']))
    expect(v.valid).toBe(true)
  })

  it('CON excepción, un jugador más FUERTE (número menor) sigue siendo inválido', () => {
    const roster = [P('c', 'VAR_4'), P('b', 'VAR_5')]
    const v = validateLineup('T', [sel('VAR_5', 'c', 'b')], roster, RULES, [cat('VAR_5', 2)], new Set(['VAR_5']))
    expect(v.valid).toBe(false)
    expect(v.issues.some((i) => i.code === 'ineligible' && i.player_id === 'c')).toBe(true)
  })

  it('CON excepción, el género sigue siendo obligatorio', () => {
    const roster = [P('f', 'VAR_6', 'female'), P('b', 'VAR_5')]
    const v = validateLineup('T', [sel('VAR_5', 'f', 'b')], roster, RULES, [cat('VAR_5', 2)], new Set(['VAR_5']))
    expect(v.valid).toBe(false)
    expect(v.issues.some((i) => i.code === 'ineligible' && i.player_id === 'f')).toBe(true)
  })

  it('permite DOBLETEAR: un 6a juega su VAR_6 y dobla por excepción en VAR_5', () => {
    const roster = [P('a', 'VAR_6'), P('b', 'VAR_6'), P('x', 'VAR_5')]
    const v = validateLineup(
      'T',
      [sel('VAR_5', 'a', 'x'), sel('VAR_6', 'a', 'b')],
      roster,
      RULES,
      CATS,
      new Set(['VAR_5']),
    )
    expect(v.valid).toBe(true)
  })

  it('SIN excepción, el mismo jugador en dos categorías se marca como duplicado', () => {
    const roster = [P('a', 'VAR_6'), P('b', 'VAR_6'), P('x', 'VAR_5'), P('y', 'VAR_5')]
    const v = validateLineup(
      'T',
      [sel('VAR_5', 'a', 'x'), sel('VAR_6', 'a', 'b')],
      roster,
      RULES,
      CATS,
    )
    expect(v.valid).toBe(false)
    // a está en VAR_5 (fuera de cat) y repetido en VAR_6; sin excepción, inválido.
    expect(v.issues.some((i) => i.code === 'duplicate_in_round' || i.code === 'ineligible')).toBe(true)
  })
})
