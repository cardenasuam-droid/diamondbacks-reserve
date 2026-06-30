import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Gender } from '@/lib/types'
import type { ShirtSize } from '@/lib/shirtSize'

// PoolPlayer base: viene de players_public (vista pública), así lo pueden leer
// TANTO el organizador COMO las capitanas. Sin teléfono (privado).
export interface PoolPlayer {
  id: string
  full_name: string
  gender: Gender
  category_code: string
}

function friendly(msg: string): string {
  if (/row-level security/i.test(msg)) return 'No tienes permiso (¿eres organizador?).'
  if (/foreign key|violates|referenced/i.test(msg)) return 'No se puede borrar: el jugador ya tiene datos asociados.'
  return msg
}

// El POOL: jugadores activos sin equipo (free agents) de la temporada.
// Lectura pública (players_public) → visible para organizador y capitanas.
export function usePoolPlayers(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['pool-players', seasonId],
    queryFn: async (): Promise<PoolPlayer[]> => {
      const { data, error } = await supabase
        .from('players_public')
        .select('id, full_name, gender, category_code')
        .eq('season_id', seasonId as string)
        .is('team_id', null)
      if (error) throw error
      return (data ?? []) as PoolPlayer[]
    },
    enabled: Boolean(seasonId),
  })
}

// Jugadores INHABILITADOS sin equipo (is_active=false, team_id null). Al
// inhabilitar un jugador desde el roster (useTogglePlayerActive) se le quita el
// team_id automáticamente, así "regresa" aquí en vez de desaparecer de toda la
// app (players_public los excluye por is_active=false). SOLO el organizador los
// ve (lee `players` directo, RLS "organizer all"); las capitanas no llaman esto.
export function useInactivePoolPlayers(seasonId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['inactive-pool-players', seasonId],
    queryFn: async (): Promise<PoolPlayer[]> => {
      const { data, error } = await supabase
        .from('players')
        .select('id, full_name, gender, category_code')
        .eq('season_id', seasonId as string)
        .is('team_id', null)
        .eq('is_active', false)
      if (error) throw error
      return (data ?? []) as PoolPlayer[]
    },
    enabled: Boolean(seasonId) && enabled,
  })
}

export interface PoolRegistration {
  created_at: string // fecha/hora de inscripción (solicitud de ingreso)
  phone: string | null
}

// Enriquecimiento SOLO para el organizador: fecha/hora de inscripción + teléfono,
// desde player_registrations (RLS organizador). Mapeado por id del jugador creado.
// Las capitanas no lo llaman (enabled=false) y por RLS tampoco podrían leerlo.
export function usePoolRegistrations(seasonId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['pool-registrations', seasonId],
    queryFn: async (): Promise<Record<string, PoolRegistration>> => {
      const { data, error } = await supabase
        .from('player_registrations')
        .select('created_player_id, created_at, phone')
        .eq('season_id', seasonId as string)
        .eq('status', 'approved')
        .not('created_player_id', 'is', null)
      if (error) throw error
      const map: Record<string, PoolRegistration> = {}
      for (const r of (data ?? []) as { created_player_id: string; created_at: string; phone: string | null }[]) {
        map[r.created_player_id] = { created_at: r.created_at, phone: r.phone }
      }
      return map
    },
    enabled: Boolean(seasonId) && enabled,
  })
}

// Tallas de los jugadores del POOL, SOLO para el organizador (lee players directo;
// la talla NO está en players_public). Mapeado por id de jugador. Las capitanas no
// lo llaman (enabled=false) y por RLS solo verían su propio equipo, no el pool.
export function usePoolShirtSizes(seasonId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['pool-shirt-sizes', seasonId],
    queryFn: async (): Promise<Record<string, ShirtSize | null>> => {
      const { data, error } = await supabase
        .from('players')
        .select('id, shirt_size')
        .eq('season_id', seasonId as string)
        .is('team_id', null)
      if (error) throw error
      const map: Record<string, ShirtSize | null> = {}
      for (const r of (data ?? []) as { id: string; shirt_size: ShirtSize | null }[]) {
        map[r.id] = r.shirt_size
      }
      return map
    },
    enabled: Boolean(seasonId) && enabled,
  })
}

export interface UpdatePoolVars {
  id: string
  seasonId: string
  full_name: string
  phone: string
  gender: Gender
  category_code: string
  shirt_size: ShirtSize | null
}

// Edita un jugador del pool (nombre/teléfono/categoría; el género se deriva de la
// categoría). NO toca team_id (sigue en el pool). Organizador (RLS).
export function useUpdatePoolPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: UpdatePoolVars) => {
      const { error } = await supabase
        .from('players')
        .update({
          full_name: v.full_name.trim(),
          phone: v.phone.trim() || null,
          gender: v.gender,
          category_code: v.category_code,
          shirt_size: v.shirt_size,
        })
        .eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => invalidatePool(qc, v.seasonId),
  })
}

// Quita un jugador del pool (lo borra; aún no tiene alineaciones/resultados).
export function useDeletePoolPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; seasonId: string }) => {
      const { error } = await supabase.from('players').delete().eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, v) => invalidatePool(qc, v.seasonId),
  })
}

function invalidatePool(qc: ReturnType<typeof useQueryClient>, seasonId: string) {
  void qc.invalidateQueries({ queryKey: ['pool-players', seasonId] })
  void qc.invalidateQueries({ queryKey: ['inactive-pool-players', seasonId] })
  void qc.invalidateQueries({ queryKey: ['pool-registrations', seasonId] })
  void qc.invalidateQueries({ queryKey: ['pool-shirt-sizes', seasonId] })
  void qc.invalidateQueries({ queryKey: ['players_public', seasonId] })
}
