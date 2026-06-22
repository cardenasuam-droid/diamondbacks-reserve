import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { NewsAudience } from './types'

function friendly(msg: string): string {
  if (/row-level security/i.test(msg)) return 'No tienes permiso (¿eres organizador o web manager?).'
  return msg
}

// Sube un archivo al bucket público 'media' y devuelve su URL pública.
export async function uploadMedia(file: File, folder: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('media').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) {
    throw new Error(
      /bucket|not found/i.test(error.message)
        ? 'Falta crear el bucket "media" (aplica la migración 0010).'
        : friendly(error.message),
    )
  }
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}

export interface SaveNewsVars {
  id?: string
  title: string
  body: string
  image_url: string
  audience: NewsAudience
  published: boolean
}

export function useSaveNews() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: SaveNewsVars) => {
      const now = new Date().toISOString()
      const { data: auth } = await supabase.auth.getUser()
      const base = {
        title: v.title.trim(),
        body: v.body.trim() || null,
        image_url: v.image_url.trim() || null,
        audience: v.audience,
        published: v.published,
        published_at: v.published ? now : null,
      }
      if (v.id) {
        const { error } = await supabase.from('news_posts').update(base).eq('id', v.id)
        if (error) throw new Error(friendly(error.message))
      } else {
        const { error } = await supabase
          .from('news_posts')
          .insert({ ...base, created_by: auth.user?.id ?? null })
        if (error) throw new Error(friendly(error.message))
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['news'] }),
  })
}

export function useDeleteNews() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('news_posts').delete().eq('id', id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['news'] }),
  })
}

export interface SaveDocumentVars {
  title: string
  version: string
  file_url: string
}

// Publica un nuevo reglamento vigente y desactiva los anteriores.
export function useSaveDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: SaveDocumentVars) => {
      const { data: auth } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('league_documents')
        .insert({
          title: v.title.trim(),
          version: v.version.trim() || null,
          file_url: v.file_url.trim(),
          document_type: 'reglamento',
          is_active: true,
          uploaded_by: auth.user?.id ?? null,
        })
        .select('id')
        .single()
      if (error) throw new Error(friendly(error.message))
      const { error: deErr } = await supabase
        .from('league_documents')
        .update({ is_active: false })
        .eq('document_type', 'reglamento')
        .neq('id', data.id)
      if (deErr) throw new Error(friendly(deErr.message))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}
