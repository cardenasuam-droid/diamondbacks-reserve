import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { LeagueDocument } from './types'

const COLUMNS = 'id, title, file_url, document_type, version, is_active, created_at'

// El reglamento vigente (documento activo). null si aún no hay.
async function fetchActiveReglamento(): Promise<LeagueDocument | null> {
  const { data, error } = await supabase
    .from('league_documents')
    .select(COLUMNS)
    .eq('document_type', 'reglamento')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as LeagueDocument | null) ?? null
}

export function useActiveReglamento() {
  return useQuery({ queryKey: ['documents', 'reglamento', 'active'], queryFn: fetchActiveReglamento })
}

// Todos los reglamentos (historial), para gestión.
async function fetchAllDocuments(): Promise<LeagueDocument[]> {
  const { data, error } = await supabase
    .from('league_documents')
    .select(COLUMNS)
    .eq('document_type', 'reglamento')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as LeagueDocument[]
}

export function useAllDocuments() {
  return useQuery({ queryKey: ['documents', 'all'], queryFn: fetchAllDocuments })
}
