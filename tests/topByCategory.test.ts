import { rankByRating, topByCategory } from '@/features/rating/rankByRating'
import type { RatedPlayer } from '@/features/rating/rankByRating'

function jugador(p: Partial<RatedPlayer> & { id: string; full_name: string }): RatedPlayer {
  return {
    category_code: 'FEM_4',
    team_id: 't1',
    rating: 1800,
    rating_matches: 5,
    ...p,
  }
}

describe('topByCategory', () => {
  it('agrupa por categoría y devuelve el top N de cada una', () => {
    const filas = rankByRating([
      jugador({ id: 'a', full_name: 'A', category_code: 'FEM_3', rating: 2400 }),
      jugador({ id: 'b', full_name: 'B', category_code: 'FEM_3', rating: 2200 }),
      jugador({ id: 'c', full_name: 'C', category_code: 'FEM_3', rating: 2100 }),
      jugador({ id: 'd', full_name: 'D', category_code: 'FEM_3', rating: 2000 }),
      jugador({ id: 'e', full_name: 'E', category_code: 'VAR_6', rating: 1500 }),
    ])
    const top = topByCategory(filas, 3)
    expect(top.get('FEM_3')!.map((r) => r.id)).toEqual(['a', 'b', 'c']) // el 4º queda fuera
    expect(top.get('VAR_6')!.map((r) => r.id)).toEqual(['e'])
  })

  it('la posición es LOCAL a la categoría, no la global', () => {
    // B es 2º global, pero 1º de su categoría.
    const filas = rankByRating([
      jugador({ id: 'a', full_name: 'A', category_code: 'FEM_3', rating: 2400 }),
      jugador({ id: 'b', full_name: 'B', category_code: 'VAR_6', rating: 1600 }),
      jugador({ id: 'c', full_name: 'C', category_code: 'VAR_6', rating: 1500 }),
    ])
    const top = topByCategory(filas, 3)
    expect(top.get('VAR_6')!.map((r) => r.position)).toEqual([1, 2])
  })

  it('una categoría sembrada plana sale con las tres en posición 1 (empate honesto)', () => {
    // Los varoniles antes de jugar: todos al mismo rating de semilla.
    const filas = rankByRating(
      ['Aldo', 'Beto', 'Caro', 'Dario'].map((n, i) =>
        jugador({ id: `v${i}`, full_name: n, category_code: 'VAR_5', rating: 1800, rating_matches: 0 }),
      ),
    )
    const top = topByCategory(filas, 3)
    expect(top.get('VAR_5')!.map((r) => r.position)).toEqual([1, 1, 1])
  })

  it('un empate parcial comparte posición (1, 2, 2)', () => {
    const filas = rankByRating([
      jugador({ id: 'a', full_name: 'A', category_code: 'FEM_5', rating: 1600 }),
      jugador({ id: 'b', full_name: 'B', category_code: 'FEM_5', rating: 1500 }),
      jugador({ id: 'c', full_name: 'C', category_code: 'FEM_5', rating: 1500 }),
    ])
    const top = topByCategory(filas, 3)
    expect(top.get('FEM_5')!.map((r) => r.position)).toEqual([1, 2, 2])
  })

  it('con menos de N jugadores devuelve los que haya', () => {
    const filas = rankByRating([
      jugador({ id: 'a', full_name: 'A', category_code: 'FEM_7', rating: 900 }),
    ])
    expect(topByCategory(filas, 3).get('FEM_7')).toHaveLength(1)
  })

  it('lista vacía → mapa vacío', () => {
    expect(topByCategory([], 3).size).toBe(0)
  })
})
