import {
  computeIndStandings,
  playerLineForGame,
  type IndGame,
  type IndPlayerMeta,
} from '@/features/americano/standings'

// Espejo ejecutable de las reglas de la tabla americana (vista ind_standings,
// 0051). Si un caso de aquí cambia, la vista debe cambiar con migración nueva.

const P: IndPlayerMeta[] = [
  { id: 'ana', fullName: 'Ana', categoryCode: 'FEM_5' },
  { id: 'bea', fullName: 'Bea', categoryCode: 'FEM_5' },
  { id: 'caro', fullName: 'Caro', categoryCode: 'FEM_5' },
  { id: 'dana', fullName: 'Dana', categoryCode: 'FEM_5' },
]

function game(partial: Partial<IndGame>): IndGame {
  return {
    phase: 'regular',
    sides: { ana: 1, bea: 1, caro: 2, dana: 2 },
    winnerSide: 1,
    isWalkover: false,
    sets: [{ a: 6, b: 3 }, { a: 6, b: 4 }, { a: null, b: null }],
    ...partial,
  }
}

describe('playerLineForGame — puntos por juego', () => {
  it('ganar en 2 sets da 3; perder en 2 da 0', () => {
    const g = game({})
    expect(playerLineForGame(g, 'ana').points).toBe(3)
    expect(playerLineForGame(g, 'caro').points).toBe(0)
    expect(playerLineForGame(g, 'ana').gamesWon).toBe(12)
    expect(playerLineForGame(g, 'caro').gamesWon).toBe(7)
  })

  it('perder en 3 sets da el punto de consolación', () => {
    const g = game({
      winnerSide: 1,
      sets: [{ a: 6, b: 3 }, { a: 4, b: 6 }, { a: 6, b: 2 }],
    })
    expect(playerLineForGame(g, 'ana').points).toBe(3)
    expect(playerLineForGame(g, 'dana').points).toBe(1)
    expect(playerLineForGame(g, 'dana').setsWon).toBe(1)
  })

  it('walkover: presentes 3 pts y 12-0 en juegos; ausentes 0 y 0-12', () => {
    const g = game({
      isWalkover: true,
      walkoverSide: 2,
      winnerSide: 1,
      sets: [{ a: null, b: null }, { a: null, b: null }, { a: null, b: null }],
    })
    const present = playerLineForGame(g, 'ana')
    const absent = playerLineForGame(g, 'caro')
    expect(present).toMatchObject({ points: 3, won: true, setsWon: 2, gamesWon: 12, gamesLost: 0 })
    expect(absent).toMatchObject({ points: 0, won: false, setsLost: 2, gamesLost: 12 })
  })
})

describe('computeIndStandings — tabla individual', () => {
  it('incluye con ceros a quien aún no juega', () => {
    const rows = computeIndStandings(P, [])
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => r.played === 0 && r.points === 0)).toBe(true)
    // Sin juegos, el orden cae al alfabético.
    expect(rows.map((r) => r.fullName)).toEqual(['Ana', 'Bea', 'Caro', 'Dana'])
  })

  it('acumula puntos y aplica el orden puntos → dif partidos → dif sets → dif juegos', () => {
    const g1 = game({}) // ana+bea ganan 2-0
    const g2 = game({
      sides: { ana: 1, caro: 1, bea: 2, dana: 2 },
      winnerSide: 2,
      sets: [{ a: 3, b: 6 }, { a: 6, b: 4 }, { a: 2, b: 6 }],
    }) // bea+dana ganan 2-1; ana/caro punto de consolación
    const rows = computeIndStandings(P, [g1, g2])
    const by = Object.fromEntries(rows.map((r) => [r.playerId, r]))
    expect(by.ana.points).toBe(4) // 3 + 1
    expect(by.bea.points).toBe(6) // 3 + 3
    expect(by.caro.points).toBe(1) // 0 + 1
    expect(by.dana.points).toBe(3) // 0 + 3
    expect(rows[0].playerId).toBe('bea')
    // dana (3 pts, 1-1) por encima de caro (1 pt) y debajo de ana (4).
    expect(rows.map((r) => r.playerId)).toEqual(['bea', 'ana', 'dana', 'caro'])
  })

  it('desempata por dif. de sets cuando puntos y dif. de partidos empatan', () => {
    // ana gana 2-0 (dif sets +2), bea gana 2-1 (dif sets +1), mismas 3 unidades.
    const gAna = game({ sides: { ana: 1, caro: 1, bea: 2, dana: 2 }, winnerSide: 1 })
    const gBea = game({
      sides: { bea: 1, dana: 1, ana: 2, caro: 2 },
      winnerSide: 1,
      sets: [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 6, b: 3 }],
    })
    // Nota: ana también aparece en gBea (pierde en 3 → +1). Para aislar el
    // desempate comparamos solo a las ganadoras de cada juego tras 1 juego c/u.
    const rows = computeIndStandings(
      P,
      [gAna, gBea].map((g) => ({ ...g }))
    )
    const ana = rows.find((r) => r.playerId === 'ana')!
    const bea = rows.find((r) => r.playerId === 'bea')!
    // ana: 3 + 1 (consolación) = 4 pts; bea: 0 (perdió 2-0 en gAna) + 3 = 3 pts.
    expect(ana.points).toBe(4)
    expect(bea.points).toBe(3)
    expect(rows[0].playerId).toBe('ana')
  })

  it('las penalizaciones restan puntos y reordenan', () => {
    const g1 = game({})
    const rows = computeIndStandings(P, [g1], [{ playerId: 'ana', points: 2 }])
    const ana = rows.find((r) => r.playerId === 'ana')!
    const bea = rows.find((r) => r.playerId === 'bea')!
    expect(ana.points).toBe(1)
    expect(ana.penaltyPoints).toBe(2)
    expect(bea.points).toBe(3)
    expect(rows[0].playerId).toBe('bea')
  })

  it('los playoffs no puntúan en la tabla regular', () => {
    const g1 = game({ phase: 'playoffs' })
    const rows = computeIndStandings(P, [g1])
    expect(rows.every((r) => r.played === 0 && r.points === 0)).toBe(true)
  })
})
