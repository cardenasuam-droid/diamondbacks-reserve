import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { NewsPost } from './types'

const COLUMNS =
  'id, title, body, image_url, audience, target_team_id, published, published_at, created_at, updated_at'

// Noticias públicas (publicadas, dirigidas al público). Feed por fecha.
async function fetchPublishedNews(): Promise<NewsPost[]> {
  const { data, error } = await supabase
    .from('news_posts')
    .select(COLUMNS)
    .eq('published', true)
    .eq('audience', 'public')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as NewsPost[]
}

export function usePublishedNews() {
  return useQuery({ queryKey: ['news', 'published'], queryFn: fetchPublishedNews })
}

async function fetchNewsPost(id: string): Promise<NewsPost | null> {
  const { data, error } = await supabase.from('news_posts').select(COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as NewsPost | null) ?? null
}

export function useNewsPost(id: string | undefined) {
  return useQuery({
    queryKey: ['news', 'post', id],
    queryFn: () => fetchNewsPost(id as string),
    enabled: Boolean(id),
  })
}

// Todas las noticias (incluye borradores). Solo gestores de contenido por RLS.
async function fetchAllNews(): Promise<NewsPost[]> {
  const { data, error } = await supabase
    .from('news_posts')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as NewsPost[]
}

export function useAllNews() {
  return useQuery({ queryKey: ['news', 'all'], queryFn: fetchAllNews })
}
