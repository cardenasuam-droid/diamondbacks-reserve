import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Gender } from '@/lib/types'
import type { ShirtSize } from '@/lib/shirtSize'

// Roster completo para gestión: incluye inactivos y datos privados. Solo el
// organizador lo lee (RLS "organizer all").
export interface ManagedPlayer {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  gender: Gender
  category_code: string
  shirt_size: ShirtSize | null
  team_id: string
  is_captain: boolean
  is_cocaptain: boolean
  is_active: boolean
  is_paid: boolean
  photo_url: string | null
}

async function fetchManageRoster(teamId: string): Promise<ManagedPlayer[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, full_name, email, phone, gender, category_code, shirt_size, team_id, is_captain, is_cocaptain, is_active, is_paid, photo_url')
    .eq('team_id', teamId)
    .order('full_name')
  if (error) throw error
  return (data ?? []) as ManagedPlayer[]
}

export function useManageRoster(teamId: string | undefined) {
  return useQuery({
    queryKey: ['manage-roster', teamId],
    queryFn: () => fetchManageRoster(teamId as string),
    enabled: Boolean(teamId),
  })
}
