// Saneado de URLs de origen no confiable (contenido pegable: reglamento, noticias,
// logos, fotos). Bloquea esquemas peligrosos como `javascript:` o `data:` que, en
// un <a href>, ejecutarían JS en el origen de la app y podrían robar la sesión.
// Solo se admiten http(s) y mailto. Devuelve undefined si la URL no es segura.
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function safeUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  try {
    // Base = origen actual para resolver rutas relativas; los esquemas peligrosos
    // conservan su protocolo (p. ej. `javascript:`) y quedan fuera del allowlist.
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://localhost'
    const u = new URL(trimmed, base)
    return SAFE_PROTOCOLS.has(u.protocol) ? u.href : undefined
  } catch {
    return undefined
  }
}

/** ¿La URL es segura (http/https/mailto) o vacía? Para validar antes de guardar. */
export function isSafeOrEmptyUrl(raw: string | null | undefined): boolean {
  if (!raw || !raw.trim()) return true
  return safeUrl(raw) !== undefined
}
