import { pickDefaultRound } from '@/features/schedule/defaultRound'
import type { Round } from '@/features/schedule/types'

function round(n: number, date: string | null): Round {
  return { id: `j${n}`, season_id: 's1', round_number: n, name: null, round_date: date, status: 'published' }
}

// Temporada 2026: J1 20-jul … J10 28-sep (fechas representativas, una por semana).
const SEASON: Round[] = [
  round(1, '2026-07-20'),
  round(2, '2026-07-27'),
  round(3, '2026-08-03'),
  round(4, '2026-08-10'),
  round(5, '2026-08-17'),
]

describe('pickDefaultRound', () => {
  it('upcoming: el DÍA de una jornada la elige a ella (hoy cuenta como próxima)', () => {
    expect(pickDefaultRound(SEASON, '2026-07-20', 'upcoming')).toBe('j1')
  })

  it('upcoming: entre jornadas elige la siguiente por jugar', () => {
    expect(pickDefaultRound(SEASON, '2026-07-23', 'upcoming')).toBe('j2')
  })

  it('upcoming: antes de empezar la temporada elige la primera', () => {
    expect(pickDefaultRound(SEASON, '2026-07-01', 'upcoming')).toBe('j1')
  })

  it('upcoming: terminada la temporada cae a la última (no queda "próxima")', () => {
    expect(pickDefaultRound(SEASON, '2026-10-01', 'upcoming')).toBe('j5')
  })

  it('recent: el DÍA de una jornada la elige a ella (hoy cuenta como jugada)', () => {
    expect(pickDefaultRound(SEASON, '2026-07-20', 'recent')).toBe('j1')
  })

  it('recent: entre jornadas elige la última jugada, no la próxima', () => {
    expect(pickDefaultRound(SEASON, '2026-07-23', 'recent')).toBe('j1')
  })

  it('recent: antes de la primera jornada cae a la primera', () => {
    expect(pickDefaultRound(SEASON, '2026-07-01', 'recent')).toBe('j1')
  })

  it('recent: terminada la temporada elige la última', () => {
    expect(pickDefaultRound(SEASON, '2026-10-01', 'recent')).toBe('j5')
  })

  it('una jornada sin fecha es "próxima" pero nunca "jugada"', () => {
    const rs = [round(1, '2026-07-20'), round(2, null)]
    expect(pickDefaultRound(rs, '2026-08-01', 'upcoming')).toBe('j2')
    expect(pickDefaultRound(rs, '2026-08-01', 'recent')).toBe('j1')
  })

  it('sin jornadas devuelve undefined', () => {
    expect(pickDefaultRound([], '2026-07-20', 'upcoming')).toBeUndefined()
    expect(pickDefaultRound([], '2026-07-20', 'recent')).toBeUndefined()
  })
})
