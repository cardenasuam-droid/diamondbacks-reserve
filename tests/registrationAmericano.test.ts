import { americanoRegistrationSchema, MAX_BLOCKED_SLOTS } from '@/features/registration/schemaAmericano'

// Bloques reales de la 6a Edición femenil (0049): 6:30, 7:45 y 9:00 pm.
const SLOTS = ['18:30', '19:45', '21:00']
const schema = americanoRegistrationSchema(SLOTS)

const valid = {
  fullName: 'Ana Gómez',
  phone: '614 123 4567',
  categoryCode: 'FEM_5',
  position: 'ambas',
  shirtSize: 'M',
  birthdate: '1990-05-14',
  blockedSlots: [] as string[],
  comment: '',
}

describe('americanoRegistrationSchema', () => {
  it('acepta una inscripción completa sin restricciones de horario', () => {
    expect(schema.safeParse(valid).success).toBe(true)
  })

  it('acepta vetar hasta el máximo de horarios permitido', () => {
    const r = schema.safeParse({ ...valid, blockedSlots: SLOTS.slice(0, MAX_BLOCKED_SLOTS) })
    expect(r.success).toBe(true)
  })

  it('rechaza vetar más horarios que el máximo (sería imposible de programar)', () => {
    const r = schema.safeParse({ ...valid, blockedSlots: SLOTS })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path[0]).toBe('blockedSlots')
  })

  it('rechaza un horario que no es bloque de la edición', () => {
    const r = schema.safeParse({ ...valid, blockedSlots: ['22:15'] })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path[0]).toBe('blockedSlots')
  })

  it('exige fecha de nacimiento válida y dentro de rango', () => {
    expect(schema.safeParse({ ...valid, birthdate: '' }).success).toBe(false)
    expect(schema.safeParse({ ...valid, birthdate: 'no-fecha' }).success).toBe(false)
    expect(schema.safeParse({ ...valid, birthdate: '1900-01-01' }).success).toBe(false)
    const future = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
    expect(schema.safeParse({ ...valid, birthdate: future }).success).toBe(false)
    // En la 5a edición jugaron menores (p. ej. 2013): el rango no exige mayoría de edad.
    expect(schema.safeParse({ ...valid, birthdate: '2013-10-15' }).success).toBe(true)
  })

  it('teléfono con formato libre pero 7–15 dígitos (igual que Reserve)', () => {
    expect(schema.safeParse({ ...valid, phone: '12345' }).success).toBe(false)
    expect(schema.safeParse({ ...valid, phone: '+52 (614) 123-4567' }).success).toBe(true)
  })

  it('comentario: opcional, máximo 500, y vacío se normaliza a undefined', () => {
    const ok = schema.safeParse({ ...valid, comment: '' })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.comment).toBeUndefined()
    expect(schema.safeParse({ ...valid, comment: 'x'.repeat(501) }).success).toBe(false)
  })

  it('exige posición y talla como en el formulario de Reserve', () => {
    expect(schema.safeParse({ ...valid, position: 'zurda' }).success).toBe(false)
    expect(schema.safeParse({ ...valid, shirtSize: 'XXXL' }).success).toBe(false)
  })
})
