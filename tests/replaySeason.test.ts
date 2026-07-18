import { replaySeason, ordenCronologico } from '@/features/rating/replaySeason'
import type { RatingMatch } from '@/features/rating/replaySeason'
import { DEFAULT_RATING_SETTINGS } from '@/features/rating/computeRating'

function partido(p: Partial<RatingMatch> & { match_id: string }): RatingMatch {
  return {
    season_id: 'temp1',
    round_id: 'j1',
    round_number: 1,
    scheduled_at: '2026-07-20T18:30:00Z',
    category_code: 'FEM_4',
    team_a_id: 'A',
    team_b_id: 'B',
    sets: [{ a: 6, b: 3 }, { a: 6, b: 4 }, { a: null, b: null }],
    result_status: 'validated',
    is_walkover: false,
    pair_a: ['a1', 'a2'],
    pair_b: ['b1', 'b2'],
    ...p,
  }
}

const SEMILLAS = new Map([
  ['a1', 1800],
  ['a2', 1800],
  ['b1', 1800],
  ['b2', 1800],
])

function suma(m: Map<string, { rating: number; matches: number }>): number {
  let t = 0
  for (const v of m.values()) t += v.rating
  return t
}

describe('replaySeason', () => {
  it('reparte el mismo delta a los dos de la pareja', () => {
    const { events } = replaySeason({ seeds: SEMILLAS, matches: [partido({ match_id: 'm1' })] })
    expect(events).toHaveLength(4)
    const ganadores = events.filter((e) => e.won)
    expect(ganadores).toHaveLength(2)
    expect(ganadores[0].delta).toBe(ganadores[1].delta)
  })

  it('SUMA CERO: el total de rating de la liga no cambia con los partidos', () => {
    const antes = 1800 * 4
    const { finales } = replaySeason({
      seeds: SEMILLAS,
      matches: [
        partido({ match_id: 'm1' }),
        partido({ match_id: 'm2', round_number: 2, round_id: 'j2', sets: [{ a: 1, b: 6 }, { a: 4, b: 6 }, { a: null, b: null }] }),
        partido({ match_id: 'm3', round_number: 3, round_id: 'j3', sets: [{ a: 7, b: 6 }, { a: 3, b: 6 }, { a: 7, b: 5 }] }),
      ],
    })
    expect(suma(finales)).toBe(antes)
  })

  it('la suma cero aguanta con ratings dispares y muchos partidos', () => {
    const seeds = new Map([['a1', 2436], ['a2', 704], ['b1', 1153], ['b2', 1978]])
    const matches = Array.from({ length: 30 }, (_, i) =>
      partido({
        match_id: `m${i}`,
        round_number: (i % 10) + 1,
        round_id: `j${(i % 10) + 1}`,
        sets: i % 3 === 0
          ? [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 7, b: 5 }]
          : i % 3 === 1
            ? [{ a: 0, b: 6 }, { a: 2, b: 6 }, { a: null, b: null }]
            : [{ a: 6, b: 0 }, { a: 6, b: 1 }, { a: null, b: null }],
      }),
    )
    const { finales } = replaySeason({ seeds, matches })
    expect(suma(finales)).toBe(2436 + 704 + 1153 + 1978)
  })

  it('los ratings se quedan en enteros', () => {
    const seeds = new Map([['a1', 2436], ['a2', 1444], ['b1', 923], ['b2', 1717]])
    const { finales, events } = replaySeason({
      seeds,
      matches: [partido({ match_id: 'm1' }), partido({ match_id: 'm2', round_number: 2, round_id: 'j2' })],
    })
    for (const v of finales.values()) expect(Number.isInteger(v.rating)).toBe(true)
    for (const e of events) expect(Number.isInteger(e.rating_after)).toBe(true)
  })

  it('descarta el walkover y lo reporta', () => {
    const { events, descartes, finales } = replaySeason({
      seeds: SEMILLAS,
      matches: [partido({ match_id: 'm1', is_walkover: true, result_status: 'walkover', sets: [{ a: null, b: null }, { a: null, b: null }, { a: null, b: null }] })],
    })
    expect(events).toHaveLength(0)
    expect(descartes).toEqual([{ match_id: 'm1', motivo: 'walkover' }])
    expect(finales.get('a1')?.rating).toBe(1800)
  })

  it('cuenta el walkover si se activa en los ajustes', () => {
    const { events } = replaySeason({
      seeds: SEMILLAS,
      matches: [partido({ match_id: 'm1', is_walkover: true, result_status: 'walkover', sets: [{ a: 6, b: 0 }, { a: 6, b: 0 }, { a: null, b: null }] })],
      settings: { ...DEFAULT_RATING_SETTINGS, count_walkovers: true },
    })
    expect(events).toHaveLength(4)
  })

  it('descarta el partido sin alineación en vez de inventarse la pareja', () => {
    const { events, descartes } = replaySeason({
      seeds: SEMILLAS,
      matches: [partido({ match_id: 'm1', pair_b: null })],
    })
    expect(events).toHaveLength(0)
    expect(descartes[0].motivo).toBe('sin_alineacion')
  })

  it('descarta el resultado no oficial', () => {
    const { descartes } = replaySeason({
      seeds: SEMILLAS,
      matches: [partido({ match_id: 'm1', result_status: 'reported' })],
    })
    expect(descartes[0].motivo).toBe('no_oficial')
  })

  it('descarta el marcador que no decide ganador', () => {
    const { descartes } = replaySeason({
      seeds: SEMILLAS,
      matches: [partido({ match_id: 'm1', sets: [{ a: 6, b: 3 }, { a: 3, b: 6 }, { a: null, b: null }] })],
    })
    expect(descartes[0].motivo).toBe('marcador_indeciso')
  })

  it('descarta el partido con un jugador sin semilla', () => {
    const { descartes } = replaySeason({
      seeds: SEMILLAS,
      matches: [partido({ match_id: 'm1', pair_b: ['b1', 'desconocido'] })],
    })
    expect(descartes[0].motivo).toBe('jugador_sin_semilla')
  })

  it('procesa los partidos en orden cronológico, no en el orden recibido', () => {
    // El mismo par de partidos en orden inverso debe dar el mismo resultado.
    const m1 = partido({ match_id: 'm1', round_number: 1, round_id: 'j1' })
    const m2 = partido({ match_id: 'm2', round_number: 2, round_id: 'j2', sets: [{ a: 2, b: 6 }, { a: 4, b: 6 }, { a: null, b: null }] })
    const enOrden = replaySeason({ seeds: SEMILLAS, matches: [m1, m2] })
    const alReves = replaySeason({ seeds: SEMILLAS, matches: [m2, m1] })
    expect(alReves.finales.get('a1')).toEqual(enOrden.finales.get('a1'))
    expect(alReves.events.map((e) => e.match_id)).toEqual(enOrden.events.map((e) => e.match_id))
  })

  it('es determinista: dos corridas idénticas dan lo mismo', () => {
    const matches = [partido({ match_id: 'm1' }), partido({ match_id: 'm2', round_number: 2, round_id: 'j2' })]
    const a = replaySeason({ seeds: SEMILLAS, matches })
    const b = replaySeason({ seeds: SEMILLAS, matches })
    expect(b.events).toEqual(a.events)
    expect([...b.finales]).toEqual([...a.finales])
  })

  it('cuenta los partidos que sí movieron el rating', () => {
    const { finales } = replaySeason({
      seeds: SEMILLAS,
      matches: [
        partido({ match_id: 'm1' }),
        partido({ match_id: 'm2', round_number: 2, round_id: 'j2', is_walkover: true, result_status: 'walkover' }),
      ],
    })
    expect(finales.get('a1')?.matches).toBe(1)
  })

  it('quien no juega conserva su semilla y queda con 0 partidos', () => {
    const seeds = new Map([...SEMILLAS, ['sinjugar', 1234]])
    const { finales } = replaySeason({ seeds, matches: [partido({ match_id: 'm1' })] })
    expect(finales.get('sinjugar')).toEqual({ rating: 1234, matches: 0 })
  })

  it('aplica un ajuste manual ANTES de los partidos de su jornada', () => {
    const conAjuste = replaySeason({
      seeds: SEMILLAS,
      matches: [partido({ match_id: 'm1', round_number: 1 })],
      adjustments: [{ player_id: 'a1', round_number: 1, delta: 200 }],
    })
    // El ajuste sube a a1, así que la pareja A parte más fuerte y su victoria
    // esperada mueve MENOS que sin ajuste.
    const sinAjuste = replaySeason({ seeds: SEMILLAS, matches: [partido({ match_id: 'm1', round_number: 1 })] })
    const dCon = conAjuste.events.find((e) => e.player_id === 'a1')?.delta as number
    const dSin = sinAjuste.events.find((e) => e.player_id === 'a1')?.delta as number
    expect(dCon).toBeLessThan(dSin)
    expect(conAjuste.events.find((e) => e.player_id === 'a1')?.rating_before).toBe(2000)
  })

  it('un ajuste sin jornada aplica antes de todo', () => {
    const { events } = replaySeason({
      seeds: SEMILLAS,
      matches: [partido({ match_id: 'm1', round_number: 1 })],
      adjustments: [{ player_id: 'b1', round_number: null, delta: -300 }],
    })
    expect(events.find((e) => e.player_id === 'b1')?.rating_before).toBe(1500)
  })

  it('un ajuste posterior a la última jornada igual cuenta en el rating final', () => {
    const { finales } = replaySeason({
      seeds: SEMILLAS,
      matches: [partido({ match_id: 'm1', round_number: 1 })],
      adjustments: [{ player_id: 'a1', round_number: 9, delta: 50 }],
    })
    const conMatch = replaySeason({ seeds: SEMILLAS, matches: [partido({ match_id: 'm1', round_number: 1 })] })
    expect(finales.get('a1')?.rating).toBe((conMatch.finales.get('a1')?.rating as number) + 50)
  })

  it('el ajuste manual rompe la suma cero a propósito: es una decisión humana', () => {
    const { finales } = replaySeason({
      seeds: SEMILLAS,
      matches: [],
      adjustments: [{ player_id: 'a1', round_number: null, delta: 120 }],
    })
    expect(suma(finales)).toBe(1800 * 4 + 120)
  })

  it('guarda expected desde la perspectiva de cada jugador', () => {
    const { events } = replaySeason({ seeds: SEMILLAS, matches: [partido({ match_id: 'm1' })] })
    const gana = events.find((e) => e.won) as (typeof events)[number]
    const pierde = events.find((e) => !e.won) as (typeof events)[number]
    expect(gana.expected + pierde.expected).toBeCloseTo(1, 10)
  })

  it('sin partidos devuelve las semillas intactas', () => {
    const { events, finales, descartes } = replaySeason({ seeds: SEMILLAS, matches: [] })
    expect(events).toHaveLength(0)
    expect(descartes).toHaveLength(0)
    expect(finales.get('a1')?.rating).toBe(1800)
  })
})

describe('ordenCronologico', () => {
  it('ordena por jornada antes que por horario', () => {
    const a = partido({ match_id: 'a', round_number: 2, scheduled_at: '2026-07-20T18:30:00Z' })
    const b = partido({ match_id: 'b', round_number: 1, scheduled_at: '2026-09-28T21:00:00Z' })
    expect(ordenCronologico(a, b)).toBeGreaterThan(0)
  })

  it('dentro de la jornada ordena por horario', () => {
    const a = partido({ match_id: 'a', scheduled_at: '2026-07-20T21:00:00Z' })
    const b = partido({ match_id: 'b', scheduled_at: '2026-07-20T18:30:00Z' })
    expect(ordenCronologico(a, b)).toBeGreaterThan(0)
  })

  it('los partidos sin horario van al final de su jornada', () => {
    const a = partido({ match_id: 'a', scheduled_at: null })
    const b = partido({ match_id: 'b', scheduled_at: '2026-07-20T21:00:00Z' })
    expect(ordenCronologico(a, b)).toBeGreaterThan(0)
  })

  it('a igual jornada y horario desempata por id, para ser determinista', () => {
    const a = partido({ match_id: 'aaa' })
    const b = partido({ match_id: 'bbb' })
    expect(ordenCronologico(a, b)).toBeLessThan(0)
  })
})
