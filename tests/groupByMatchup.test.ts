import { groupByMatchup } from '@/features/schedule/groupByMatchup'
import type { ScheduledMatch } from '@/features/schedule/types'

function match(p: {
  id: string
  muId: string
  teamA: string
  teamB: string
  cat: string
  sort: number
  /** Turno horario (time_blocks.sort_order). Sin él, el partido no tiene hora. */
  turno?: number
}): ScheduledMatch {
  return {
    id: p.id,
    scheduled_at: null,
    status: 'completed',
    category_code: p.cat,
    time_block: p.turno == null ? null : { label: `T${p.turno}`, sort_order: p.turno },
    court: null,
    category: { name: p.cat, type: 'varonil', sort_order: p.sort, match_sort_order: null },
    matchup: {
      id: p.muId,
      team_a: { id: p.teamA, name: p.teamA, color: null, logo_url: null },
      team_b: { id: p.teamB, name: p.teamB, color: null, logo_url: null },
    },
    result: null,
  }
}

describe('groupByMatchup', () => {
  it('agrupa por enfrentamiento y, sin horarios, ordena por categoría', () => {
    const matches = [
      match({ id: 'm2', muId: 'A', teamA: 'Zeta', teamB: 'X', cat: 'VAR_6', sort: 3 }),
      match({ id: 'm1', muId: 'A', teamA: 'Zeta', teamB: 'X', cat: 'VAR_4', sort: 1 }),
      match({ id: 'm3', muId: 'B', teamA: 'Alfa', teamB: 'Y', cat: 'VAR_4', sort: 1 }),
    ]
    const groups = groupByMatchup(matches)
    // grupos ordenados por equipo A alfabético: Alfa antes que Zeta
    expect(groups.map((g) => g.teamA?.name)).toEqual(['Alfa', 'Zeta'])
    const zeta = groups.find((g) => g.teamA?.name === 'Zeta')!
    expect(zeta.matches.map((m) => m.id)).toEqual(['m1', 'm2']) // por sort_order
  })

  it('la HORA manda sobre la categoría: el primer turno va primero', () => {
    // El caso real: la categoría que se juega a las 10:15 tiene sort_order alto,
    // así que con el orden viejo aparecía al final de la lista del duelo.
    const matches = [
      match({ id: 'temprano', muId: 'A', teamA: 'Zeta', teamB: 'X', cat: 'MIX_B', sort: 9, turno: 1 }),
      match({ id: 'tarde', muId: 'A', teamA: 'Zeta', teamB: 'X', cat: 'VAR_5', sort: 2, turno: 3 }),
    ]
    const [g] = groupByMatchup(matches)
    expect(g.matches.map((m) => m.id)).toEqual(['temprano', 'tarde'])
  })

  it('dentro del MISMO turno vuelve a mandar la categoría', () => {
    const matches = [
      match({ id: 'b', muId: 'A', teamA: 'Zeta', teamB: 'X', cat: 'VAR_6', sort: 3, turno: 2 }),
      match({ id: 'a', muId: 'A', teamA: 'Zeta', teamB: 'X', cat: 'VAR_4', sort: 1, turno: 2 }),
    ]
    const [g] = groupByMatchup(matches)
    expect(g.matches.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('un partido sin horario se va al final, no al principio', () => {
    const matches = [
      match({ id: 'sinhora', muId: 'A', teamA: 'Zeta', teamB: 'X', cat: 'VAR_4', sort: 1 }),
      match({ id: 'conhora', muId: 'A', teamA: 'Zeta', teamB: 'X', cat: 'MIX_B', sort: 9, turno: 3 }),
    ]
    const [g] = groupByMatchup(matches)
    expect(g.matches.map((m) => m.id)).toEqual(['conhora', 'sinhora'])
  })
})
