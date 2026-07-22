// Lógica pura de resultados: a partir de los marcadores por set deriva el
// ganador y valida que el marcador sea coherente. Los puntos NO se calculan aquí
// (se DERIVAN en las vistas SQL, CLAUDE.md §3.4); esto solo decide el ganador y
// la validez para poder guardar.

export interface SetInput {
  a: number | null
  b: number | null
}

export interface DerivedResult {
  setsA: number
  setsB: number
  winnerSide: 'a' | 'b' | null
  /** Hay un ganador legal (mejor de 3): 2-0 o 2-1. */
  decided: boolean
  /** Mensaje de error del marcador, o null si es válido (aunque incompleto). */
  error: string | null
}

const VALID_COMBOS = new Set(['2-0', '0-2', '2-1', '1-2'])

/**
 * Set válido de pádel: 6 con margen de 2 (6-0..6-4), 7-5 o 7-6. El tercer set
 * también es set completo (reglamento: "todos los partidos se juegan a 3 sets").
 *
 * Espejo EXACTO de is_valid_padel_set (migración 0043), que es quien manda: esto
 * solo da feedback instantáneo en el editor de la capitana. Un retiro a media
 * partida no pasa esta validación a propósito — lo captura el organizador, cuyo
 * flujo no la aplica.
 */
export function validPadelSet(a: number, b: number): boolean {
  return (
    (a === 6 && b >= 0 && b <= 4) ||
    (a === 7 && (b === 5 || b === 6)) ||
    (b === 6 && a >= 0 && a <= 4) ||
    (b === 7 && (a === 5 || a === 6))
  )
}

/**
 * Máximo de juegos en un set. Se valida el RANGO, no la combinación legal: el
 * organizador debe poder capturar un retiro (3-1) o una corrección atípica, cosa
 * que la validación estricta de la capitana (validPadelSet) sí rechaza. Lo que
 * esto ataja es el dedazo — "65" en vez de "6" — que antes se guardaba tal cual.
 */
const MAX_JUEGOS = 7

export function deriveResult(sets: SetInput[]): DerivedResult {
  let setsA = 0
  let setsB = 0
  let error: string | null = null

  for (const s of sets) {
    // Un solo lado capturado: antes se ignoraba EN SILENCIO y el set se
    // persistía a medias. Ahora se avisa.
    if ((s.a == null) !== (s.b == null)) {
      error = 'Hay un set con un solo marcador: captura los dos o ninguno.'
      continue
    }
    if (s.a == null || s.b == null) continue // set vacío: se ignora
    if (s.a < 0 || s.b < 0) {
      error = 'Los marcadores no pueden ser negativos.'
      continue
    }
    if (s.a > MAX_JUEGOS || s.b > MAX_JUEGOS) {
      error = `Marcador fuera de rango: un set no pasa de ${MAX_JUEGOS} juegos.`
      continue
    }
    if (s.a === s.b) {
      error = 'Un set no puede quedar empatado (hay punto de oro).'
      continue
    }
    if (s.a > s.b) setsA++
    else setsB++
  }

  if (!error && (setsA > 2 || setsB > 2)) {
    error = 'Si un equipo gana los primeros 2 sets no se juega el tercero.'
  }

  const combo = `${setsA}-${setsB}`
  const decided = !error && VALID_COMBOS.has(combo)
  const winnerSide = decided ? (setsA > setsB ? 'a' : 'b') : null

  return { setsA, setsB, winnerSide, decided, error }
}
