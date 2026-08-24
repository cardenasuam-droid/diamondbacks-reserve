import { countDobleteos } from '@/features/lineups/dobleteos'
import type { SeasonEntry, DobleteoPlayer } from '@/features/lineups/dobleteos'
import type { EligibilityRule } from '@/features/lineups/validateLineup'

// Reglas reales de las categorías usadas en los casos (category_eligibility_rules).
const R = (
  match: string,
  gender: 'male' | 'female',
  cat: string,
): EligibilityRule => ({
  match_category_code: match,
  required_gender: gender,
  required_player_category_code: cat,
  required_count: 1,
})

const RULES: EligibilityRule[] = [
  { match_category_code: 'FEM_6', required_gender: 'female', required_player_category_code: 'FEM_6', required_count: 2 },
  { match_category_code: 'FEM_4', required_gender: 'female', required_player_category_code: 'FEM_4', required_count: 2 },
  R('MIX_B', 'male', 'VAR_6'),
  R('MIX_B', 'female', 'FEM_5'),
  R('SUMA13_FEM', 'female', 'FEM_6'),
  R('SUMA13_FEM', 'female', 'FEM_7'),
  R('SUMA9_VAR', 'male', 'VAR_4'),
  R('SUMA9_VAR', 'male', 'VAR_5'),
  R('MIX_A', 'male', 'VAR_5'),
  R('MIX_A', 'female', 'FEM_4'),
  R('MIX_S', 'male', 'VAR_4'),
  R('MIX_S', 'female', 'FEM_3'),
]

const P = (id: string, cat: string, gender: 'male' | 'female' = 'female'): DobleteoPlayer => ({
  id,
  category_code: cat,
  gender,
})

const jugadores = new Map(
  [
    P('celeste', 'FEM_6'),
    P('raul', 'VAR_6', 'male'),
    P('andrea', 'FEM_6'),
    P('priscilla', 'FEM_6'),
    P('olivas', 'FEM_7'),
    P('cris', 'FEM_6'),
    P('luna', 'VAR_5', 'male'),
    P('torres', 'VAR_4', 'male'),
    P('morena', 'FEM_4'),
    P('zayra', 'FEM_4'),
    P('lozoya', 'FEM_3'),
    P('anabelle', 'FEM_4'),
    P('rogelio', 'VAR_4', 'male'),
    P('axel', 'VAR_5', 'male'),
    P('carolina3', 'FEM_3'),
    P('fem5', 'FEM_5'),
    P('otraFem5', 'FEM_5'),
    P('fem4b', 'FEM_4'),
  ].map((p) => [p.id, p]),
)

const E = (
  round: number,
  team: string,
  cat: string,
  p1: string | null,
  p2: string | null,
): SeasonEntry => ({
  round_number: round,
  team_id: team,
  category_code: cat,
  player_1_id: p1,
  player_2_id: p2,
})

describe('countDobleteos — casos reales de la temporada', () => {
  it('sin repeticiones no hay dobleteos', () => {
    const { events, countByTeam } = countDobleteos(
      [E(1, 'passio', 'FEM_6', 'celeste', 'andrea'), E(1, 'passio', 'MIX_B', 'raul', 'fem5')],
      jugadores,
      RULES,
    )
    expect(events).toEqual([])
    expect(countByTeam.size).toBe(0)
  })

  it('Celeste (FEM_6) dobletea en MIX_B cubriendo el hueco de FEM_5: categoría superior, NO cuenta', () => {
    // J3 real de Passio tras el swap: FEM_6 (natural) + MIX_B con Raúl (VAR_6).
    const { events, countByTeam } = countDobleteos(
      [
        E(3, 'passio', 'FEM_6', 'andrea', 'celeste'),
        E(3, 'passio', 'MIX_B', 'raul', 'celeste'),
      ],
      jugadores,
      RULES,
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ player_id: 'celeste', exempt: true, reason: 'categoria_superior' })
    expect(countByTeam.get('passio')).toBeUndefined()
  })

  it('Priscilla (FEM_6) dobletea en su propio nivel (SUMA13 hueco FEM_6 + FEM_6): SÍ cuenta', () => {
    const { events, countByTeam } = countDobleteos(
      [
        E(3, 'pc', 'SUMA13_FEM', 'priscilla', 'olivas'),
        E(3, 'pc', 'FEM_6', 'priscilla', 'cris'),
      ],
      jugadores,
      RULES,
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ player_id: 'priscilla', exempt: false, reason: null })
    expect(countByTeam.get('pc')).toBe(1)
  })

  it('Luna (VAR_5) dobletea Suma 9 + MIX_A, ambos huecos de su nivel: SÍ cuenta', () => {
    // J4 real de Passio tras el swap: Torres (VAR_4) ocupa el hueco de 4a en
    // Suma 9, así que Luna va en el de 5a; en MIX_A Morena (FEM_4) ocupa el
    // femenil, Luna el de 5a. Ninguna aparición es "hacia arriba".
    const { countByTeam } = countDobleteos(
      [
        E(4, 'passio', 'SUMA9_VAR', 'torres', 'luna'),
        E(4, 'passio', 'MIX_A', 'luna', 'morena'),
      ],
      jugadores,
      RULES,
    )
    expect(countByTeam.get('passio')).toBe(1)
  })

  it('Zayra (FEM_4) dobletea FEM_4 + Suma 7 en hueco de FEM_4: SÍ cuenta', () => {
    const reglas = [...RULES, R('SUMA7_FEM', 'female', 'FEM_3'), R('SUMA7_FEM', 'female', 'FEM_4')]
    const { countByTeam } = countDobleteos(
      [
        E(5, 'peak', 'FEM_4', 'anabelle', 'zayra'),
        E(5, 'peak', 'SUMA7_FEM', 'lozoya', 'zayra'),
      ],
      jugadores,
      reglas,
    )
    expect(countByTeam.get('peak')).toBe(1)
  })

  it('un VAR_4 que dobletea está exento (categoría estructuralmente corta)', () => {
    const { events, countByTeam } = countDobleteos(
      [
        E(2, 'legacy', 'SUMA9_VAR', 'rogelio', 'axel'),
        E(2, 'legacy', 'MIX_S', 'rogelio', 'carolina3'),
      ],
      jugadores,
      RULES,
    )
    expect(events[0]).toMatchObject({ player_id: 'rogelio', exempt: true, reason: 'fem3_var4' })
    expect(countByTeam.size).toBe(0)
  })

  it('una FEM_5 que dobletea HACIA ARRIBA (FEM_4) está exenta, con la base bien elegida', () => {
    // Juega FEM_5 (su nivel) y además FEM_4 (superior). La base debe ser la de
    // su nivel para que la aparición extra sea la superior y quede exenta.
    const { events, countByTeam } = countDobleteos(
      [
        E(6, 'eq', 'MIX_B', 'raul', 'fem5'),
        E(6, 'eq', 'FEM_4', 'fem5', 'fem4b'),
      ],
      jugadores,
      RULES,
    )
    expect(events[0]).toMatchObject({ player_id: 'fem5', exempt: true, reason: 'categoria_superior' })
    expect(countByTeam.size).toBe(0)
  })

  it('triple aparición = dos dobleteos, cada uno evaluado por su cuenta', () => {
    const reglas = [...RULES, { match_category_code: 'FEM_5', required_gender: 'female' as const, required_player_category_code: 'FEM_5', required_count: 2 }]
    const { events, countByTeam } = countDobleteos(
      [
        E(7, 'eq', 'FEM_5', 'fem5', 'otraFem5'),   // su nivel (base)
        E(7, 'eq', 'MIX_B', 'raul', 'fem5'),        // su nivel → cuenta
        E(7, 'eq', 'FEM_4', 'fem5', 'fem4b'),       // superior → exenta
      ],
      jugadores,
      reglas,
    )
    expect(events).toHaveLength(2)
    expect(countByTeam.get('eq')).toBe(1)
  })

  it('las jornadas se cuentan por separado: repetir en jornadas distintas no es dobleteo', () => {
    const { events } = countDobleteos(
      [E(1, 'eq', 'FEM_6', 'cris', 'andrea'), E(2, 'eq', 'FEM_6', 'cris', 'andrea')],
      jugadores,
      RULES,
    )
    expect(events).toEqual([])
  })
})
