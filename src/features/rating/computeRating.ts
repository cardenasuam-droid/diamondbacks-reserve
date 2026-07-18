// Motor de rating ELO — matemática pura (migración 0039).
//
// Es EL CORAZÓN del sistema junto con validateLineup (CLAUDE.md §1), así que vive
// aquí sin dependencias de Supabase ni de React y se prueba entero con Vitest.
//
// INVARIANTE QUE NO SE PUEDE ROMPER: suma cero. Lo que gana la pareja ganadora lo
// pierde exactamente la perdedora. De ahí salen dos reglas que parecen detalles y
// no lo son:
//
//   1. El multiplicador de margen se calcula UNA vez por partido, desde el lado
//      del ganador. Si cada lado usara su propia diferencia de juegos, el perdedor
//      se acotaría en el piso mientras el ganador va por arriba, y el partido
//      dejaría de sumar cero.
//   2. El delta se redondea UNA vez, aquí, y los cuatro jugadores usan ese mismo
//      entero. Redondear por jugador desviaría unas décimas por partido que a lo
//      largo de 330 partidos se acumulan.
//
// Por qué importa tanto: las 8 categorías de ranking forman TRES grupos que nunca
// se cruzan en la cancha (VAR_4·VAR_5·FEM_3·FEM_4 / VAR_6·FEM_5 / FEM_6·FEM_7).
// La suma cero es lo único que mantiene congelada la media de cada grupo, y por
// tanto lo único que hace que comparar un FEM_6 con un VAR_5 en el ranking global
// siga significando en septiembre lo mismo que en julio.

export interface RatingSettings {
  /** Cuánto se mueve como máximo un partido. Tabla rating_settings. */
  k_factor: number
  /** Cuántos puntos de diferencia valen ~85% de probabilidad. */
  divisor: number
  mov_base: number
  mov_step: number
  mov_min: number
  mov_max: number
  /** Los walkovers no mueven el rating: nadie jugó. */
  count_walkovers: boolean
}

/** Espejo de los DEFAULT de rating_settings en la migración 0039. */
export const DEFAULT_RATING_SETTINGS: RatingSettings = {
  k_factor: 60,
  divisor: 400,
  mov_base: 0.75,
  mov_step: 0.05,
  mov_min: 0.75,
  mov_max: 1.35,
  count_walkovers: false,
}

/**
 * Probabilidad de que gane la pareja `propio` contra la pareja `rival`.
 * Rating de pareja = promedio de sus dos jugadores (lo calcula quien llama).
 */
export function expectedScore(propio: number, rival: number, divisor: number): number {
  return 1 / (1 + Math.pow(10, (rival - propio) / divisor))
}

/**
 * Multiplicador por margen de juegos.
 *
 * `m` es la ventaja de juegos DEL GANADOR, nunca negativa. El `max(0, …)` no es
 * defensivo de más: en pádel se puede ganar con menos juegos que el rival
 * (7-5 0-6 7-5 son 14 juegos contra 16). Con valor absoluto, ese partido daría
 * un multiplicador alto y el sistema PREMIARÍA al ganador por haber ganado menos
 * juegos. Con max(0, …) cae al piso, que es lo que corresponde.
 */
export function movMultiplier(juegosGanador: number, juegosPerdedor: number, s: RatingSettings): number {
  const m = Math.max(0, juegosGanador - juegosPerdedor)
  const bruto = s.mov_base + s.mov_step * m
  return Math.min(s.mov_max, Math.max(s.mov_min, bruto))
}

export interface MatchDeltaInput {
  /** Promedio de rating de la pareja que GANÓ. */
  ratingGanadora: number
  /** Promedio de rating de la pareja que PERDIÓ. */
  ratingPerdedora: number
  juegosGanador: number
  juegosPerdedor: number
  settings?: RatingSettings
}

export interface MatchDeltaResult {
  /** Puntos que gana CADA integrante de la pareja ganadora (y pierde cada perdedor). */
  delta: number
  /** Probabilidad que el modelo daba a la pareja ganadora, 0..1. */
  expected: number
  mov: number
}

/**
 * Delta de un partido, ya redondeado a entero.
 *
 * El resultado entra como victoria/derrota pura (S = 1 / 0) y el marcador solo
 * modula la magnitud vía `mov`. Esa elección es deliberada: con un marcador
 * continuo (S = juegos ganados / totales) un favorito que gana 6-4 6-4 obtendría
 * S = 0.60 contra una expectativa de 0.76 y BAJARÍA de rating habiendo ganado el
 * partido. Es defendible estadísticamente e indefendible en el vestuario.
 */
export function matchDelta(input: MatchDeltaInput): MatchDeltaResult {
  const s = input.settings ?? DEFAULT_RATING_SETTINGS
  const expected = expectedScore(input.ratingGanadora, input.ratingPerdedora, s.divisor)
  const mov = movMultiplier(input.juegosGanador, input.juegosPerdedor, s)
  // Redondeo ÚNICO. Los cuatro jugadores usan este mismo entero.
  const delta = Math.round(s.k_factor * mov * (1 - expected))
  return { delta, expected, mov }
}

/** Promedio de rating de una pareja. */
export function pairRating(a: number, b: number): number {
  return (a + b) / 2
}

export interface SetScore {
  a: number | null
  b: number | null
}

export interface MatchTally {
  setsA: number
  setsB: number
  juegosA: number
  juegosB: number
  /** 'a' | 'b' | null si el marcador no decide un ganador. */
  ganador: 'a' | 'b' | null
}

/**
 * Cuenta sets y juegos de un marcador.
 *
 * Deriva el ganador de los SETS y no de match_results.winner_team_id, igual que
 * hacen las vistas de 0003_views.sql: no existe constraint que mantenga esa
 * columna coherente con el marcador, así que la fuente de verdad son los sets.
 * Los sets incompletos (algún lado null) se ignoran.
 */
export function tallyMatch(sets: SetScore[]): MatchTally {
  let setsA = 0
  let setsB = 0
  let juegosA = 0
  let juegosB = 0

  for (const s of sets) {
    if (s.a == null || s.b == null) continue
    juegosA += s.a
    juegosB += s.b
    if (s.a > s.b) setsA += 1
    else if (s.b > s.a) setsB += 1
  }

  // Al mejor de 3: gana quien llegue a 2 sets. Un 1-1 con el tercero sin capturar
  // no decide, y ese partido no debe mover el rating de nadie.
  const ganador = setsA >= 2 && setsA > setsB ? 'a' : setsB >= 2 && setsB > setsA ? 'b' : null

  return { setsA, setsB, juegosA, juegosB, ganador }
}
