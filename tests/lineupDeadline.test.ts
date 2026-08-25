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

  // Excepción autorizada por la organizadora: la jornada 6 cae en VIERNES y su
  // sábado anterior quedaría casi una semana antes. Debe coincidir con
  // lineup_deadline() del servidor (migración 0048).
  it('jornada 6 (viernes 28-ago-2026) → jueves 27 08:00 MX, no el sábado anterior', () => {
    expect(lineupDeadline('2026-08-28').toISOString()).toBe('2026-08-27T14:00:00.000Z')
    // La fórmula normal habría dado el sábado 22-ago 07:00 MX (13:00 UTC).
    expect(lineupDeadline('2026-08-28').toISOString()).not.toBe('2026-08-22T13:00:00.000Z')
  })

  it('la excepción es SOLO de esa fecha: las jornadas vecinas mantienen el sábado', () => {
    // 2026-08-24 es lunes → sábado 2026-08-22.
    expect(lineupDeadline('2026-08-24').toISOString()).toBe('2026-08-22T13:00:00.000Z')
    // 2026-08-31 es lunes → sábado 2026-08-29.
    expect(lineupDeadline('2026-08-31').toISOString()).toBe('2026-08-29T13:00:00.000Z')
    // Un viernes cualquiera SIN excepción sigue la fórmula: 2026-09-04 → sáb 29-ago.
    expect(lineupDeadline('2026-09-04').toISOString()).toBe('2026-08-29T13:00:00.000Z')
  })

  it('isLineupLocked usa el límite de la excepción en la jornada 6', () => {
    const dl = Date.parse('2026-08-27T14:00:00Z')
    expect(isLineupLocked('2026-08-28', dl - 1000)).toBe(false)
    expect(isLineupLocked('2026-08-28', dl)).toBe(true)
    // Antes seguía abierta bien pasado el viejo límite del sábado 22.
    expect(isLineupLocked('2026-08-28', Date.parse('2026-08-25T00:00:00Z'))).toBe(false)
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
