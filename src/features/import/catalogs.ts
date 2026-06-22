import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface TimeBlock {
  id: string
  label: string
  start_time: string
  sort_order: number
}
export interface Court {
  id: string
  number: number
  name: string
}

// Catálogos fijos (lectura pública). Casi inmutables: cache larga.
export function useTimeBlocks() {
  return useQuery({
    queryKey: ['time-blocks'],
    queryFn: async (): Promise<TimeBlock[]> => {
      const { data, error } = await supabase
        .from('time_blocks')
        .select('id, label, start_time, sort_order')
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as TimeBlock[]
    },
    staleTime: 30 * 60_000,
  })
}

export function useCourts() {
  return useQuery({
    queryKey: ['courts'],
    queryFn: async (): Promise<Court[]> => {
      const { data, error } = await supabase
        .from('courts')
        .select('id, number, name')
        .order('number')
      if (error) throw error
      return (data ?? []) as Court[]
    },
    staleTime: 30 * 60_000,
  })
}
