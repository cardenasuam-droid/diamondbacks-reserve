import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { League, MatchCategory, Season } from '@/lib/types'

// Hooks del contenedor multi-liga (0049). Mientras el selector liga→edición
// llega (F4), estos hooks alimentan lo nuevo (inscripciones femenil, landing)
// sin tocar useActiveSeason, que sigue mandando en las páginas de Reserve.

export interface OpenRegistrationSeason extends Season {
  league: League
}

// Ediciones con inscripción abierta, con su liga (para el hub /registro y el
// banner de la Home). Orden estable: por sort_order de la liga.
export function useOpenRegistrationSeasons() {
  return useQuery({
    queryKey: ['seasons', 'registration-open'],
    queryFn: async (): Promise<OpenRegistrationSeason[]> => {
      const { data, error } = await supabase
        .from('seasons')
        .select('*, league:leagues(*)')
        .eq('registration_open', true)
      if (error) throw error
      const rows = (data ?? []) as unknown as OpenRegistrationSeason[]
      return rows
        .filter((s) => s.league?.is_active)
        .sort((a, b) => a.league.sort_order - b.league.sort_order)
    },
    staleTime: 5 * 60_000,
  })
}

// La edición con inscripción abierta de UNA liga (formulario /registro/:slug
// y landing). Si la liga tuviera varias abiertas, gana la de mayor edición.
export function useLeagueOpenSeason(leagueSlug: string | undefined) {
  return useQuery({
    queryKey: ['seasons', 'registration-open', leagueSlug],
    queryFn: async (): Promise<OpenRegistrationSeason | null> => {
      const { data, error } = await supabase
        .from('seasons')
        .select('*, league:leagues!inner(*)')
        .eq('registration_open', true)
        .eq('leagues.slug', leagueSlug!)
      if (error) throw error
      const rows = (data ?? []) as unknown as OpenRegistrationSeason[]
      if (rows.length === 0) return null
      return [...rows].sort(
        (a, b) => (b.edition_number ?? 0) - (a.edition_number ?? 0)
      )[0]
    },
    enabled: Boolean(leagueSlug),
    staleTime: 60_000,
  })
}

// La edición VIGENTE de una liga (la de mayor edition_number), tenga o no la
// inscripción abierta: la usan el rol/tabla públicos y el panel del
// organizador, que siguen vivos después de cerrar inscripciones.
export function useLeagueSeason(leagueSlug: string | undefined) {
  return useQuery({
    queryKey: ['league-season', leagueSlug],
    queryFn: async (): Promise<OpenRegistrationSeason | null> => {
      const { data, error } = await supabase
        .from('seasons')
        .select('*, league:leagues!inner(*)')
        .eq('leagues.slug', leagueSlug!)
      if (error) throw error
      const rows = (data ?? []) as unknown as OpenRegistrationSeason[]
      if (rows.length === 0) return null
      return [...rows].sort((a, b) => (b.edition_number ?? 0) - (a.edition_number ?? 0))[0]
    },
    enabled: Boolean(leagueSlug),
    staleTime: 60_000,
  })
}

// Categorías que JUEGA una edición (season_categories → match_categories).
export function useSeasonCategories(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['season-categories', seasonId],
    queryFn: async (): Promise<MatchCategory[]> => {
      const { data, error } = await supabase
        .from('season_categories')
        .select('category:match_categories(*)')
        .eq('season_id', seasonId!)
      if (error) throw error
      const cats = ((data ?? []) as unknown as { category: MatchCategory | null }[])
        .map((r) => r.category)
        .filter((c): c is MatchCategory => Boolean(c))
      return cats.sort((a, b) => a.sort_order - b.sort_order)
    },
    enabled: Boolean(seasonId),
    staleTime: 5 * 60_000,
  })
}

export interface SeasonTimeBlock {
  id: string
  label: string
  start_time: string
  sort_order: number
}

// Bloques de horario de una edición (para el campo "horarios que NO puedo
// jugar" del formulario y, en F2, para el calendario).
export function useSeasonTimeBlocks(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['season-time-blocks', seasonId],
    queryFn: async (): Promise<SeasonTimeBlock[]> => {
      const { data, error } = await supabase
        .from('season_time_blocks')
        .select('block:time_blocks(*)')
        .eq('season_id', seasonId!)
      if (error) throw error
      const blocks = ((data ?? []) as unknown as { block: SeasonTimeBlock | null }[])
        .map((r) => r.block)
        .filter((b): b is SeasonTimeBlock => Boolean(b))
      return blocks.sort((a, b) => a.sort_order - b.sort_order)
    },
    enabled: Boolean(seasonId),
    staleTime: 5 * 60_000,
  })
}

// Fichas activas de una edición (contador de cupo). Lee la vista pública, así
// el "quedan N lugares" también puede mostrarse sin sesión. La clave arranca
// con ['players_public', seasonId] para que las invalidaciones existentes del
// approve la alcancen por prefijo.
export function useSeasonPlayerCount(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['players_public', seasonId, 'count'],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('players_public')
        .select('id', { count: 'exact', head: true })
        .eq('season_id', seasonId!)
        .eq('is_waitlisted', false)
      if (error) throw error
      return count ?? 0
    },
    enabled: Boolean(seasonId),
  })
}
