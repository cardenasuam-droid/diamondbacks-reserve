import { parseCsv } from '@/features/import/parseCsv'
import { validateTeams } from '@/features/import/teamsImport'
import { validatePlayers, type PlayersContext } from '@/features/import/playersImport'
import { validateSchedule, type ScheduleContext } from '@/features/import/scheduleImport'

// ----------------------------------------------------------------------------
// parseCsv
// ----------------------------------------------------------------------------
describe('parseCsv', () => {
  it('parsea cabeceras y filas básicas', () => {
    const { headers, rows } = parseCsv('a,b\n1,2\n3,4')
    expect(headers).toEqual(['a', 'b'])
    expect(rows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })

  it('respeta comas dentro de comillas', () => {
    const { rows } = parseCsv('name,color\n"Rojo, S.A.",#fff')
    expect(rows[0].name).toBe('Rojo, S.A.')
    expect(rows[0].color).toBe('#fff')
  })

  it('admite comillas escapadas y CRLF', () => {
    const { rows } = parseCsv('a\r\n"di ""hola"""\r\n')
    expect(rows[0].a).toBe('di "hola"')
  })

  it('ignora líneas vacías y BOM', () => {
    const { headers, rows } = parseCsv('﻿a,b\n1,2\n\n')
    expect(headers).toEqual(['a', 'b'])
    expect(rows).toHaveLength(1)
  })
})

// ----------------------------------------------------------------------------
// validateTeams
// ----------------------------------------------------------------------------
describe('validateTeams', () => {
  it('acepta filas válidas', () => {
    const r = validateTeams([
      { team_name: 'Rojo', color: '#D72638', logo_url: '', captain_email: 'c@e.com' },
    ])
    expect(r.errors).toEqual([])
    expect(r.valid).toEqual([{ team_name: 'Rojo', color: '#D72638', logo_url: null }])
  })

  it('rechaza color inválido y email inválido', () => {
    const bad = validateTeams([{ team_name: 'X', color: 'rojo', logo_url: '', captain_email: '' }])
    expect(bad.errors[0].message).toMatch(/Color inválido/)
    const bad2 = validateTeams([{ team_name: 'X', color: '', logo_url: '', captain_email: 'no-mail' }])
    expect(bad2.errors[0].message).toMatch(/captain_email/)
  })

  it('detecta duplicados en el archivo y existentes en BD', () => {
    const dup = validateTeams([{ team_name: 'Rojo' }, { team_name: 'rojo' }] as never)
    expect(dup.errors[0].message).toMatch(/duplicado/)
    const exist = validateTeams([{ team_name: 'Rojo' }] as never, ['Rojo'])
    expect(exist.valid).toHaveLength(0)
    expect(exist.warnings[0].message).toMatch(/ya existe/)
  })
})

// ----------------------------------------------------------------------------
// validatePlayers
// ----------------------------------------------------------------------------
const PLAYERS_CTX: PlayersContext = {
  teams: [
    { id: 't1', name: 'Rojo' },
    { id: 't2', name: 'Azul' },
  ],
  categories: [
    { code: 'VAR_5', type: 'varonil' },
    { code: 'FEM_4', type: 'femenil' },
    { code: 'MIX_A', type: 'mixta' },
  ],
}

describe('validatePlayers', () => {
  it('acepta un jugador válido y resuelve el team_id', () => {
    const r = validatePlayers(
      [{ full_name: 'Juan', email: 'j@e.com', phone: '1', team_name: 'Rojo', gender: 'male', category_code: 'VAR_5', is_captain: 'true' }],
      PLAYERS_CTX,
    )
    expect(r.errors).toEqual([])
    expect(r.valid[0]).toMatchObject({ team_id: 't1', is_captain: true, gender: 'male' })
  })

  it('rechaza género inconsistente con la categoría', () => {
    const r = validatePlayers(
      [{ full_name: 'Ana', email: '', phone: '', team_name: 'Rojo', gender: 'female', category_code: 'VAR_5', is_captain: '' }],
      PLAYERS_CTX,
    )
    expect(r.errors[0].message).toMatch(/inconsistente/)
  })

  it('rechaza categoría mixta para un jugador', () => {
    const r = validatePlayers(
      [{ full_name: 'Ana', email: '', phone: '', team_name: 'Rojo', gender: 'female', category_code: 'MIX_A', is_captain: '' }],
      PLAYERS_CTX,
    )
    expect(r.errors[0].message).toMatch(/mixta/)
  })

  it('rechaza equipo inexistente y email duplicado', () => {
    const r = validatePlayers(
      [{ full_name: 'Juan', email: '', phone: '', team_name: 'Verde', gender: 'male', category_code: 'VAR_5', is_captain: '' }],
      PLAYERS_CTX,
    )
    expect(r.errors[0].message).toMatch(/inexistente/)
    const dup = validatePlayers(
      [
        { full_name: 'A', email: 'x@e.com', phone: '', team_name: 'Rojo', gender: 'male', category_code: 'VAR_5', is_captain: '' },
        { full_name: 'B', email: 'X@e.com', phone: '', team_name: 'Rojo', gender: 'male', category_code: 'VAR_5', is_captain: '' },
      ],
      PLAYERS_CTX,
    )
    expect(dup.errors.find((e) => /duplicado/.test(e.message))).toBeTruthy()
  })

  it('rechaza dos capitanes del mismo equipo y avisa si no hay capitán', () => {
    const two = validatePlayers(
      [
        { full_name: 'A', email: '', phone: '', team_name: 'Rojo', gender: 'male', category_code: 'VAR_5', is_captain: 'true' },
        { full_name: 'B', email: '', phone: '', team_name: 'Rojo', gender: 'male', category_code: 'VAR_5', is_captain: 'true' },
      ],
      PLAYERS_CTX,
    )
    expect(two.errors.find((e) => /capitán/.test(e.message))).toBeTruthy()

    const none = validatePlayers(
      [{ full_name: 'A', email: '', phone: '', team_name: 'Azul', gender: 'female', category_code: 'FEM_4', is_captain: '' }],
      PLAYERS_CTX,
    )
    expect(none.warnings.find((w) => /no tiene capitán/.test(w.message))).toBeTruthy()
  })
})

// ----------------------------------------------------------------------------
// validateSchedule
// ----------------------------------------------------------------------------
const NINE = ['VAR_4', 'VAR_5', 'VAR_6', 'FEM_4', 'FEM_5', 'FEM_6', 'FEM_7', 'MIX_A', 'MIX_B']
const SCHEDULE_CTX: ScheduleContext = {
  seasonName: 'Liga 2026',
  teams: Array.from({ length: 6 }, (_, i) => ({ id: `t${i + 1}`, name: `Equipo ${i + 1}` })),
  categories: NINE.map((code) => ({ code })),
  timeBlocks: [
    { id: 'tb1', label: '18:30', start_time: '18:30' },
    { id: 'tb2', label: '19:45', start_time: '19:45' },
    { id: 'tb3', label: '21:00', start_time: '21:00' },
  ],
  courts: Array.from({ length: 9 }, (_, i) => ({ id: `c${i + 1}`, number: i + 1 })),
}

// Genera una jornada completa válida: 3 enfrentamientos × 9 categorías = 27
// partidos, repartidos en 9 canchas × 3 horarios sin choques.
function fullRound(round: number): Record<string, string>[] {
  const pairs = [
    ['Equipo 1', 'Equipo 2'],
    ['Equipo 3', 'Equipo 4'],
    ['Equipo 5', 'Equipo 6'],
  ]
  const tb = ['18:30', '19:45', '21:00']
  const rows: Record<string, string>[] = []
  let i = 0
  for (const [a, b] of pairs) {
    for (const cat of NINE) {
      rows.push({
        season_name: 'Liga 2026',
        round_number: String(round),
        round_date: '2026-07-06',
        time_block: tb[Math.floor(i / 9)],
        court_number: String((i % 9) + 1),
        team_a: a,
        team_b: b,
        category_code: cat,
      })
      i++
    }
  }
  return rows
}

describe('validateSchedule', () => {
  it('acepta una jornada completa y bien armada', () => {
    const r = validateSchedule(fullRound(1), SCHEDULE_CTX)
    expect(r.errors).toEqual([])
    expect(r.valid).toHaveLength(27)
  })

  it('marca enfrentamiento sin sus 9 categorías y jornada incompleta', () => {
    const rows = fullRound(1).slice(0, 26) // quita el último partido
    const r = validateSchedule(rows, SCHEDULE_CTX)
    expect(r.errors.find((e) => /categorías/.test(e.message))).toBeTruthy()
    expect(r.errors.find((e) => /27/.test(e.message))).toBeTruthy()
  })

  it('detecta choque de cancha y horario', () => {
    const rows = fullRound(1)
    rows[1].court_number = rows[0].court_number
    rows[1].time_block = rows[0].time_block
    const r = validateSchedule(rows, SCHEDULE_CTX)
    expect(r.errors.find((e) => /Choque/.test(e.message))).toBeTruthy()
  })

  it('rechaza equipo y categoría inexistentes', () => {
    const r = validateSchedule(
      [
        {
          season_name: 'Liga 2026',
          round_number: '1',
          round_date: '2026-07-06',
          time_block: '18:30',
          court_number: '1',
          team_a: 'Fantasma',
          team_b: 'Equipo 2',
          category_code: 'VAR_4',
        },
      ],
      SCHEDULE_CTX,
    )
    expect(r.errors.find((e) => /inexistente/.test(e.message))).toBeTruthy()
  })

  it('detecta un equipo en dos enfrentamientos de la jornada', () => {
    const rows = fullRound(1)
    // Reapunta el tercer enfrentamiento para que Equipo 1 juegue dos veces.
    for (const row of rows) {
      if (row.team_a === 'Equipo 5') row.team_a = 'Equipo 1'
    }
    const r = validateSchedule(rows, SCHEDULE_CTX)
    expect(r.errors.find((e) => /dos enfrentamientos|2 enfrentamientos/.test(e.message))).toBeTruthy()
  })
})
