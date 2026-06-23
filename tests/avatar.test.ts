import { initialsOf } from '@/components/ui/Avatar'

describe('initialsOf', () => {
  it('toma la inicial de las dos primeras palabras', () => {
    expect(initialsOf('Bruja Cárdenas')).toBe('BC')
    expect(initialsOf('Ana María López')).toBe('AM')
  })

  it('una sola palabra → una inicial', () => {
    expect(initialsOf('Bruja')).toBe('B')
  })

  it('normaliza espacios y vacíos', () => {
    expect(initialsOf('  Pedro   Páez ')).toBe('PP')
    expect(initialsOf('')).toBe('?')
    expect(initialsOf('   ')).toBe('?')
  })
})
