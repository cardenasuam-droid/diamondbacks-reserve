import {
  validateLineup,
  type EligiblePlayer,
  type EligibilityRule,
  type LineupSelection,
} from '@/features/lineups/validateLineup'
import type { MatchCategory } from '@/lib/types'

// Catálogo real (seed.sql).
const CATEGORIES: MatchCategory[] = [
  { code: 'VAR_4', name: '4a Varonil', type: 'varonil', sort_order: 1, is_active: true, is_ranking: true, is_match: true, match_sort_order: null },
  { code: 'VAR_5', name: '5a Varonil', type: 'varonil', sort_order: 2, is_active: true, is_ranking: true, is_match: true, match_sort_order: null },
  { code: 'VAR_6', name: '6a Varonil', type: 'varonil', sort_order: 3, is_active: true, is_ranking: true, is_match: true, match_sort_order: null },
  { code: 'FEM_4', name: '4a Femenil', type: 'femenil', sort_order: 4, is_active: true, is_ranking: true, is_match: true, match_sort_order: null },
  { code: 'FEM_5', name: '5a Femenil', type: 'femenil', sort_order: 5, is_active: true, is_ranking: true, is_match: true, match_sort_order: null },
  { code: 'FEM_6', name: '6a Femenil', type: 'femenil', sort_order: 6, is_active: true, is_ranking: true, is_match: true, match_sort_order: null },
  { code: 'FEM_7', name: '7a Femenil', type: 'femenil', sort_order: 7, is_active: true, is_ranking: true, is_match: true, match_sort_order: null },
  { code: 'MIX_A', name: 'Mixta A', type: 'mixta', sort_order: 8, is_active: true, is_ranking: true, is_match: true, match_sort_order: null },
  { code: 'MIX_B', name: 'Mixta B', type: 'mixta', sort_order: 9, is_active: true, is_ranking: true, is_match: true, match_sort_order: null },
]

// Reglas de elegibilidad (seed.sql).
const RULES: EligibilityRule[] = [
  { match_category_code: 'VAR_4', required_gender: 'male', required_player_category_code: 'VAR_4', required_count: 2 },
  { match_category_code: 'VAR_5', required_gender: 'male', required_player_category_code: 'VAR_5', required_count: 2 },
  { match_category_code: 'VAR_6', required_gender: 'male', required_player_category_code: 'VAR_6', required_count: 2 },
  { match_category_code: 'FEM_4', required_gender: 'female', required_player_category_code: 'FEM_4', required_count: 2 },
  { match_category_code: 'FEM_5', required_gender: 'female', required_player_category_code: 'FEM_5', required_count: 2 },
  { match_category_code: 'FEM_6', required_gender: 'female', required_player_category_code: 'FEM_6', required_count: 2 },
  { match_category_code: 'FEM_7', required_gender: 'female', required_player_category_code: 'FEM_7', required_count: 2 },
  { match_category_code: 'MIX_A', required_gender: 'male', required_player_category_code: 'VAR_5', required_count: 1 },
  { match_category_code: 'MIX_A', required_gender: 'female', required_player_category_code: 'FEM_4', required_count: 1 },
  { match_category_code: 'MIX_B', required_gender: 'male', required_player_category_code: 'VAR_6', required_count: 1 },
  { match_category_code: 'MIX_B', required_gender: 'female', required_player_category_code: 'FEM_5', required_count: 1 },
]

const TEAM = 'team-1'

// Roster sintético: 3 jugadores por cada categoría de ranking (un equipo real
// tiene ~25). Con 3 por categoría se puede armar una alineación legal de las 9
// categorías sin reutilizar jugadores: las mixtas usan el #3 de su categoría
// base. IDs legibles: p.ej. VAR_5#1, FEM_4#2.
function buildRoster(team = TEAM): EligiblePlayer[] {
  const rankCats: { code: string; gender: 'male' | 'female' }[] = [
    { code: 'VAR_4', gender: 'male' },
    { code: 'VAR_5', gender: 'male' },
    { code: 'VAR_6', gender: 'male' },
    { code: 'FEM_4', gender: 'female' },
    { code: 'FEM_5', gender: 'female' },
    { code: 'FEM_6', gender: 'female' },
    { code: 'FEM_7', gender: 'female' },
  ]
  const roster: EligiblePlayer[] = []
  for (const c of rankCats) {
    for (const n of [1, 2, 3]) {
      roster.push({
        id: `${c.code}#${n}`,
        full_name: `${c.code} jugador ${n}`,
        gender: c.gender,
        category_code: c.code,
        team_id: team,
      })
    }
  }
  return roster
}

// Alineación legal completa: cada categoría con su pareja correcta y sin que
// ningún jugador se repita en la jornada (las mixtas usan el #3).
function legalSelections(): LineupSelection[] {
  return [
    { category_code: 'VAR_4', player_1_id: 'VAR_4#1', player_2_id: 'VAR_4#2' },
    { category_code: 'VAR_5', player_1_id: 'VAR_5#1', player_2_id: 'VAR_5#2' },
    { category_code: 'VAR_6', player_1_id: 'VAR_6#1', player_2_id: 'VAR_6#2' },
    { category_code: 'FEM_4', player_1_id: 'FEM_4#1', player_2_id: 'FEM_4#2' },
    { category_code: 'FEM_5', player_1_id: 'FEM_5#1', player_2_id: 'FEM_5#2' },
    { category_code: 'FEM_6', player_1_id: 'FEM_6#1', player_2_id: 'FEM_6#2' },
    { category_code: 'FEM_7', player_1_id: 'FEM_7#1', player_2_id: 'FEM_7#2' },
    { category_code: 'MIX_A', player_1_id: 'VAR_5#3', player_2_id: 'FEM_4#3' },
    { category_code: 'MIX_B', player_1_id: 'VAR_6#3', player_2_id: 'FEM_5#3' },
  ]
}

describe('validateLineup', () => {
  it('una sola categoría legal no produce issues', () => {
    const sel: LineupSelection[] = [
      { category_code: 'VAR_4', player_1_id: 'VAR_4#1', player_2_id: 'VAR_4#2' },
    ]
    // Validamos solo VAR_4 pasando un catálogo de una categoría.
    const onlyVar4 = CATEGORIES.filter((c) => c.code === 'VAR_4')
    const res = validateLineup(TEAM, sel, buildRoster(), RULES, onlyVar4)
    expect(res.valid).toBe(true)
    expect(res.issues).toEqual([])
    expect(res.completeCategories).toEqual(['VAR_4'])
  })

  it('mixta correcta (1 varonil 5a + 1 femenil 4a) es válida', () => {
    const sel: LineupSelection[] = [
      { category_code: 'MIX_A', player_1_id: 'VAR_5#1', player_2_id: 'FEM_4#1' },
    ]
    const onlyMixA = CATEGORIES.filter((c) => c.code === 'MIX_A')
    const res = validateLineup(TEAM, sel, buildRoster(), RULES, onlyMixA)
    expect(res.valid).toBe(true)
  })

  it('detecta categoría incompleta (falta un jugador)', () => {
    const sel: LineupSelection[] = [
      { category_code: 'VAR_4', player_1_id: 'VAR_4#1', player_2_id: null },
    ]
    const onlyVar4 = CATEGORIES.filter((c) => c.code === 'VAR_4')
    const res = validateLineup(TEAM, sel, buildRoster(), RULES, onlyVar4)
    expect(res.valid).toBe(false)
    expect(res.issues).toHaveLength(1)
    expect(res.issues[0].code).toBe('incomplete')
    expect(res.issues[0].message).toContain('un segundo jugador')
  })

  it('una categoría vacía cuenta como incompleta (la pareja)', () => {
    const onlyVar4 = CATEGORIES.filter((c) => c.code === 'VAR_4')
    const res = validateLineup(TEAM, [], buildRoster(), RULES, onlyVar4)
    expect(res.valid).toBe(false)
    expect(res.issues[0].code).toBe('incomplete')
    expect(res.issues[0].message).toContain('la pareja')
  })

  it('rechaza jugadora femenil en categoría varonil (género)', () => {
    const sel: LineupSelection[] = [
      { category_code: 'VAR_4', player_1_id: 'VAR_4#1', player_2_id: 'FEM_4#1' },
    ]
    const onlyVar4 = CATEGORIES.filter((c) => c.code === 'VAR_4')
    const res = validateLineup(TEAM, sel, buildRoster(), RULES, onlyVar4)
    expect(res.valid).toBe(false)
    const issue = res.issues.find((i) => i.code === 'ineligible')
    expect(issue).toBeTruthy()
    expect(issue!.player_id).toBe('FEM_4#1')
  })

  it('rechaza jugador de categoría de ranking equivocada (VAR_5 en VAR_4)', () => {
    const sel: LineupSelection[] = [
      { category_code: 'VAR_4', player_1_id: 'VAR_4#1', player_2_id: 'VAR_5#1' },
    ]
    const onlyVar4 = CATEGORIES.filter((c) => c.code === 'VAR_4')
    const res = validateLineup(TEAM, sel, buildRoster(), RULES, onlyVar4)
    const issue = res.issues.find((i) => i.code === 'ineligible')
    expect(issue).toBeTruthy()
    expect(issue!.player_id).toBe('VAR_5#1')
    expect(issue!.message).toContain('2 de 4a Varonil')
  })

  it('rechaza mixta mal armada (dos varoniles en MIX_A)', () => {
    const sel: LineupSelection[] = [
      { category_code: 'MIX_A', player_1_id: 'VAR_5#1', player_2_id: 'VAR_5#2' },
    ]
    // Catálogo completo: la descripción del requisito nombra otras categorías
    // (5a Varonil, 4a Femenil), así que necesita resolverlas.
    const res = validateLineup(TEAM, sel, buildRoster(), RULES, CATEGORIES)
    expect(res.valid).toBe(false)
    const issue = res.issues.find((i) => i.code === 'ineligible')
    expect(issue).toBeTruthy()
    // Uno de los dos varoniles ocupa el hueco masculino; el otro sobra (no hay
    // hueco femenil que lo acepte).
    expect(issue!.player_id).toBe('VAR_5#1')
    expect(issue!.message).toContain('1 de 5a Varonil y 1 de 4a Femenil')
  })

  it('impide que un jugador aparezca en dos categorías de la jornada', () => {
    const sel: LineupSelection[] = [
      { category_code: 'VAR_5', player_1_id: 'VAR_5#1', player_2_id: 'VAR_5#2' },
      // VAR_5#1 ya quedó alineado arriba; reaparece en la mixta.
      { category_code: 'MIX_A', player_1_id: 'VAR_5#1', player_2_id: 'FEM_4#1' },
    ]
    const cats = CATEGORIES.filter((c) => c.code === 'VAR_5' || c.code === 'MIX_A')
    const res = validateLineup(TEAM, sel, buildRoster(), RULES, cats)
    const dup = res.issues.find((i) => i.code === 'duplicate_in_round')
    expect(dup).toBeTruthy()
    expect(dup!.category_code).toBe('MIX_A') // se marca en la segunda aparición
    expect(dup!.player_id).toBe('VAR_5#1')
    expect(dup!.message).toContain('5a Varonil') // nombra la primera categoría
  })

  it('detecta el mismo jugador dos veces en una categoría', () => {
    const sel: LineupSelection[] = [
      { category_code: 'VAR_4', player_1_id: 'VAR_4#1', player_2_id: 'VAR_4#1' },
    ]
    const onlyVar4 = CATEGORIES.filter((c) => c.code === 'VAR_4')
    const res = validateLineup(TEAM, sel, buildRoster(), RULES, onlyVar4)
    const dup = res.issues.find((i) => i.code === 'duplicate_in_category')
    expect(dup).toBeTruthy()
    expect(dup!.player_id).toBe('VAR_4#1')
  })

  it('rechaza alinear a un jugador de otro equipo', () => {
    const own = buildRoster(TEAM)
    const foreign: EligiblePlayer = {
      id: 'OTHER#1',
      full_name: 'Rival Ajeno',
      gender: 'male',
      category_code: 'VAR_4',
      team_id: 'team-2',
    }
    const sel: LineupSelection[] = [
      { category_code: 'VAR_4', player_1_id: 'VAR_4#1', player_2_id: 'OTHER#1' },
    ]
    const onlyVar4 = CATEGORIES.filter((c) => c.code === 'VAR_4')
    const res = validateLineup(TEAM, sel, [...own, foreign], RULES, onlyVar4)
    const f = res.issues.find((i) => i.code === 'foreign_player')
    expect(f).toBeTruthy()
    expect(f!.player_id).toBe('OTHER#1')
  })

  it('marca jugador inexistente en el roster', () => {
    const sel: LineupSelection[] = [
      { category_code: 'VAR_4', player_1_id: 'VAR_4#1', player_2_id: 'NOPE' },
    ]
    const onlyVar4 = CATEGORIES.filter((c) => c.code === 'VAR_4')
    const res = validateLineup(TEAM, sel, buildRoster(), RULES, onlyVar4)
    expect(res.issues.find((i) => i.code === 'unknown_player')).toBeTruthy()
  })

  it('alineación completa y legal de las 9 categorías es válida', () => {
    const res = validateLineup(TEAM, legalSelections(), buildRoster(), RULES, CATEGORIES)
    expect(res.issues).toEqual([])
    expect(res.valid).toBe(true)
    expect(res.completeCategories).toHaveLength(9)
  })

  it('sin selección, las 9 categorías quedan incompletas', () => {
    const res = validateLineup(TEAM, [], buildRoster(), RULES, CATEGORIES)
    expect(res.valid).toBe(false)
    expect(res.issues).toHaveLength(9)
    expect(res.issues.every((i) => i.code === 'incomplete')).toBe(true)
    expect(res.completeCategories).toEqual([])
  })
})
