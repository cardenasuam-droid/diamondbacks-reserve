import { deriveResult, validPadelSet } from '@/features/results/resultLogic'

describe('validPadelSet', () => {
  it('acepta los marcadores legales de un set', () => {
    // 6 con margen de 2, 7-5 y 7-6 — en ambas direcciones.
    for (const [a, b] of [[6, 0], [6, 4], [7, 5], [7, 6], [0, 6], [4, 6], [5, 7], [6, 7]]) {
      expect(validPadelSet(a, b)).toBe(true)
    }
  })

  it('rechaza marcadores imposibles', () => {
    // 6-5 no existe (a 5-5 se sigue hasta 7); 7-4 tampoco; empates jamás;
    // el dedazo "65-0" es el error de tecleo más probable en la cancha.
    for (const [a, b] of [[6, 5], [5, 6], [7, 4], [4, 7], [6, 6], [7, 7], [5, 5], [0, 0], [8, 6], [65, 0], [-1, 6]]) {
      expect(validPadelSet(a, b)).toBe(false)
    }
  })

  it('rechaza un retiro a media partida (3-1): eso lo captura el organizador', () => {
    expect(validPadelSet(3, 1)).toBe(false)
  })
})

describe('deriveResult — guardas de captura (organizador)', () => {
  it('rechaza el dedazo de rango: "65" en vez de "6"', () => {
    const r = deriveResult([{ a: 65, b: 0 }, { a: 6, b: 1 }])
    expect(r.error).toMatch(/rango/i)
    expect(r.decided).toBe(false)
  })

  it('rechaza un set con un solo marcador capturado', () => {
    const r = deriveResult([{ a: 6, b: null }, { a: 6, b: 1 }])
    expect(r.error).toMatch(/un solo marcador/i)
    expect(r.decided).toBe(false)
  })

  it('sigue aceptando un retiro (3-1): eso lo captura el organizador', () => {
    // El validador estricto de la capitana (validPadelSet) sí lo rechaza; el del
    // organizador solo valida rango, para no atarle las manos ante lo atípico.
    const r = deriveResult([{ a: 3, b: 1 }, { a: 6, b: 2 }])
    expect(r.error).toBeNull()
    expect(r.decided).toBe(true)
    expect(r.winnerSide).toBe('a')
  })

  it('un set vacío del todo no es error (tercero no jugado)', () => {
    const r = deriveResult([{ a: 6, b: 4 }, { a: 6, b: 3 }, { a: null, b: null }])
    expect(r.error).toBeNull()
    expect(r.decided).toBe(true)
  })
})

describe('deriveResult', () => {
  it('marcador vacío: indeciso, sin error', () => {
    const r = deriveResult([])
    expect(r.decided).toBe(false)
    expect(r.winnerSide).toBeNull()
    expect(r.error).toBeNull()
  })

  it('victoria en 2 sets', () => {
    const r = deriveResult([
      { a: 6, b: 4 },
      { a: 6, b: 3 },
    ])
    expect(r).toMatchObject({ setsA: 2, setsB: 0, winnerSide: 'a', decided: true, error: null })
  })

  it('victoria en 3 sets para B', () => {
    const r = deriveResult([
      { a: 6, b: 4 },
      { a: 4, b: 6 },
      { a: 5, b: 7 },
    ])
    expect(r).toMatchObject({ setsA: 1, setsB: 2, winnerSide: 'b', decided: true })
  })

  it('un set incompleto se ignora (sigue indeciso)', () => {
    const r = deriveResult([
      { a: 6, b: 4 },
      { a: null, b: null },
    ])
    expect(r.setsA).toBe(1)
    expect(r.decided).toBe(false)
  })

  it('rechaza set empatado', () => {
    const r = deriveResult([{ a: 6, b: 6 }])
    expect(r.error).toMatch(/empatado/i)
    expect(r.decided).toBe(false)
  })

  it('rechaza marcador negativo', () => {
    const r = deriveResult([{ a: -1, b: 6 }])
    expect(r.error).toMatch(/negativ/i)
  })

  it('rechaza tercer set tras un 2-0', () => {
    const r = deriveResult([
      { a: 6, b: 4 },
      { a: 6, b: 2 },
      { a: 6, b: 1 },
    ])
    expect(r.error).toMatch(/tercero/i)
    expect(r.decided).toBe(false)
  })
})
