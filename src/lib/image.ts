// Miniaturas al vuelo con la transformación de imágenes de Supabase (plan Pro).
// El problema: las fotos se suben a resolución de celular (~1.5 MB) y se sirven
// full-res hasta como avatares diminutos → dispara el "cached egress".
// La solución: reescribir la URL pública de Storage al endpoint de render, que
// devuelve una versión redimensionada (a menudo ~10 KB) y la cachea en el CDN.
//
//   .../storage/v1/object/public/media/players/<id>.jpg
//   .../storage/v1/render/image/public/media/players/<id>.jpg?width=96&quality=65&resize=cover
//
// URLs externas o data: se devuelven intactas (no son de Storage).

const PUBLIC = '/storage/v1/object/public/'
const RENDER = '/storage/v1/render/image/public/'

export interface ThumbOpts {
  /** Ancho objetivo en px (usa ~2× el tamaño de despliegue para pantallas retina). */
  width: number
  height?: number
  /** 1-100. Menor = menos bytes. Por defecto 65 (buen balance para fotos). */
  quality?: number
  /** cover recorta al encuadre (avatares); contain conserva todo (logos). */
  resize?: 'cover' | 'contain' | 'fill'
}

export function imageThumb(url: string | null | undefined, opts: ThumbOpts): string | null {
  if (!url) return null
  const at = url.indexOf(PUBLIC)
  if (at === -1) return url // no es una URL pública de Storage → sin cambios
  const base = url.slice(0, at) + RENDER + url.slice(at + PUBLIC.length)
  const params = new URLSearchParams({
    width: String(Math.round(opts.width)),
    quality: String(opts.quality ?? 65),
    resize: opts.resize ?? 'cover',
  })
  if (opts.height) params.set('height', String(Math.round(opts.height)))
  return `${base}?${params.toString()}`
}
