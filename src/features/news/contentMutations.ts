import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { safeUrl } from '@/lib/url'
import type { NewsAudience } from './types'

function friendly(msg: string): string {
  if (/row-level security/i.test(msg)) return 'No tienes permiso (¿eres organizador o web manager?).'
  return msg
}

// Tipos y tamaño permitidos DEBEN coincidir con lo que el bucket 'media' acepta
// (migración 0018: allowed_mime_types + file_size_limit). El bucket lo hace cumplir
// en el servidor; esto es solo para dar un mensaje claro antes de subir.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

// Sube un archivo al bucket público 'media' y devuelve su URL pública.
// `kind='image'` restringe a imágenes (p. ej. fotos/logos); 'any' admite además PDF.
export async function uploadMedia(
  file: File,
  folder: string,
  kind: 'image' | 'any' = 'any',
): Promise<string> {
  const allowed = kind === 'image' ? IMAGE_MIMES : Object.keys(EXT_BY_MIME)
  if (!allowed.includes(file.type)) {
    throw new Error(
      kind === 'image'
        ? 'Formato no permitido. Usa una imagen PNG, JPG, WEBP o GIF.'
        : 'Formato no permitido. Usa PNG, JPG, WEBP, GIF o PDF.',
    )
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('El archivo supera el límite de 10 MB.')
  }
  // La extensión se deriva del MIME real, no del nombre del archivo (evita colar
  // un .svg/.html disfrazado).
  const ext = EXT_BY_MIME[file.type]
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('media').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
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
      const imageUrl = v.image_url.trim()
      if (imageUrl && !safeUrl(imageUrl)) {
        throw new Error('La URL de la imagen no es válida (usa http o https).')
      }
      const { data: auth } = await supabase.auth.getUser()
      const base = {
        title: v.title.trim(),
        body: v.body.trim() || null,
        image_url: imageUrl || null,
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
      const fileUrl = v.file_url.trim()
      if (!safeUrl(fileUrl)) {
        throw new Error('La URL del archivo no es válida (usa http o https, o sube el PDF).')
      }
      const { data: auth } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('league_documents')
        .insert({
          title: v.title.trim(),
          version: v.version.trim() || null,
          file_url: fileUrl,
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
