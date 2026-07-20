import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CategoryType } from '@/lib/types'
import type { TeamLite } from './types'

// Próximos partidos DEL JUGADOR: las entradas de alineación publicadas donde él
// aparece, con su partido (hora, cancha, categoría), su pareja y el rival.
//
// Sustituye en el dashboard a los enfrentamientos del EQUIPO
// (useTeamUpcomingMatchups): el jugador quiere saber cuándo juega ÉL, no cuándo
// juega su equipo (decisión de la organizadora, 2026-07-20). La diferencia
// importa: en un enfrentamiento de 11 partidos, cada jugador disputa 1 (o 2, si
// va dobleteado por excepción — y entonces aquí salen sus 2 partidos).
//
// Solo rol PUBLICADO (lineups.locked_at, 0036). El filtro es explícito y no se
// apoya solo en la RLS: a un CAPITÁN la política "captain read own" le dejaría
// ver sus propias entradas sin publicar, y su dashboard mostraría partidos que
// el resto de su equipo aún no puede ver. La publicación es la línea para todos.
export interface MyUpcomingMatch {
  matchId: string
  scheduledAt: string | null
  timeLabel: string | null
  courtName: string | null
  categoryCode: string
  categoryType: CategoryType | null
  round: { id: string; round_number: number; round_date: string | null }
  /** El compañero de pareja (el otro id de la entrada); null si el hueco quedó vacío. */
  partnerId: string | null
  teamId: string
  opponent: TeamLite
}

interface RawRow {
  player_1_id: string | null
  player_2_id: string | null
  match: {
    id: string
    scheduled_at: string | null
    time_block: { label: string } | null
    court: { name: string } | null
    category: { type: CategoryType } | null
    category_code: string
    round: { id: string; round_number: number; round_date: string | null; season_id: string } | null
  } | null
  lineup: {
    team_id: string
    locked_at: string | null
    matchup: {
      team_a_id: string
      team_b_id: string
      team_a: TeamLite | null
      team_b: TeamLite | null
    } | null
  } | null
}

const SELECT = `
  player_1_id, player_2_id,
  match:matches!inner(
    id, scheduled_at, category_code,
    time_block:time_blocks(label),
    court:courts(name),
    category:match_categories(type),
    round:rounds!inner(id, round_number, round_date, season_id)
  ),
  lineup:lineups!inner(
    team_id, locked_at,
    matchup:team_matchups(
      team_a_id, team_b_id,
      team_a:teams!team_a_id(id, name, color, logo_url),
      team_b:teams!team_b_id(id, name, color, logo_url)
    )
  )
`

async function fetchMyUpcoming(playerId: string, seasonId: string): Promise<MyUpcomingMatch[]> {
  const { data, error } = await supabase
    .from('lineup_entries')
    .select(SELECT)
    .or(`player_1_id.eq.${playerId},player_2_id.eq.${playerId}`)
    .eq('match.round.season_id', seasonId)
    .not('lineup.locked_at', 'is', null)
  if (error) throw error

  // "Próximo" incluye HOY completo: el partido de esta noche sigue siendo el dato
  // más útil de la pantalla aunque ya se haya jugado esta mañana. Se compara en
  // hora LOCAL, no recortando el ISO (que es UTC: un juego de 21:00 en Ciudad
  // Juárez cae en el día UTC siguiente y un slice(0,10) lo movería de día).
  const inicioDeHoy = new Date()
  inicioDeHoy.setHours(0, 0, 0, 0)
  const hoy = new Date().toISOString().slice(0, 10)

  const rows = ((data ?? []) as unknown as RawRow[]).filter((r) => r.match && r.lineup)

  return rows
    .map((r) => {
      const m = r.match!
      const l = r.lineup!
      const esA = l.matchup?.team_a_id === l.team_id
      const opponent: TeamLite = (esA ? l.matchup?.team_b : l.matchup?.team_a) ?? {
        id: '',
        name: 'Rival',
        color: null,
        logo_url: null,
      }
      return {
        matchId: m.id,
        scheduledAt: m.scheduled_at,
        timeLabel: m.time_block?.label ?? null,
        courtName: m.court?.name ?? null,
        categoryCode: m.category_code,
        categoryType: m.category?.type ?? null,
        round: {
          id: m.round?.id ?? '',
          round_number: m.round?.round_number ?? 0,
          round_date: m.round?.round_date ?? null,
        },
        partnerId: (r.player_1_id === playerId ? r.player_2_id : r.player_1_id) ?? null,
        teamId: l.team_id,
        opponent,
      }
    })
    .filter((g) =>
      g.scheduledAt
        ? new Date(g.scheduledAt) >= inicioDeHoy
        : !g.round.round_date || g.round.round_date >= hoy,
    )
    .sort((a, b) => {
      if (a.scheduledAt && b.scheduledAt && a.scheduledAt !== b.scheduledAt)
        return a.scheduledAt < b.scheduledAt ? -1 : 1
      return a.round.round_number - b.round.round_number
    })
}

export function useMyUpcomingMatches(playerId: string | undefined, seasonId: string | undefined) {
  return useQuery({
    queryKey: ['my-upcoming-matches', playerId, seasonId],
    queryFn: () => fetchMyUpcoming(playerId as string, seasonId as string),
    enabled: Boolean(playerId && seasonId),
  })
}
