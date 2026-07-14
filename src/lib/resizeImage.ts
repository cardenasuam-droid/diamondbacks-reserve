// Redimensiona una imagen EN EL CLIENTE antes de subirla. Las fotos de celular
// llegan a 3–9 MB; guardarlas full-res infla el Storage sin ninguna ventaja (las
// pantallas se sirven con miniaturas al vuelo, ver lib/image.ts). Reduce el lado
// mayor a maxDim y recomprime. Conserva el tipo (PNG mantiene transparencia para
// logos). GIF (animado) y no-imágenes se devuelven intactos. Si algo falla o no
// mejora el peso, devuelve el archivo original — nunca bloquea la subida.

export interface ResizeOpts {
  maxDim?: number
  quality?: number
}

export async function resizeImage(file: File, opts: ResizeOpts = {}): Promise<File> {
  const maxDim = opts.maxDim ?? 1600
  const quality = opts.quality ?? 0.85
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    // Ya es chica en dimensiones y peso: no vale la pena reprocesar.
    if (scale >= 1 && file.size < 600 * 1024) {
      bitmap.close?.()
      return file
    }
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close?.()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    // Conserva PNG/WEBP (transparencia); todo lo demás sale JPEG.
    const type =
      file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality))
    if (!blob || blob.size >= file.size) return file // no mejoró → original

    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
    const base = file.name.replace(/\.[^.]+$/, '') || 'foto'
    return new File([blob], `${base}.${ext}`, { type })
  } catch {
    return file
  }
}
