import { rankByRating, MIN_PARTIDOS_FIABLE } from '@/features/rating/rankByRating'
import type { RatedPlayer } from '@/features/rating/rankByRating'

function jugador(p: Partial<RatedPlayer> & { id: string; full_name: string }): RatedPlayer {
  return {
    category_code: 'FEM_4',
    team_id: 't1',
    rating: 1800,
    rating_matches: 10,
    ...p,
  }
}

describe('rankByRating', () => {
  it('ordena de mayor a menor rating', () => {
    const filas = rankByRating([
      jugador({ id: '1', full_name: 'Ana', rating: 1700 }),
      jugador({ id: '2', full_name: 'Bea', rating: 2100 }),
      jugador({ id: '3', full_name: 'Cris', rating: 1900 }),
    ])
    expect(filas.map((f) => f.full_name)).toEqual(['Bea', 'Cris', 'Ana'])
    expect(filas.map((f) => f.position)).toEqual([1, 2, 3])
  })

  it('los empates comparten posición y la siguiente salta (1, 2, 2, 4)', () => {
    const filas = rankByRating([
      jugador({ id: '1', full_name: 'Ana', rating: 2000 }),
      jugador({ id: '2', full_name: 'Bea', rating: 1800 }),
      jugador({ id: '3', full_name: 'Cris', rating: 1800 }),
      jugador({ id: '4', full_name: 'Dani', rating: 1500 }),
    ])
    expect(filas.map((f) => f.position)).toEqual([1, 2, 2, 4])
  })

  it('la jornada 1 de una categoría entera sembrada plana queda toda en la misma posición', () => {
    // Los 30 jugadores de 5a varonil arrancan con la semilla idéntica de su
    // categoría: numerarlos del 1 al 30 inventaría un orden que no existe.
    const plana = Array.from({ length: 30 }, (_, i) =>
      jugador({ id: `v${i}`, full_name: `Jugador ${i}`, category_code: 'VAR_5', rating: 1800, rating_matches: 0 }),
    )
    const filas = rankByRating(plana)
    expect(new Set(filas.map((f) => f.position))).toEqual(new Set([1]))
    expect(filas.every((f) => f.provisional)).toBe(true)
  })

  it('a igual rating ordena primero a quien tiene más partidos, aunque compartan posición', () => {
    const filas = rankByRating([
      jugador({ id: '1', full_name: 'Ana', rating: 1800, rating_matches: 2 }),
      jugador({ id: '2', full_name: 'Bea', rating: 1800, rating_matches: 9 }),
    ])
    expect(filas.map((f) => f.full_name)).toEqual(['Bea', 'Ana'])
    expect(filas.map((f) => f.position)).toEqual([1, 1])
  })

  it('a igual rating y partidos desempata alfabéticamente en español', () => {
    const filas = rankByRating([
      jugador({ id: '1', full_name: 'Zulema', rating: 1800 }),
      jugador({ id: '2', full_name: 'Ángela', rating: 1800 }),
      jugador({ id: '3', full_name: 'Ana', rating: 1800 }),
    ])
    expect(filas.map((f) => f.full_name)).toEqual(['Ana', 'Ángela', 'Zulema'])
  })

  it('excluye a quien no tiene rating (lista de espera: la vista devuelve null)', () => {
    const filas = rankByRating([
      jugador({ id: '1', full_name: 'Ana', rating: 1800 }),
      jugador({ id: '2', full_name: 'EnEspera', rating: null }),
    ])
    expect(filas).toHaveLength(1)
    expect(filas[0].full_name).toBe('Ana')
  })

  it('marca provisional por debajo del umbral y definitivo a partir de él', () => {
    const filas = rankByRating([
      jugador({ id: '1', full_name: 'Justa', rating: 1900, rating_matches: MIN_PARTIDOS_FIABLE }),
      jugador({ id: '2', full_name: 'Corta', rating: 1800, rating_matches: MIN_PARTIDOS_FIABLE - 1 }),
    ])
    expect(filas[0].provisional).toBe(false)
    expect(filas[1].provisional).toBe(true)
  })

  it('redondea el rating a entero para mostrarlo', () => {
    const filas = rankByRating([jugador({ id: '1', full_name: 'Ana', rating: 1799.6 })])
    expect(filas[0].rating).toBe(1800)
  })

  it('no muta el arreglo de entrada', () => {
    const entrada = [
      jugador({ id: '1', full_name: 'Ana', rating: 1700 }),
      jugador({ id: '2', full_name: 'Bea', rating: 2100 }),
    ]
    const copia = [...entrada]
    rankByRating(entrada)
    expect(entrada).toEqual(copia)
  })

  it('con la lista vacía devuelve vacío', () => {
    expect(rankByRating([])).toEqual([])
  })
})
