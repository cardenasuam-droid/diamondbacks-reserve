import {
  changedCategories,
  selectionsFromEntries,
  slotRequirements,
} from '@/features/lineups/lineupHelpers'
import type { EligibilityRule, LineupSelection } from '@/features/lineups/validateLineup'
import type { StoredEntry } from '@/features/lineups/types'
import type { MatchCategory } from '@/lib/types'

const CATS: MatchCategory[] = [
  { code: 'VAR_4', name: '4a Varonil', type: 'varonil', sort_order: 1, is_active: true },
  { code: 'MIX_A', name: 'Mixta A', type: 'mixta', sort_order: 8, is_active: true },
]

const RULES: EligibilityRule[] = [
  { match_category_code: 'VAR_4', required_gender: 'male', required_player_category_code: 'VAR_4', required_count: 2 },
  { match_category_code: 'MIX_A', required_gender: 'male', required_player_category_code: 'VAR_5', required_count: 1 },
  { match_category_code: 'MIX_A', required_gender: 'female', required_player_category_code: 'FEM_4', required_count: 1 },
]

describe('selectionsFromEntries', () => {
  it('rellena todas las categorías y respeta lo guardado', () => {
    const entries: StoredEntry[] = [
      { id: 'e1', match_id: 'm1', category_code: 'VAR_4', player_1_id: 'a', player_2_id: 'b' },
    ]
    const map = selectionsFromEntries(entries, CATS)
    expect(map.VAR_4).toEqual({ category_code: 'VAR_4', player_1_id: 'a', player_2_id: 'b' })
    expect(map.MIX_A).toEqual({ category_code: 'MIX_A', player_1_id: null, player_2_id: null })
  })
})

describe('changedCategories', () => {
  const base: Record<string, LineupSelection> = {
    VAR_4: { category_code: 'VAR_4', player_1_id: 'a', player_2_id: 'b' },
    MIX_A: { category_code: 'MIX_A', player_1_id: 'c', player_2_id: 'd' },
  }

  it('no cuenta cambio si solo se invierte el orden de la pareja', () => {
    const next: Record<string, LineupSelection> = {
      ...base,
      VAR_4: { category_code: 'VAR_4', player_1_id: 'b', player_2_id: 'a' },
    }
    expect(changedCategories(base, next, CATS)).toEqual([])
  })

  it('detecta la categoría con pareja distinta', () => {
    const next: Record<string, LineupSelection> = {
      ...base,
      MIX_A: { category_code: 'MIX_A', player_1_id: 'c', player_2_id: 'x' },
    }
    expect(changedCategories(base, next, CATS)).toEqual(['MIX_A'])
  })
})

describe('slotRequirements', () => {
  it('no mixta: dos huecos del mismo perfil', () => {
    expect(slotRequirements('VAR_4', RULES)).toEqual([
      { gender: 'male', category_code: 'VAR_4' },
      { gender: 'male', category_code: 'VAR_4' },
    ])
  })

  it('mixta: un hueco por regla', () => {
    expect(slotRequirements('MIX_A', RULES)).toEqual([
      { gender: 'male', category_code: 'VAR_5' },
      { gender: 'female', category_code: 'FEM_4' },
    ])
  })
})
