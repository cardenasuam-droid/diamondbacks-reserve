import { generateDraftSlots } from '@/features/draft/draftSlots'
import { remainingMs, remainingSeconds } from '@/features/draft/clock'

describe('generateDraftSlots (snake)', () => {
  it('invierte el orden cada ronda', () => {
    const slots = generateDraftSlots(
      [{ id: 'A' }, { id: 'B' }],
      [{ code: 'VAR_4', count: 4 }],
    )
    expect(slots.map((s) => s.team_id)).toEqual(['A', 'B', 'B', 'A'])
    expect(slots.map((s) => s.pick_number)).toEqual([1, 2, 3, 4])
    expect(slots.map((s) => s.round)).toEqual([1, 1, 2, 2])
  })

  it('última ronda parcial cuando el conteo no es divisible', () => {
    const slots = generateDraftSlots([{ id: 'A' }, { id: 'B' }], [{ code: 'VAR_4', count: 3 }])
    expect(slots.map((s) => s.team_id)).toEqual(['A', 'B', 'B'])
  })

  it('reparte 3 equipos en snake', () => {
    const slots = generateDraftSlots(
      [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      [{ code: 'VAR_4', count: 6 }],
    )
    expect(slots.map((s) => s.team_id)).toEqual(['A', 'B', 'C', 'C', 'B', 'A'])
  })

  it('encadena categorías en orden, pick_number continuo y omite las vacías', () => {
    const slots = generateDraftSlots(
      [{ id: 'A' }, { id: 'B' }],
      [
        { code: 'VAR_4', count: 2 },
        { code: 'VAR_5', count: 0 }, // se omite
        { code: 'FEM_4', count: 1 },
      ],
    )
    expect(slots.map((s) => `${s.category_code}:${s.team_id}`)).toEqual([
      'VAR_4:A',
      'VAR_4:B',
      'FEM_4:A',
    ])
    expect(slots.map((s) => s.pick_number)).toEqual([1, 2, 3])
  })

  it('1 solo equipo recibe a todos', () => {
    const slots = generateDraftSlots([{ id: 'A' }], [{ code: 'VAR_4', count: 3 }])
    expect(slots.map((s) => s.team_id)).toEqual(['A', 'A', 'A'])
    expect(slots.map((s) => s.round)).toEqual([1, 2, 3])
  })

  it('sin equipos no genera slots', () => {
    expect(generateDraftSlots([], [{ code: 'VAR_4', count: 3 }])).toEqual([])
  })
})

describe('remainingMs', () => {
  it('cuenta el tiempo restante y nunca es negativo', () => {
    const now = 1_000_000
    expect(remainingMs(new Date(now + 5000).toISOString(), now)).toBe(5000)
    expect(remainingMs(new Date(now - 5000).toISOString(), now)).toBe(0)
    expect(remainingMs(null, now)).toBe(0)
    expect(remainingSeconds(new Date(now + 4200).toISOString(), now)).toBe(5)
  })
})
