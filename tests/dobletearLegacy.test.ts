import { validateLineup } from '@/features/lineups/validateLineup'
import type { EligiblePlayer, EligibilityRule, LineupSelection } from '@/features/lineups/validateLineup'
import type { MatchCategory } from '@/lib/types'

// Reproducción del roster REAL de Legacy (2026-07-21) para diagnosticar el
// reporte "no deja dobletear aun poniendo el botón de excepción".
//
// Legacy va al límite en VAR_4 y FEM_3: 2 jugadores para 2 huecos por jornada.
// Basta una ausencia para que la capitana tenga que repetir a alguien.

const T = 'legacy'
const P = (full_name: string, gender: 'male' | 'female', category_code: string): EligiblePlayer => ({
  id: full_name,
  full_name,
  gender,
  category_code,
  team_id: T,
})

const ROSTER: EligiblePlayer[] = [
  P('Alma', 'female', 'FEM_3'),
  P('Carolina', 'female', 'FEM_3'),
  P('Ana', 'female', 'FEM_4'),
  P('Andrea', 'female', 'FEM_4'),
  P('Mara', 'female', 'FEM_6'),
  P('Nadia', 'female', 'FEM_6'),
  P('Berenice', 'female', 'FEM_7'),
  P('Isabella', 'female', 'FEM_7'),
  P('Ricardo', 'male', 'VAR_4'),
  P('Rogelio', 'male', 'VAR_4'),
  P('Axel', 'male', 'VAR_5'),
  P('Carlos', 'male', 'VAR_5'),
  P('Augusto', 'male', 'VAR_6'),
  P('Diz', 'male', 'VAR_6'),
]

const R = (
  match_category_code: string,
  required_gender: 'male' | 'female',
  required_player_category_code: string,
): EligibilityRule => ({
  match_category_code,
  required_gender,
  required_player_category_code,
  required_count: 1,
})

// Reglas reales (category_eligibility_rules) de las categorías implicadas.
const RULES: EligibilityRule[] = [
  R('SUMA9_VAR', 'male', 'VAR_4'),
  R('SUMA9_VAR', 'male', 'VAR_5'),
  R('MIX_S', 'male', 'VAR_4'),
  R('MIX_S', 'female', 'FEM_3'),
  R('SUMA7_FEM', 'female', 'FEM_3'),
  R('SUMA7_FEM', 'female', 'FEM_4'),
  R('SUMA13_FEM', 'female', 'FEM_6'),
  R('SUMA13_FEM', 'female', 'FEM_7'),
]

const C = (code: string, order: number): MatchCategory => ({
  code,
  name: code,
  type: 'mixta',
  sort_order: order,
  is_active: true,
  is_ranking: false,
  is_match: true,
  match_sort_order: order,
})

// Orden real de match_sort_order.
const CATS: MatchCategory[] = [
  C('SUMA9_VAR', 1),
  C('SUMA7_FEM', 4),
  C('SUMA13_FEM', 5),
  C('MIX_S', 11),
]

const sel = (category_code: string, a: string | null, b: string | null): LineupSelection => ({
  category_code,
  player_1_id: a,
  player_2_id: b,
})

function validar(selections: LineupSelection[], excepciones: string[]) {
  return validateLineup(T, selections, ROSTER, RULES, CATS, new Set(excepciones))
}

// Alineación base válida para las 4 categorías de la prueba.
const BASE = [
  sel('SUMA9_VAR', 'Ricardo', 'Axel'),
  sel('SUMA7_FEM', 'Alma', 'Ana'),
  sel('SUMA13_FEM', 'Mara', 'Berenice'),
  sel('MIX_S', 'Rogelio', 'Carolina'),
]

describe('dobletear con excepción — caso Legacy', () => {
  it('la alineación completa sin repetir a nadie es válida', () => {
    expect(validar(BASE, []).valid).toBe(true)
  })

  it('falta un VAR_4: Ricardo dobletea en MIX_S con excepción', () => {
    // Rogelio no puede jugar. Ricardo (VAR_4) cubre SUMA9_VAR y MIX_S.
    const alineacion = [
      sel('SUMA9_VAR', 'Ricardo', 'Axel'),
      sel('SUMA7_FEM', 'Alma', 'Ana'),
      sel('SUMA13_FEM', 'Mara', 'Berenice'),
      sel('MIX_S', 'Ricardo', 'Carolina'),
    ]
    const r = validar(alineacion, ['MIX_S'])
    expect(r.issues.map((i) => `${i.category_code}:${i.code}`)).toEqual([])
    expect(r.valid).toBe(true)
  })

  it('falta una FEM_3: Alma dobletea en MIX_S con excepción', () => {
    const alineacion = [
      sel('SUMA9_VAR', 'Ricardo', 'Axel'),
      sel('SUMA7_FEM', 'Alma', 'Ana'),
      sel('SUMA13_FEM', 'Mara', 'Berenice'),
      sel('MIX_S', 'Rogelio', 'Alma'),
    ]
    const r = validar(alineacion, ['MIX_S'])
    expect(r.issues.map((i) => `${i.category_code}:${i.code}`)).toEqual([])
    expect(r.valid).toBe(true)
  })

  it('REGRESIÓN: activar la excepción NO puede invalidar una categoría legal', () => {
    // Este era el bug. La capitana marca la excepción en SUMA7_FEM (1 de 3a +
    // 1 de 4a) y el emparejamiento codicioso metía a Ana (4a) en el hueco de 3a
    // —porque con excepción "4a es igual o más débil que 3a" es cierto— y luego
    // Alma (3a) se quedaba sin hueco y salía marcada como no elegible.
    // Resultado: activar la excepción rompía una alineación perfectamente legal.
    const alineacion = [
      sel('SUMA9_VAR', 'Ricardo', 'Axel'),
      sel('SUMA7_FEM', 'Alma', 'Ana'),
      sel('SUMA13_FEM', 'Mara', 'Berenice'),
      sel('MIX_S', 'Rogelio', 'Alma'),
    ]
    expect(validar(alineacion, ['SUMA7_FEM']).issues).toEqual([])
    // Y sigue siendo válida con la excepción en la otra categoría, o sin ninguna
    // (salvo el duplicado, que es justo lo que la excepción permite).
    expect(validar(alineacion, ['MIX_S']).issues).toEqual([])
  })

  it('la excepción sigue rechazando a un jugador MÁS FUERTE que el hueco', () => {
    // El emparejamiento nuevo no debe abrir la puerta a colar a alguien de
    // categoría superior: eso es exactamente lo que la regla evita.
    const alineacion = [
      sel('SUMA9_VAR', 'Ricardo', 'Axel'),
      sel('SUMA7_FEM', 'Alma', 'Ana'),
      sel('SUMA13_FEM', 'Mara', 'Berenice'),
      // Carolina es 3a: más fuerte que el hueco de 4a de SUMA7_FEM.
      sel('MIX_S', 'Rogelio', 'Carolina'),
    ]
    const conFuerte = [
      sel('SUMA7_FEM', 'Alma', 'Carolina'), // 3a + 3a: sobra una para el hueco de 4a
      ...alineacion.filter((s) => s.category_code !== 'SUMA7_FEM'),
    ]
    const r = validar(conFuerte, ['SUMA7_FEM'])
    expect(r.issues.some((i) => i.code === 'ineligible')).toBe(true)
  })

  it('LIMITACIÓN CONOCIDA: la categoría más débil no se puede cubrir por excepción', () => {
    // Sin ninguna FEM_7 disponible, el hueco de FEM_7 de SUMA13_FEM no lo puede
    // llenar nadie: la regla exige "igual o más débil" y FEM_7 ya es la más
    // débil del femenil. Lo mismo pasa con VAR_6 en varonil.
    // Es INTENCIONAL (evita colar a alguien más fuerte), pero deja al equipo sin
    // poder presentar la categoría. Decisión de la organizadora, no un bug.
    const alineacion = [
      sel('SUMA9_VAR', 'Ricardo', 'Axel'),
      sel('SUMA7_FEM', 'Alma', 'Ana'),
      sel('SUMA13_FEM', 'Mara', 'Nadia'), // dos FEM_6
      sel('MIX_S', 'Rogelio', 'Carolina'),
    ]
    const r = validar(alineacion, ['SUMA13_FEM'])
    expect(r.issues.map((i) => `${i.category_code}:${i.code}`)).toEqual([
      'SUMA13_FEM:ineligible',
    ])
  })
})
