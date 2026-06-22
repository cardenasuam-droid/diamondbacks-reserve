import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TeamInput } from './teamsImport'
import type { PlayerInput } from './playersImport'
import type { ScheduleMatchInput } from './scheduleImport'

export interface ImportResult {
  inserted: number
}

function friendly(message: string): string {
  if (/row-level security/i.test(message)) {
    return 'No tienes permiso (¿iniciaste sesión como organizador?).'
  }
  if (/one_captain_per_team/i.test(message)) {
    return 'Un equipo ya tiene capitán. Revisa is_captain.'
  }
  if (/duplicate key|already exists|unique/i.test(message)) {
    return 'Hay registros duplicados respecto a lo ya cargado (email, cancha/horario o partido).'
  }
  return message
}

const pairKey = (a: string, b: string) => [a, b].sort().join('|')

// --- Equipos ---------------------------------------------------------------
export function useImportTeams(seasonId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (teams: TeamInput[]): Promise<ImportResult> => {
      if (!seasonId) throw new Error('No hay temporada activa.')
      if (teams.length === 0) return { inserted: 0 }
      const rows = teams.map((t) => ({
        season_id: seasonId,
        name: t.team_name,
        color: t.color,
        logo_url: t.logo_url,
      }))
      const { data, error } = await supabase.from('teams').insert(rows).select('id')
      if (error) throw new Error(friendly(error.message))
      return { inserted: data?.length ?? 0 }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teams', seasonId] })
    },
  })
}

// --- Jugadores -------------------------------------------------------------
export function useImportPlayers(seasonId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (players: PlayerInput[]): Promise<ImportResult> => {
      if (!seasonId) throw new Error('No hay temporada activa.')
      if (players.length === 0) return { inserted: 0 }
      const rows = players.map((p) => ({
        season_id: seasonId,
        team_id: p.team_id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        gender: p.gender,
        category_code: p.category_code,
        is_captain: p.is_captain,
      }))
      const { data, error } = await supabase.from('players').insert(rows).select('id')
      if (error) throw new Error(friendly(error.message))
      return { inserted: data?.length ?? 0 }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teams', seasonId] })
      void qc.invalidateQueries({ queryKey: ['players_public', seasonId] })
    },
  })
}

// --- Rol (rounds + matchups + matches) -------------------------------------
export function useImportSchedule(seasonId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (matches: ScheduleMatchInput[]): Promise<ImportResult> => {
      if (!seasonId) throw new Error('No hay temporada activa.')
      if (matches.length === 0) return { inserted: 0 }

      // Guardia anti-duplicado: no reimportar jornadas existentes.
      const roundNums = [...new Set(matches.map((m) => m.round_number))]
      const { data: existing, error: exErr } = await supabase
        .from('rounds')
        .select('round_number')
        .eq('season_id', seasonId)
        .in('round_number', roundNums)
      if (exErr) throw new Error(friendly(exErr.message))
      if (existing && existing.length > 0) {
        const list = existing.map((r) => `J${r.round_number}`).join(', ')
        throw new Error(`Estas jornadas ya existen: ${list}. Elimínalas antes de reimportar el rol.`)
      }

      // 1. rounds
      const dateByNum = new Map<number, string | null>()
      for (const m of matches) if (!dateByNum.has(m.round_number)) dateByNum.set(m.round_number, m.round_date)
      const roundRows = [...dateByNum].map(([n, d]) => ({
        season_id: seasonId,
        round_number: n,
        round_date: d,
        status: 'draft',
      }))
      const { data: rData, error: rErr } = await supabase
        .from('rounds')
        .insert(roundRows)
        .select('id, round_number')
      if (rErr) throw new Error(friendly(rErr.message))
      const roundIdByNum = new Map((rData ?? []).map((r) => [r.round_number as number, r.id as string]))
      const roundNumById = new Map((rData ?? []).map((r) => [r.id as string, r.round_number as number]))

      // 2. team_matchups (uno por jornada + pareja)
      const muMeta = new Map<string, { round_id: string; team_a_id: string; team_b_id: string }>()
      for (const m of matches) {
        const k = `${m.round_number}|${pairKey(m.team_a_id, m.team_b_id)}`
        if (!muMeta.has(k)) {
          muMeta.set(k, {
            round_id: roundIdByNum.get(m.round_number) as string,
            team_a_id: m.team_a_id,
            team_b_id: m.team_b_id,
          })
        }
      }
      const { data: muData, error: muErr } = await supabase
        .from('team_matchups')
        .insert([...muMeta.values()])
        .select('id, round_id, team_a_id, team_b_id')
      if (muErr) throw new Error(friendly(muErr.message))
      const muIdByKey = new Map<string, string>()
      for (const mu of muData ?? []) {
        const rn = roundNumById.get(mu.round_id as string)
        muIdByKey.set(`${rn}|${pairKey(mu.team_a_id as string, mu.team_b_id as string)}`, mu.id as string)
      }

      // 3. matches
      const matchRows = matches.map((m) => {
        const t = m.start_time.length >= 8 ? m.start_time : `${m.start_time}:00`
        return {
          round_id: roundIdByNum.get(m.round_number) as string,
          team_matchup_id: muIdByKey.get(`${m.round_number}|${pairKey(m.team_a_id, m.team_b_id)}`) as string,
          category_code: m.category_code,
          time_block_id: m.time_block_id,
          court_id: m.court_id,
          scheduled_at: m.round_date ? `${m.round_date}T${t}` : null,
          status: 'scheduled',
        }
      })
      const { data: mData, error: mErr } = await supabase.from('matches').insert(matchRows).select('id')
      if (mErr) throw new Error(friendly(mErr.message))
      return { inserted: mData?.length ?? 0 }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rounds', seasonId] })
      void qc.invalidateQueries({ queryKey: ['round-matches'] })
    },
  })
}
