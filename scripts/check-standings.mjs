// Verificador de invariantes de la tabla y del ranking individual.
//
// POR QUÉ EXISTE: los puntos, la tabla y el ranking se DERIVAN en vistas SQL
// (CLAUDE.md §3.4, 0003_views.sql) que no tienen ni un solo test — son el
// corazón del producto y hasta la primera jornada nunca corrieron con datos
// reales. Este script recalcula todo EN JAVASCRIPT, partiendo del REGLAMENTO y
// de los marcadores crudos, y lo compara contra lo que devuelven las vistas.
//
// La independencia es el punto: si tradujera el SQL, coincidiría con la vista
// aunque la vista estuviera mal. Aquí las reglas se escriben desde el
// reglamento (plan §"Puntos"), así que una discrepancia significa que una de
// las dos implementaciones se equivocó — y hay que mirar cuál.
//
// Uso:  node scripts/check-standings.mjs
// Corre tras cada jornada. Solo lecturas, con la anon key (todo es público).

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

// Estados que cuentan como resultado oficial (0003_views.sql:27 y score.ts).
const OFICIALES = new Set(['validated', 'walkover', 'corrected'])

// --- REGLAMENTO, escrito desde cero -----------------------------------------
//
// Puntos por partido: gana en 2 sets → 3/0 · gana en 3 sets → 3/1 · W.O. → 3/0.
// Walkover: el que se presenta gana 6-0 6-0 (2 sets, 12 juegos); el ausente 0.
//
// Devuelve el resumen del partido para CADA lado: {won, points, sets, games}.
function calcularPartido(r) {
  if (r.is_walkover) {
    const ausente = r.walkover_team_id
    const lado = (teamId) =>
      teamId === ausente
        ? { won: false, points: 0, setsWon: 0, setsLost: 2, gamesWon: 0, gamesLost: 12 }
        : { won: true, points: 3, setsWon: 2, setsLost: 0, gamesWon: 12, gamesLost: 0 }
    return { a: lado(r.team_a_id), b: lado(r.team_b_id) }
  }

  const sets = [
    [r.set1_team_a, r.set1_team_b],
    [r.set2_team_a, r.set2_team_b],
    [r.set3_team_a, r.set3_team_b],
  ].filter(([a, b]) => a != null && b != null)

  let setsA = 0
  let setsB = 0
  let juegosA = 0
  let juegosB = 0
  for (const [a, b] of sets) {
    juegosA += a
    juegosB += b
    if (a > b) setsA += 1
    else if (b > a) setsB += 1
  }

  const ganaA = setsA > setsB
  // Perder en 3 sets vale 1 punto; perder en 2, cero.
  const puntosPerdedor = Math.min(setsA, setsB) >= 1 ? 1 : 0

  return {
    a: {
      won: ganaA,
      points: ganaA ? 3 : puntosPerdedor,
      setsWon: setsA,
      setsLost: setsB,
      gamesWon: juegosA,
      gamesLost: juegosB,
    },
    b: {
      won: !ganaA,
      points: !ganaA ? 3 : puntosPerdedor,
      setsWon: setsB,
      setsLost: setsA,
      gamesWon: juegosB,
      gamesLost: juegosA,
    },
  }
}

// --- Autocomprobación del propio verificador ---------------------------------
//
// Con la temporada recién empezada este script puede pasar sin comparar nada y
// decir "todo cuadra" de forma vacía. Estos casos, tomados del reglamento,
// comprueban que la implementación de arriba SABE calcular antes de que se le
// permita opinar sobre los datos. Si esto falla, el verificador está roto y no
// hay que creerle nada de lo que diga después.
function autoComprobar() {
  const casos = [
    {
      nombre: 'gana en 2 sets → 3/0',
      r: { is_walkover: false, team_a_id: 'A', team_b_id: 'B',
           set1_team_a: 6, set1_team_b: 4, set2_team_a: 6, set2_team_b: 3,
           set3_team_a: null, set3_team_b: null },
      esperado: { aPuntos: 3, bPuntos: 0, aSets: 2, bSets: 0, aJuegos: 12, bJuegos: 7 },
    },
    {
      nombre: 'gana en 3 sets → 3/1 (el perdedor puntúa)',
      r: { is_walkover: false, team_a_id: 'A', team_b_id: 'B',
           set1_team_a: 6, set1_team_b: 4, set2_team_a: 4, set2_team_b: 6,
           set3_team_a: 6, set3_team_b: 3 },
      esperado: { aPuntos: 3, bPuntos: 1, aSets: 2, bSets: 1, aJuegos: 16, bJuegos: 13 },
    },
    {
      nombre: 'walkover → 3/0 con 6-0 6-0 sintético',
      r: { is_walkover: true, team_a_id: 'A', team_b_id: 'B', walkover_team_id: 'B',
           set1_team_a: null, set1_team_b: null, set2_team_a: null, set2_team_b: null,
           set3_team_a: null, set3_team_b: null },
      esperado: { aPuntos: 3, bPuntos: 0, aSets: 2, bSets: 0, aJuegos: 12, bJuegos: 0 },
    },
    {
      nombre: 'el ganador puede tener MENOS juegos (7-5 0-6 7-5)',
      r: { is_walkover: false, team_a_id: 'A', team_b_id: 'B',
           set1_team_a: 7, set1_team_b: 5, set2_team_a: 0, set2_team_b: 6,
           set3_team_a: 7, set3_team_b: 5 },
      esperado: { aPuntos: 3, bPuntos: 1, aSets: 2, bSets: 1, aJuegos: 14, bJuegos: 16 },
    },
  ]

  const fallos = []
  for (const c of casos) {
    const { a, b } = calcularPartido(c.r)
    const real = {
      aPuntos: a.points, bPuntos: b.points,
      aSets: a.setsWon, bSets: b.setsWon,
      aJuegos: a.gamesWon, bJuegos: b.gamesWon,
    }
    for (const [k, v] of Object.entries(c.esperado)) {
      if (real[k] !== v) fallos.push(`${c.nombre}: ${k} esperado=${v} obtenido=${real[k]}`)
    }
  }
  return fallos
}

const fallosPropios = autoComprobar()
if (fallosPropios.length > 0) {
  console.log('❌ EL VERIFICADOR ESTÁ ROTO — no calcula bien el reglamento:\n')
  for (const f of fallosPropios) console.log('  · ' + f)
  // El throw corta aquí y sale con código ≠ 0: si el verificador no calcula bien
  // el reglamento, no se le permite opinar sobre los datos.
  throw new Error('Autocomprobación fallida: no se compara nada contra la base.')
}

const vacio = () => ({
  played: 0,
  won: 0,
  lost: 0,
  points: 0,
  sets_won: 0,
  sets_lost: 0,
  games_won: 0,
  games_lost: 0,
})

function acumular(acc, lado) {
  acc.played += 1
  acc.won += lado.won ? 1 : 0
  acc.lost += lado.won ? 0 : 1
  acc.points += lado.points
  acc.sets_won += lado.setsWon
  acc.sets_lost += lado.setsLost
  acc.games_won += lado.gamesWon
  acc.games_lost += lado.gamesLost
  return acc
}

// --- Datos crudos ------------------------------------------------------------

const { data: resultados, error: e1 } = await supabase.from('match_results').select(`
  match_id, status, is_walkover, walkover_team_id, winner_team_id,
  set1_team_a, set1_team_b, set2_team_a, set2_team_b, set3_team_a, set3_team_b,
  match:matches!inner(
    id, category_code,
    round:rounds!inner(id, round_number, season_id),
    matchup:team_matchups!inner(id, team_a_id, team_b_id)
  )
`)
if (e1) throw e1

const oficiales = (resultados ?? [])
  .filter((r) => OFICIALES.has(r.status))
  .map((r) => ({
    ...r,
    team_a_id: r.match.matchup.team_a_id,
    team_b_id: r.match.matchup.team_b_id,
    round_number: r.match.round.round_number,
    category_code: r.match.category_code,
  }))

const reportados = (resultados ?? []).filter((r) => r.status === 'reported').length

console.log(`Resultados: ${resultados?.length ?? 0} en total · ${oficiales.length} oficiales · ${reportados} por validar`)

// Sin resultados oficiales el flujo sigue igual: los acumuladores quedan
// vacíos, las vistas deben devolver ceros y la comparación pasa. Es la
// comprobación correcta para una temporada recién empezada, no un caso especial.

// --- Recálculo propio --------------------------------------------------------

const equipos = new Map() // team_id -> acumulado
const jugadores = new Map() // player_id -> acumulado
const problemas = []

// Alineaciones para atribuir a jugadores (mismo criterio que player_rankings:
// la entrada del partido, por equipo).
const { data: entradas, error: e2 } = await supabase
  .from('lineup_entries')
  .select('match_id, player_1_id, player_2_id, lineup:lineups!inner(team_id)')
if (e2) throw e2

const parejaPorPartidoEquipo = new Map() // `${match_id}|${team_id}` -> [p1, p2]
for (const e of entradas ?? []) {
  parejaPorPartidoEquipo.set(`${e.match_id}|${e.lineup.team_id}`, [e.player_1_id, e.player_2_id])
}

for (const r of oficiales) {
  const { a, b } = calcularPartido(r)

  // Invariante del reglamento: el reparto de puntos de un partido solo puede
  // ser 3-0 o 3-1. Cualquier otra cosa (3-3, 0-0, 1-1) es un marcador que la
  // vista aceptaría en silencio.
  const reparto = [a.points, b.points].sort((x, y) => y - x).join('-')
  if (reparto !== '3-0' && reparto !== '3-1') {
    problemas.push(
      `J${r.round_number} ${r.category_code}: reparto de puntos ${reparto} (debe ser 3-0 o 3-1) — marcador incompleto o empatado`,
    )
  }

  // El ganador guardado debe coincidir con el derivado de los sets. Las vistas
  // ignoran winner_team_id y lo recalculan; si divergen, la UI pública (que SÍ
  // lo lee) mostraría un ganador distinto al de la tabla.
  const ganadorDerivado = a.won ? r.team_a_id : r.team_b_id
  if (r.winner_team_id && r.winner_team_id !== ganadorDerivado) {
    problemas.push(
      `J${r.round_number} ${r.category_code}: winner_team_id guardado NO coincide con el derivado de los sets`,
    )
  }

  acumular(equipos.get(r.team_a_id) ?? equipos.set(r.team_a_id, vacio()).get(r.team_a_id), a)
  acumular(equipos.get(r.team_b_id) ?? equipos.set(r.team_b_id, vacio()).get(r.team_b_id), b)

  for (const [teamId, lado] of [
    [r.team_a_id, a],
    [r.team_b_id, b],
  ]) {
    const pareja = parejaPorPartidoEquipo.get(`${r.match_id}|${teamId}`)
    if (!pareja || !pareja[0] || !pareja[1]) {
      problemas.push(
        `J${r.round_number} ${r.category_code}: resultado oficial SIN alineación completa de un equipo — ese partido no suma a ningún jugador`,
      )
      continue
    }
    for (const pid of pareja) {
      acumular(jugadores.get(pid) ?? jugadores.set(pid, vacio()).get(pid), lado)
    }
  }
}

// --- Comparación contra las vistas ------------------------------------------

const CAMPOS = ['played', 'won', 'lost', 'points', 'sets_won', 'sets_lost', 'games_won', 'games_lost']

const { data: tabla, error: e3 } = await supabase.from('team_standings').select('*')
if (e3) throw e3

let difEquipos = 0
for (const fila of tabla ?? []) {
  const mio = equipos.get(fila.team_id) ?? vacio()
  for (const c of CAMPOS) {
    if (Number(fila[c]) !== mio[c]) {
      problemas.push(`TABLA ${fila.team_name}: ${c} vista=${fila[c]} calculado=${mio[c]}`)
      difEquipos += 1
    }
  }
  // Las diferencias son campos derivados: se comprueban aparte.
  if (Number(fila.set_diff) !== mio.sets_won - mio.sets_lost) {
    problemas.push(`TABLA ${fila.team_name}: set_diff vista=${fila.set_diff} calculado=${mio.sets_won - mio.sets_lost}`)
    difEquipos += 1
  }
  if (Number(fila.game_diff) !== mio.games_won - mio.games_lost) {
    problemas.push(`TABLA ${fila.team_name}: game_diff vista=${fila.game_diff} calculado=${mio.games_won - mio.games_lost}`)
    difEquipos += 1
  }
}

const { data: ranking, error: e4 } = await supabase.from('player_rankings').select('*').gt('matches_played', 0)
if (e4) throw e4

let difJugadores = 0
const mapaVista = new Map((ranking ?? []).map((p) => [p.player_id, p]))
for (const [pid, mio] of jugadores) {
  const fila = mapaVista.get(pid)
  if (!fila) {
    problemas.push(`RANKING: el jugador ${pid} jugó ${mio.played} partido(s) pero NO aparece en la vista`)
    difJugadores += 1
    continue
  }
  const pares = [
    ['matches_played', mio.played],
    ['matches_won', mio.won],
    ['matches_lost', mio.lost],
    ['points_contributed', mio.points],
    ['sets_won', mio.sets_won],
    ['sets_lost', mio.sets_lost],
    ['games_won', mio.games_won],
    ['games_lost', mio.games_lost],
  ]
  for (const [campo, valor] of pares) {
    if (Number(fila[campo]) !== valor) {
      problemas.push(`RANKING ${fila.full_name}: ${campo} vista=${fila[campo]} calculado=${valor}`)
      difJugadores += 1
    }
  }
}
for (const fila of ranking ?? []) {
  if (!jugadores.has(fila.player_id)) {
    problemas.push(`RANKING ${fila.full_name}: la vista le da ${fila.matches_played} partido(s) pero el cálculo no le da ninguno`)
    difJugadores += 1
  }
}

// --- Suma global: control cruzado -------------------------------------------
//
// Los puntos totales repartidos deben ser exactamente la suma partido a partido.
// Si la tabla y este cálculo coinciden campo a campo pero el total no cuadra,
// hay filas de per_team_match que no pertenecen a ningún equipo de la tabla.
const puntosCalculados = [...equipos.values()].reduce((s, e) => s + e.points, 0)
const puntosVista = (tabla ?? []).reduce((s, t) => s + Number(t.points), 0)
if (puntosCalculados !== puntosVista) {
  problemas.push(`TOTAL de puntos: vista=${puntosVista} calculado=${puntosCalculados}`)
}

// --- Informe -----------------------------------------------------------------

console.log(`Equipos comparados: ${tabla?.length ?? 0} · jugadores con partidos: ${jugadores.size}`)
console.log(`Puntos repartidos: ${puntosCalculados}`)

// process.exitCode y no process.exit(): salir a la fuerza con peticiones HTTP
// aún abiertas revienta libuv en Windows (assertion en async.c). Así el proceso
// termina solo cuando el event loop drena, con el código correcto.
if (problemas.length === 0) {
  console.log('\n✅ TODO CUADRA: la tabla y el ranking coinciden con el recálculo independiente.')
} else {
  console.log(`\n❌ ${problemas.length} discrepancia(s):\n`)
  for (const p of problemas) console.log('  · ' + p)
  console.log(
    `\n(${difEquipos} en la tabla, ${difJugadores} en el ranking, ${problemas.length - difEquipos - difJugadores} de coherencia del marcador)`,
  )
  process.exitCode = 1
}
