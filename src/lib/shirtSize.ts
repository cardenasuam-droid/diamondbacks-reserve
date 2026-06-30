// Tallas de playera de la liga (XS–XXL). Fuente única compartida por el registro,
// el perfil del jugador (self-service) y la gestión del organizador (roster/pool).
// Espeja el enum `shirt_size` de la migración 0017.
export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

export type ShirtSize = (typeof SHIRT_SIZES)[number]

export function isShirtSize(v: unknown): v is ShirtSize {
  return typeof v === 'string' && (SHIRT_SIZES as readonly string[]).includes(v)
}
