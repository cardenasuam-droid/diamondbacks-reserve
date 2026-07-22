import { parseStat } from '@/components/ui/StatTile'

// El contador animado de StatTile parsea el valor para animar solo la cifra.
// Antes solo capturaba la parte ENTERA: "75.5%" animaba de 0 a 75 y remataba
// escribiendo "75%", perdiendo el decimal. El % de victorias viene de
// player_rankings con un decimal, así que pasaba en cuanto alguien no tenía un
// porcentaje redondo.
describe('parseStat', () => {
  it('conserva el decimal del porcentaje', () => {
    expect(parseStat('75.5%')).toEqual({ prefix: '', n: 75.5, suffix: '%', decimals: 1 })
  })

  it('un entero no gana decimales', () => {
    expect(parseStat('75%')).toEqual({ prefix: '', n: 75, suffix: '%', decimals: 0 })
  })

  it('separa el prefijo de posición', () => {
    expect(parseStat('#3')).toEqual({ prefix: '#', n: 3, suffix: '', decimals: 0 })
  })

  it('entiende los signos de una diferencia', () => {
    expect(parseStat('+12')).toMatchObject({ n: 12, decimals: 0 })
    expect(parseStat('-7')).toMatchObject({ n: -7, decimals: 0 })
  })

  it('un número entra tal cual', () => {
    expect(parseStat(42)).toEqual({ prefix: '', n: 42, suffix: '', decimals: 0 })
    expect(parseStat(4.5)).toEqual({ prefix: '', n: 4.5, suffix: '', decimals: 1 })
  })

  it('un texto sin cifra se muestra entero, sin animar', () => {
    expect(parseStat('—')).toEqual({ prefix: '', n: null, suffix: '—', decimals: 0 })
  })
})
