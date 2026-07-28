import { readableOnDark, contrastRatio, teamColor } from '@/lib/color'

const SURFACE: [number, number, number] = [0x16, 0x1d, 0x14]

function toRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '')
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]
}

// Colores REALES de los seis equipos (2026-07). Cuatro son oscuros y fallaban.
const EQUIPOS: Record<string, string> = {
  'Bella Berry': '#ffffff',
  Legacy: '#071736',
  'Padel Center': '#7400c7',
  Passio: '#1e13b9',
  'Peak Padel': '#345c23',
  Sinergia: '#ff9500',
}

describe('readableOnDark', () => {
  it('cada color de equipo queda legible (>= 4.5:1) sobre la superficie oscura', () => {
    for (const [nombre, color] of Object.entries(EQUIPOS)) {
      const ratio = contrastRatio(toRgb(readableOnDark(color)), SURFACE)
      expect(ratio, `${nombre} (${color})`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('el caso reportado — Legacy azul oscuro — pasa de ilegible a legible', () => {
    const antes = contrastRatio(toRgb('#071736'), SURFACE)
    const despues = contrastRatio(toRgb(readableOnDark('#071736')), SURFACE)
    expect(antes).toBeLessThan(4.5) // el problema original
    expect(despues).toBeGreaterThanOrEqual(4.5)
  })

  it('conserva la identidad: un azul oscuro se aclara pero sigue siendo azulado', () => {
    // El canal azul domina sobre el rojo y el verde tras aclarar.
    const [r, g, b] = toRgb(readableOnDark('#071736'))
    expect(b).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(g)
  })

  it('un color que YA contrasta no se toca de más', () => {
    // El naranja de Sinergia ya es brillante; no debe volverse casi blanco.
    const [r, g, b] = toRgb(readableOnDark('#ff9500'))
    expect(r).toBeGreaterThan(b) // sigue siendo cálido
    expect(contrastRatio([r, g, b], SURFACE)).toBeGreaterThanOrEqual(4.5)
  })

  it('el blanco se queda blanco', () => {
    expect(readableOnDark('#ffffff')).toBe('#ffffff')
  })

  it('un color inválido o ausente cae a la tinta clara por defecto', () => {
    expect(readableOnDark(null)).toBe('#f1f6f0')
    expect(readableOnDark('rojo')).toBe('#f1f6f0')
    expect(readableOnDark('#zzz')).toBe('#f1f6f0')
  })

  it('acepta hex de 3 dígitos', () => {
    // #00f (azul puro) es oscuro; debe aclararse y contrastar.
    expect(contrastRatio(toRgb(readableOnDark('#00f')), SURFACE)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('teamColor (sin cambios)', () => {
  it('valida hex y cae al fallback', () => {
    expect(teamColor('#ff9500')).toBe('#ff9500')
    expect(teamColor(null, '#123456')).toBe('#123456')
    expect(teamColor('no-hex', '#123456')).toBe('#123456')
  })
})
