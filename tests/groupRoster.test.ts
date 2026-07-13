import { groupRoster } from '@/features/teams/groupRoster'
import type { MatchCategory, PublicPlayer } from '@/lib/types'

const categories: MatchCategory[] = [
  { code: 'VAR_4', name: '4a Varonil', type: 'varonil', sort_order: 1, is_active: true, is_ranking: true, is_match: true, match_sort_order: null },
  { code: 'VAR_5', name: '5a Varonil', type: 'varonil', sort_order: 2, is_active: true, is_ranking: true, is_match: true, match_sort_order: null },
  { code: 'FEM_4', name: '4a Femenil', type: 'femenil', sort_order: 4, is_active: true, is_ranking: true, is_match: true, match_sort_order: null },
]

function player(p: Partial<PublicPlayer> & { id: string; full_name: string; category_code: string }): PublicPlayer {
  return {
    season_id: 's1',
    team_id: 't1',
    gender: 'male',
    is_captain: false,
    is_active: true,
    photo_url: null,
    is_waitlisted: false,
    position: null,
    ...p,
  }
}

describe('groupRoster', () => {
  it('agrupa por categoría y ordena los grupos por sort_order', () => {
    const players = [
      player({ id: '1', full_name: 'Ana', category_code: 'FEM_4', gender: 'female' }),
      player({ id: '2', full_name: 'Beto', category_code: 'VAR_4' }),
      player({ id: '3', full_name: 'Caro', category_code: 'VAR_5', gender: 'female' }),
    ]
    const groups = groupRoster(players, categories)
    expect(groups.map((g) => g.code)).toEqual(['VAR_4', 'VAR_5', 'FEM_4'])
    expect(groups[0].name).toBe('4a Varonil')
  })

  it('pone al capitán primero y luego alfabético dentro del grupo', () => {
    const players = [
      player({ id: '1', full_name: 'Zoe', category_code: 'VAR_4' }),
      player({ id: '2', full_name: 'Beto', category_code: 'VAR_4', is_captain: true }),
      player({ id: '3', full_name: 'Aldo', category_code: 'VAR_4' }),
    ]
    const [grupo] = groupRoster(players, categories)
    expect(grupo.players.map((p) => p.full_name)).toEqual(['Beto', 'Aldo', 'Zoe'])
  })
})
