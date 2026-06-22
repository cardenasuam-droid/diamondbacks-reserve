import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/lib/types'

export interface StaffPublic {
  id: string
  full_name: string
  role: UserRole
}

// Lista pública de staff (sin el código). Alimenta el selector de acceso.
async function fetchStaffPublic(): Promise<StaffPublic[]> {
  const { data, error } = await supabase.from('staff_public').select('id, full_name, role')
  if (error) throw error
  return (data ?? []) as StaffPublic[]
}

export function useStaffPublic() {
  return useQuery({
    queryKey: ['staff-public'],
    queryFn: fetchStaffPublic,
    staleTime: 5 * 60_000,
  })
}
