import { z } from 'zod'
import { SHIRT_SIZES } from '@/lib/shirtSize'
import { POSITION_OPTIONS } from './schema'

const SHIRT_SIZE_VALUES: readonly string[] = SHIRT_SIZES
const POSITION_VALUES: readonly string[] = POSITION_OPTIONS.map((o) => o.value)

// Cuántos bloques puede vetar una jugadora. Con 3 horarios por jornada, vetar
// los 3 la vuelve imposible de programar; el formulario de la 5a edición ya
// advertía "menos horarios disponibles limita compañeras y rivales".
export const MAX_BLOCKED_SLOTS = 2

const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Escribe tu teléfono')
  .refine((v) => {
    const digits = v.replace(/\D/g, '').length
    return digits >= 7 && digits <= 15
  }, 'Teléfono no válido (incluye al menos 7 dígitos)')

// Cumpleaños: llega del <input type="date"> como 'YYYY-MM-DD'. Cordura de
// rango (espejo del CHECK de 0050), no verificación de mayoría de edad: en la
// 5a edición jugaron desde los ~13 años.
const birthdateSchema = z
  .string()
  .min(1, 'Elige tu fecha de nacimiento')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00`)
    if (Number.isNaN(d.getTime())) return false
    return d >= new Date('1920-01-01T00:00:00') && d <= new Date()
  }, 'Fecha de nacimiento no válida')

// Validación del formulario de inscripción de una liga AMERICANO (femenil).
// Los horarios vetados deben ser bloques reales de la edición (vienen de
// season_time_blocks): se construye el esquema con esa lista, data-driven.
export function americanoRegistrationSchema(allowedSlotLabels: readonly string[]) {
  return z.object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Escribe tu nombre y primer apellido')
      .max(120, 'Nombre demasiado largo'),
    phone: phoneSchema,
    categoryCode: z.string().min(1, 'Elige tu categoría'),
    position: z.string().refine((v) => POSITION_VALUES.includes(v), 'Elige tu posición de juego'),
    shirtSize: z.string().refine((v) => SHIRT_SIZE_VALUES.includes(v), 'Elige tu talla de playera'),
    birthdate: birthdateSchema,
    blockedSlots: z
      .array(z.string())
      .max(MAX_BLOCKED_SLOTS, `Puedes vetar máximo ${MAX_BLOCKED_SLOTS} horarios`)
      .refine(
        (arr) => arr.every((l) => allowedSlotLabels.includes(l)),
        'Horario no válido para esta edición'
      ),
    comment: z
      .string()
      .trim()
      .max(500, 'Máximo 500 caracteres')
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
}

export type AmericanoRegistrationInput = z.infer<ReturnType<typeof americanoRegistrationSchema>>
