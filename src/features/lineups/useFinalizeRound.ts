import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EligibilityRule } from './validateLineup'
import { generateRandomLineup, type GenPlayer } from './generateRandomLineup'

// "Cerrar y publicar jornada" (organizador). A la hora del cierre (sábado 07:00):
//  1. A cada equipo que NO envió alineación se le genera una ALEATORIA VÁLIDA (en el
//     cliente, con lógica testeada) y se guarda con save_lineup (el organizador salta
//     el candado).
//  2. Se publican TODAS (publish_round_lineups → locked_at) y quedan visibles para todos.
//
// Un equipo con solo BORRADOR (status 'draft') cuenta como "no enviado": se le
// autogenera (reemplaza el borrador). Roster corto: llena lo que pueda; el resto vacío.

export interface FinalizeResult {
  autoTeams: number // equipos a los que se les generó alineación
  partialTeams: number // de esos, cuántos no se pudieron llenar por completo
  published: number // filas de alineación marcadas como publicadas
}

const SENT_STATUSES = ['submitted', 'modified', 'locked', 'validated', 'admin_edited']

async function finalizeRound(vars: { roundId: string; seasonId: string }): Promise<FinalizeResult> {
  const { roundId, seasonId } = vars

  const [{ data: matchups, error: e1 }, { data: matches, error: e2 }, { data: rules, error: e3 }] =
    await Promise.all([
      supabase.from('team_matchups').select('id, team_a_id, team_b_id').eq('round_id', roundId),
      supabase.from('matches').select('id, team_matchup_id, category_code').eq('round_id', roundId),
      supabase
        .from('category_eligibility_rules')
        .select('match_category_code, required_gender, required_player_category_code, required_count'),
    ])
  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)
  if (e3) throw new Error(e3.message)

  const mus = (matchups ?? []) as { id: string; team_a_id: string | null; team_b_id: string | null }[]
  const muIds = mus.map((m) => m.id)
  if (muIds.length === 0) return { autoTeams: 0, partialTeams: 0, published: 0 }

  const teamIds = [...new Set(mus.flatMap((m) => [m.team_a_id, m.team_b_id]).filter(Boolean))] as string[]
  const [{ data: lineups, error: e4 }, { data: players, error: e5 }] = await Promise.all([
    supabase.from('lineups').select('team_matchup_id, team_id, status').in('team_matchup_id', muIds),
    supabase
      .from('players')
      .select('id, gender, category_code, team_id')
      .eq('season_id', seasonId)
      .eq('is_active', true)
      .in('team_id', teamIds),
  ])
  if (e4) throw new Error(e4.message)
  if (e5) throw new Error(e5.message)

  const rulesArr = (rules ?? []) as EligibilityRule[]
  const matchRows = (matches ?? []) as { id: string; team_matchup_id: string; category_code: string }[]
  const lineupRows = (lineups ?? []) as { team_matchup_id: string; team_id: string; status: string }[]

  const rosterByTeam = new Map<string, GenPlayer[]>()
  for (const p of (players ?? []) as (GenPlayer & { team_id: string })[]) {
    const list = rosterByTeam.get(p.team_id) ?? []
    list.push({ id: p.id, gender: p.gender, category_code: p.category_code })
    rosterByTeam.set(p.team_id, list)
  }

  const hasSent = (muId: string, teamId: string) =>
    lineupRows.some((l) => l.team_matchup_id === muId && l.team_id === teamId && SENT_STATUSES.includes(l.status))

  let autoTeams = 0
  let partialTeams = 0

  for (const mu of mus) {
    const catMatches = matchRows.filter((m) => m.team_matchup_id === mu.id)
    const cats = [...new Set(catMatches.map((m) => m.category_code))]
    const matchIdByCat = new Map(catMatches.map((m) => [m.category_code, m.id]))

    for (const teamId of [mu.team_a_id, mu.team_b_id]) {
      if (!teamId || hasSent(mu.id, teamId)) continue
      const roster = rosterByTeam.get(teamId) ?? []
      const generated = generateRandomLineup(cats, roster, rulesArr)
      const entries = generated.map((g) => ({
        category_code: g.category_code,
        match_id: matchIdByCat.get(g.category_code) ?? null,
        player_1_id: g.player_1_id,
        player_2_id: g.player_2_id,
      }))
      const { error } = await supabase.rpc('save_lineup', {
        p_team_matchup_id: mu.id,
        p_team_id: teamId,
        p_submit: true,
        p_entries: entries,
      })
      if (error) throw new Error(error.message)
      autoTeams++
      if (generated.length < cats.length) partialTeams++
    }
  }

  const { data: published, error: e6 } = await supabase.rpc('publish_round_lineups', { p_round_id: roundId })
  if (e6) throw new Error(e6.message)

  return { autoTeams, partialTeams, published: (published as number) ?? 0 }
}

export function useFinalizeRound() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: finalizeRound,
    onSuccess: (_r, vars) => {
      void qc.invalidateQueries({ queryKey: ['round-lineups', vars.roundId] })
    },
  })
}
