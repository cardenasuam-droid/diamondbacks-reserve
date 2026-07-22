import { filterStatsRows, normalizar } from '@/features/stats/filterRows'

function fila(full_name: string, category_code = 'FEM_4', team_id: string | null = 't1') {
  return { full_name, category_code, team_id }
}

const ROSTER = [
  fila('María Fernanda Prado', 'FEM_3', 'legacy'),
  fila('Carolina Treviño', 'FEM_3', 'peak'),
  fila('Ana Escarcega', 'FEM_4', 'legacy'),
  fila('Alberto González', 'VAR_5', 'peak'),
]

describe('normalizar', () => {
  it('quita acentos y baja a minúsculas', () => {
    expect(normalizar('Treviño')).toBe('trevino')
    expect(normalizar('María Fernández')).toBe('maria fernandez')
  })
})

describe('filterStatsRows', () => {
  it('sin filtros devuelve todo', () => {
    expect(filterStatsRows(ROSTER, {})).toHaveLength(4)
    expect(filterStatsRows(ROSTER, { query: '', category: '', teamId: '' })).toHaveLength(4)
  })

  it('encuentra sin escribir los acentos', () => {
    const out = filterStatsRows(ROSTER, { query: 'trevino' })
    expect(out.map((r) => r.full_name)).toEqual(['Carolina Treviño'])
  })

  it('busca por PALABRAS sueltas, sin exigir el orden del nombre', () => {
    // Con nombres de tres o cuatro palabras, exigir el orden exacto hace que la
    // gente no se encuentre a sí misma.
    const out = filterStatsRows(ROSTER, { query: 'prado maria' })
    expect(out.map((r) => r.full_name)).toEqual(['María Fernanda Prado'])
  })

  it('filtra por categoría', () => {
    const out = filterStatsRows(ROSTER, { category: 'FEM_3' })
    expect(out).toHaveLength(2)
  })

  it('filtra por equipo', () => {
    const out = filterStatsRows(ROSTER, { teamId: 'legacy' })
    expect(out.map((r) => r.full_name)).toEqual(['María Fernanda Prado', 'Ana Escarcega'])
  })

  it('combina los filtros en AND', () => {
    const out = filterStatsRows(ROSTER, { category: 'FEM_3', teamId: 'legacy' })
    expect(out.map((r) => r.full_name)).toEqual(['María Fernanda Prado'])
  })

  it('sin coincidencias devuelve vacío, no todo', () => {
    expect(filterStatsRows(ROSTER, { query: 'zzz' })).toEqual([])
  })

  it('no muta el arreglo de entrada', () => {
    const copia = [...ROSTER]
    filterStatsRows(ROSTER, { query: 'ana' })
    expect(ROSTER).toEqual(copia)
  })
})
