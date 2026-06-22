import { groupByMatchup } from '@/features/schedule/groupByMatchup'
import type { ScheduledMatch } from '@/features/schedule/types'

function match(p: {
  id: string
  muId: string
  teamA: string
  teamB: string
  cat: string
  sort: number
}): ScheduledMatch {
  return {
    id: p.id,
    scheduled_at: null,
    status: 'completed',
    category_code: p.cat,
    time_block: null,
    court: null,
    category: { name: p.cat, type: 'varonil', sort_order: p.sort },
    matchup: {
      id: p.muId,
      team_a: { id: p.teamA, name: p.teamA, color: null },
      team_b: { id: p.teamB, name: p.teamB, color: null },
    },
    result: null,
  }
}

describe('groupByMatchup', () => {
  it('agrupa por enfrentamiento y ordena partidos por categoría', () => {
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
})
