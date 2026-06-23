import { isDevUser } from '@/features/auth/devRole'
import { navAllows } from '@/components/nav/navItems'

// Bruja (u otro nombre en la lista) puede abrir la consola /dev y previsualizar
// pantallas aunque su rol real sea "player". Ver navItems gate 'dev'.
describe('isDevUser', () => {
  it('reconoce a Bruja sin importar mayúsculas ni espacios', () => {
    expect(isDevUser('Bruja')).toBe(true)
    expect(isDevUser('bruja')).toBe(true)
    expect(isDevUser('  BRUJA ')).toBe(true)
  })

  it('rechaza a otros usuarios y a valores vacíos', () => {
    expect(isDevUser('Pedro')).toBe(false)
    expect(isDevUser('')).toBe(false)
    expect(isDevUser(null)).toBe(false)
    expect(isDevUser(undefined)).toBe(false)
  })
})

describe('navAllows: gate dev', () => {
  it('el grupo Desarrollo se muestra solo cuando isDev es true', () => {
    expect(navAllows('dev', 'player', true, true)).toBe(true)
    expect(navAllows('dev', 'player', true, false)).toBe(false)
    expect(navAllows('dev', null, false, false)).toBe(false)
  })

  it('no altera el resto de gates', () => {
    expect(navAllows('public', null, false)).toBe(true)
    expect(navAllows('session', null, false)).toBe(false)
    expect(navAllows('organizer', 'organizer', true)).toBe(true)
    expect(navAllows('organizer', 'player', true)).toBe(false)
    expect(navAllows('content', 'web_manager', true)).toBe(true)
  })
})
