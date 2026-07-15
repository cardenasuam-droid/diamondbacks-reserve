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

// Supabase cobra por transformación ÚNICA (imagen + parámetros). Para no generar
// una por cada tamaño de avatar de la app, se agrupa el ancho en pocas cubetas:
// así cada foto se transforma en ≤3 anchos, no en uno por cada medida de pantalla.
const WIDTH_BUCKETS = [96, 192, 384]
function bucketWidth(w: number): number {
  const r = Math.round(w)
  return WIDTH_BUCKETS.find((b) => r <= b) ?? Math.max(r, WIDTH_BUCKETS[WIDTH_BUCKETS.length - 1])
}

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
  // Con height (p. ej. la ficha en contain) se respeta el tamaño exacto: es UNA
  // variante por foto. Sin height (avatares/logos en muchos tamaños) se agrupa el
  // ancho en cubetas para minimizar transformaciones únicas.
  const width = opts.height ? Math.round(opts.width) : bucketWidth(opts.width)
  const params = new URLSearchParams({
    width: String(width),
    quality: String(opts.quality ?? 65),
    resize: opts.resize ?? 'cover',
  })
  if (opts.height) params.set('height', String(Math.round(opts.height)))
  return `${base}?${params.toString()}`
}
