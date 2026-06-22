import { deriveResult } from '@/features/results/resultLogic'

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
