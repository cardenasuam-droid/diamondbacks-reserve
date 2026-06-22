// Color de equipo seguro: valida hex (#RGB o #RRGGBB) o cae a un gris neutro.
export function teamColor(color: string | null | undefined, fallback = '#94a3b8'): string {
  const c = color?.trim()
  if (!c) return fallback
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : fallback
}
