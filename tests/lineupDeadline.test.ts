import { lineupDeadline, isLineupLocked } from '@/features/lineups/lineupHelpers'

// El límite es el sábado inmediatamente anterior a la jornada, 07:00 hora de
// México (UTC-6, sin horario de verano) → 13:00 UTC.
describe('lineupDeadline', () => {
  it('jornada en lunes → sábado anterior 07:00 MX', () => {
    // 2026-07-20 es lunes → sábado 2026-07-18.
    expect(lineupDeadline('2026-07-20').toISOString()).toBe('2026-07-18T13:00:00.000Z')
  })

  it('jornada en domingo → el sábado es el día anterior', () => {
    // 2026-07-19 es domingo → sábado 2026-07-18.
    expect(lineupDeadline('2026-07-19').toISOString()).toBe('2026-07-18T13:00:00.000Z')
  })

  it('jornada en sábado → retrocede al sábado ANTERIOR (estrictamente)', () => {
    // 2026-07-18 es sábado → sábado previo 2026-07-11.
    expect(lineupDeadline('2026-07-18').toISOString()).toBe('2026-07-11T13:00:00.000Z')
  })

  it('todas las jornadas 2026 (lunes) caen el sábado dos días antes', () => {
    expect(lineupDeadline('2026-07-27').toISOString()).toBe('2026-07-25T13:00:00.000Z')
    expect(lineupDeadline('2026-09-21').toISOString()).toBe('2026-09-19T13:00:00.000Z')
  })

  it('isLineupLocked: false antes del límite, true en/después; sin fecha no bloquea', () => {
    const dl = lineupDeadline('2026-07-20').getTime()
    expect(isLineupLocked('2026-07-20', dl - 1000)).toBe(false)
    expect(isLineupLocked('2026-07-20', dl)).toBe(true)
    expect(isLineupLocked('2026-07-20', dl + 1000)).toBe(true)
    expect(isLineupLocked(null)).toBe(false)
    expect(isLineupLocked(undefined)).toBe(false)
  })
})
