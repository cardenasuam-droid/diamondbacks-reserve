import type { Round } from './types'

// Jornada en la que deben ABRIR /rol y /resultados. Antes ambas abrían en la
// última (J10, 28-sep) durante toda la temporada — el default más inútil posible.
//
// Dos modos, porque las dos pantallas miran en direcciones opuestas:
//   'upcoming' (rol): la PRÓXIMA jornada — la primera cuya fecha es hoy o
//              futura. Es la que el jugador quiere ver: dónde y cuándo juega.
//   'recent'   (resultados): la última jornada YA jugada (fecha hoy o pasada) —
//              donde caen los marcadores que se están revisando.
//
// Se compara por FECHA (round_date, un 'YYYY-MM-DD'), no por hora, así que "hoy"
// cuenta entero para los dos modos: el día de la jornada, el rol la muestra como
// próxima y resultados la muestra como la de hoy. Las jornadas se asumen en
// orden de round_number (así las entrega useRounds).
export function pickDefaultRound(
  rounds: Round[],
  today: string,
  mode: 'upcoming' | 'recent',
): string | undefined {
  if (rounds.length === 0) return undefined

  if (mode === 'upcoming') {
    // Primera con fecha >= hoy. Una jornada sin fecha se considera pendiente
    // (aún por jugar), así que también es candidata a "próxima".
    const next = rounds.find((r) => !r.round_date || r.round_date >= today)
    return (next ?? rounds[rounds.length - 1]).id
  }

  // 'recent': la última con fecha <= hoy. Sin fecha = aún no jugada, se excluye.
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].round_date && (rounds[i].round_date as string) <= today) {
      return rounds[i].id
    }
  }
  // Ninguna jugada todavía (pretemporada): la primera.
  return rounds[0].id
}
