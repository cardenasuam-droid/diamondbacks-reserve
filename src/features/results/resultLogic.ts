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

export function deriveResult(sets: SetInput[]): DerivedResult {
  let setsA = 0
  let setsB = 0
  let error: string | null = null

  for (const s of sets) {
    if (s.a == null || s.b == null) continue // set incompleto: se ignora
    if (s.a < 0 || s.b < 0) {
      error = 'Los marcadores no pueden ser negativos.'
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
