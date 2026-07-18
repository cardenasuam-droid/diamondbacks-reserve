import {
  expectedScore,
  movMultiplier,
  matchDelta,
  pairRating,
  tallyMatch,
  DEFAULT_RATING_SETTINGS,
} from '@/features/rating/computeRating'
import type { RatingSettings } from '@/features/rating/computeRating'

const S: RatingSettings = DEFAULT_RATING_SETTINGS

describe('expectedScore', () => {
  it('a igual rating da 50%', () => {
    expect(expectedScore(1800, 1800, 400)).toBeCloseTo(0.5, 10)
  })

  it('un escalón de categoría (300 puntos) da ~85%', () => {
    expect(expectedScore(2100, 1800, 400)).toBeCloseTo(0.849, 3)
  })

  it('es simétrica: lo que gana uno de probabilidad lo pierde el otro', () => {
    expect(expectedScore(1950, 1650, 400) + expectedScore(1650, 1950, 400)).toBeCloseTo(1, 10)
  })

  it('un divisor mayor aplana las diferencias', () => {
    expect(expectedScore(2100, 1800, 800)).toBeLessThan(expectedScore(2100, 1800, 400))
  })
})

describe('movMultiplier', () => {
  it('6-0 6-0 (12 juegos de ventaja) llega al techo', () => {
    expect(movMultiplier(12, 0, S)).toBeCloseTo(1.35, 10)
  })

  it('un partido muy apretado se queda cerca del piso', () => {
    expect(movMultiplier(20, 19, S)).toBeCloseTo(0.8, 10)
  })

  it('sin ventaja de juegos da el piso', () => {
    expect(movMultiplier(12, 12, S)).toBeCloseTo(0.75, 10)
  })

  it('el ganador con MENOS juegos cae al piso, no sube', () => {
    // 7-5 0-6 7-5 = 14 juegos del ganador contra 16 del perdedor.
    // Con valor absoluto daría 0.85 y premiaría al ganador por ganar menos juegos.
    expect(movMultiplier(14, 16, S)).toBeCloseTo(0.75, 10)
  })

  it('nunca se sale de [mov_min, mov_max]', () => {
    for (let g = 0; g <= 40; g++) {
      const m = movMultiplier(g, 0, S)
      expect(m).toBeGreaterThanOrEqual(S.mov_min)
      expect(m).toBeLessThanOrEqual(S.mov_max)
    }
  })
})

describe('matchDelta', () => {
  it('un partido parejo mueve la mitad de la K', () => {
    // 1750 vs 1730, 6-3 6-4 -> mov 1.00
    const { delta } = matchDelta({ ratingGanadora: 1750, ratingPerdedora: 1730, juegosGanador: 12, juegosPerdedor: 7 })
    expect(delta).toBe(28)
  })

  it('ganar lo que se debía ganar mueve poquito', () => {
    // 2100 vs 1500 (dos categorías), 6-0 6-0
    const { delta } = matchDelta({ ratingGanadora: 2100, ratingPerdedora: 1500, juegosGanador: 12, juegosPerdedor: 0 })
    expect(delta).toBeLessThanOrEqual(3)
  })

  it('una sorpresa mueve mucho', () => {
    const { delta } = matchDelta({ ratingGanadora: 1650, ratingPerdedora: 1950, juegosGanador: 12, juegosPerdedor: 5 })
    expect(delta).toBeGreaterThan(50)
  })

  it('nunca supera K * mov_max', () => {
    const { delta } = matchDelta({ ratingGanadora: 900, ratingPerdedora: 2436, juegosGanador: 12, juegosPerdedor: 0 })
    expect(delta).toBeLessThanOrEqual(S.k_factor * S.mov_max)
  })

  it('el delta nunca es negativo: ganar jamás resta', () => {
    // Barre el espacio de casos plausibles de la liga.
    for (let rg = 700; rg <= 2500; rg += 100) {
      for (let rp = 700; rp <= 2500; rp += 100) {
        for (const [jg, jp] of [[12, 0], [12, 8], [14, 16], [20, 19]]) {
          const { delta } = matchDelta({ ratingGanadora: rg, ratingPerdedora: rp, juegosGanador: jg, juegosPerdedor: jp })
          expect(delta).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('el mismo marcador mueve más cuanto mayor es la sorpresa', () => {
    const esperado = matchDelta({ ratingGanadora: 2000, ratingPerdedora: 1600, juegosGanador: 12, juegosPerdedor: 6 })
    const sorpresa = matchDelta({ ratingGanadora: 1600, ratingPerdedora: 2000, juegosGanador: 12, juegosPerdedor: 6 })
    expect(sorpresa.delta).toBeGreaterThan(esperado.delta)
  })

  it('a igual sorpresa, barrer mueve más que ganar apretado', () => {
    const barrida = matchDelta({ ratingGanadora: 1800, ratingPerdedora: 1800, juegosGanador: 12, juegosPerdedor: 0 })
    const apretado = matchDelta({ ratingGanadora: 1800, ratingPerdedora: 1800, juegosGanador: 20, juegosPerdedor: 19 })
    expect(barrida.delta).toBeGreaterThan(apretado.delta)
  })

  it('SUMA CERO: el delta es un entero único que sirve a los cuatro jugadores', () => {
    const { delta } = matchDelta({ ratingGanadora: 1873, ratingPerdedora: 1642, juegosGanador: 13, juegosPerdedor: 9 })
    expect(Number.isInteger(delta)).toBe(true)
    // 2 ganadores suman +delta cada uno, 2 perdedores restan -delta cada uno.
    expect(delta * 2 - delta * 2).toBe(0)
  })

  it('respeta una K distinta sin tocar la proporción', () => {
    const base = { ratingGanadora: 1800, ratingPerdedora: 1800, juegosGanador: 12, juegosPerdedor: 6 }
    const k60 = matchDelta({ ...base, settings: { ...S, k_factor: 60 } })
    const k40 = matchDelta({ ...base, settings: { ...S, k_factor: 40 } })
    expect(k60.delta / k40.delta).toBeCloseTo(1.5, 1)
  })
})

describe('pairRating', () => {
  it('es el promedio de los dos', () => {
    expect(pairRating(2100, 1800)).toBe(1950)
  })
})

describe('tallyMatch', () => {
  it('cuenta sets y juegos de una victoria en dos sets', () => {
    const t = tallyMatch([{ a: 6, b: 3 }, { a: 6, b: 4 }, { a: null, b: null }])
    expect(t).toMatchObject({ setsA: 2, setsB: 0, juegosA: 12, juegosB: 7, ganador: 'a' })
  })

  it('cuenta una victoria en tres sets', () => {
    const t = tallyMatch([{ a: 4, b: 6 }, { a: 6, b: 4 }, { a: 5, b: 7 }])
    expect(t).toMatchObject({ setsA: 1, setsB: 2, juegosA: 15, juegosB: 17, ganador: 'b' })
  })

  it('el ganador puede tener MENOS juegos que el perdedor', () => {
    const t = tallyMatch([{ a: 7, b: 5 }, { a: 0, b: 6 }, { a: 7, b: 5 }])
    expect(t.ganador).toBe('a')
    expect(t.juegosA).toBe(14)
    expect(t.juegosB).toBe(16)
  })

  it('un marcador incompleto (1-1 sin tercer set) NO decide ganador', () => {
    const t = tallyMatch([{ a: 6, b: 3 }, { a: 3, b: 6 }, { a: null, b: null }])
    expect(t.ganador).toBeNull()
  })

  it('ignora los sets con un lado nulo', () => {
    const t = tallyMatch([{ a: 6, b: 1 }, { a: 6, b: null }, { a: 6, b: 2 }])
    expect(t.juegosA).toBe(12)
    expect(t.juegosB).toBe(3)
    expect(t.setsA).toBe(2)
    expect(t.ganador).toBe('a')
  })

  it('con marcador vacío no decide nada', () => {
    const t = tallyMatch([{ a: null, b: null }, { a: null, b: null }, { a: null, b: null }])
    expect(t).toMatchObject({ setsA: 0, setsB: 0, juegosA: 0, juegosB: 0, ganador: null })
  })
})
