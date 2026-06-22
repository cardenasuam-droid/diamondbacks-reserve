import { emailSchema, passwordSchema, phoneLast4Schema, normalizeEmail } from '@/features/auth/schema'
import { playerAuthEmail, isPlayerAuthEmail, isSyntheticEmail } from '@/features/auth/playerAuth'
import { staffAuthEmail } from '@/features/auth/staffAuth'

describe('auth schema', () => {
  it('acepta correos válidos y normaliza', () => {
    expect(emailSchema.safeParse('  Foo@Bar.com ').success).toBe(true)
    expect(normalizeEmail('  Foo@Bar.com ')).toBe('foo@bar.com')
  })

  it('rechaza correos inválidos', () => {
    expect(emailSchema.safeParse('').success).toBe(false)
    expect(emailSchema.safeParse('no-arroba').success).toBe(false)
  })

  it('exige contraseña de al menos 6 caracteres', () => {
    expect(passwordSchema.safeParse('123456').success).toBe(true)
    expect(passwordSchema.safeParse('12345').success).toBe(false)
  })

  it('exige exactamente 4 dígitos en el teléfono', () => {
    expect(phoneLast4Schema.safeParse('1234').success).toBe(true)
    expect(phoneLast4Schema.safeParse('123').success).toBe(false)
    expect(phoneLast4Schema.safeParse('12ab').success).toBe(false)
  })
})

describe('emails sintéticos', () => {
  it('jugador: deriva del player_id y lo reconoce', () => {
    const email = playerAuthEmail('abc-123')
    expect(email).toBe('abc-123@players.local')
    expect(isPlayerAuthEmail(email)).toBe(true)
    expect(isPlayerAuthEmail('real@gmail.com')).toBe(false)
    expect(isPlayerAuthEmail(null)).toBe(false)
  })

  it('staff: deriva del staff_id', () => {
    expect(staffAuthEmail('s-1')).toBe('s-1@staff.local')
  })

  it('isSyntheticEmail reconoce jugador y staff, no correos reales', () => {
    expect(isSyntheticEmail('abc@players.local')).toBe(true)
    expect(isSyntheticEmail('s-1@staff.local')).toBe(true)
    expect(isSyntheticEmail('real@gmail.com')).toBe(false)
    expect(isSyntheticEmail(undefined)).toBe(false)
  })
})
