import { setScores, scoreLine, hasOfficialResult } from '@/features/schedule/score'
import type { MatchResultLite } from '@/features/schedule/types'

function result(p: Partial<MatchResultLite>): MatchResultLite {
  return {
    status: 'validated',
    is_walkover: false,
    set1_team_a: null,
    set1_team_b: null,
    set2_team_a: null,
    set2_team_b: null,
    set3_team_a: null,
    set3_team_b: null,
    winner_team_id: null,
    walkover_team_id: null,
    ...p,
  }
}

describe('score helpers', () => {
  it('extrae los sets jugados e ignora los nulos', () => {
    const r = result({ set1_team_a: 6, set1_team_b: 4, set2_team_a: 4, set2_team_b: 6, set3_team_a: 6, set3_team_b: 3 })
    expect(setScores(r)).toEqual([{ a: 6, b: 4 }, { a: 4, b: 6 }, { a: 6, b: 3 }])
    expect(scoreLine(r)).toBe('6-4  4-6  6-3')
  })

  it('marca walkover', () => {
    const r = result({ is_walkover: true, status: 'walkover' })
    expect(scoreLine(r)).toBe('W.O.')
  })

  it('2 sets: solo dos pares', () => {
    const r = result({ set1_team_a: 6, set1_team_b: 2, set2_team_a: 6, set2_team_b: 3 })
    expect(setScores(r)).toHaveLength(2)
    expect(scoreLine(r)).toBe('6-2  6-3')
  })

  it('hasOfficialResult distingue oficiales de pendientes', () => {
    expect(hasOfficialResult(result({ status: 'validated' }))).toBe(true)
    expect(hasOfficialResult(result({ status: 'reported' }))).toBe(false)
    expect(hasOfficialResult(null)).toBe(false)
  })
})
