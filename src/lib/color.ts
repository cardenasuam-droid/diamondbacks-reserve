// Color de equipo seguro: valida hex (#RGB o #RRGGBB) o cae a un gris neutro.
export function teamColor(color: string | null | undefined, fallback = '#94a3b8'): string {
  const c = color?.trim()
  if (!c) return fallback
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : fallback
}

// Superficie oscura sobre la que se pinta el texto de color (tarjetas de la app,
// tema neumórfico ónix-esmeralda: slate-100 = #161d14).
const SURFACE: [number, number, number] = [0x16, 0x1d, 0x14]

function parseHex(hex: string | null | undefined): [number, number, number] | null {
  const c = hex?.trim().replace(/^#/, '')
  if (!c) return null
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

function toHex([r, g, b]: [number, number, number]): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

// Luminancia relativa WCAG.
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Razón de contraste WCAG entre dos colores (1 = igual, 21 = negro/blanco). */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Devuelve el color de equipo ACLARADO lo justo para que se lea sobre la
 * superficie oscura de las tarjetas, conservando su identidad (el azul sigue
 * siendo azul, solo más claro).
 *
 * Por qué existe: los marcadores y el nombre del ganador se pintaban con el
 * color CRUDO del equipo. Cuatro de los seis equipos tienen colores oscuros
 * (Legacy #071736 azul casi negro, Peak #345c23 verde oscuro — invisible sobre
 * el fondo verde, Passio #1e13b9, Padel Center #7400c7), así que el marcador no
 * se apreciaba. Pintar de color un texto sobre fondo oscuro EXIGE garantizar el
 * contraste; no basta con el color de marca.
 *
 * Se mezcla hacia el blanco en pasos hasta alcanzar la razón de contraste
 * objetivo (4.5:1, AA para texto normal). Converge siempre: el blanco tiene ~18:1
 * sobre esta superficie, así que el objetivo se cumple mucho antes.
 */
export function readableOnDark(
  color: string | null | undefined,
  fallback = '#f1f6f0',
  minRatio = 4.5,
): string {
  const rgb = parseHex(color)
  if (!rgb) return fallback

  let cur = rgb
  // 24 pasos del 12% cubren de sobra hasta casi blanco (0.88^24 ≈ 0.05).
  for (let i = 0; i < 24; i++) {
    if (contrastRatio(cur, SURFACE) >= minRatio) break
    cur = [cur[0] + (255 - cur[0]) * 0.12, cur[1] + (255 - cur[1]) * 0.12, cur[2] + (255 - cur[2]) * 0.12]
  }
  return toHex(cur)
}
