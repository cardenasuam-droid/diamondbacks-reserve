import { z } from 'zod'
import type { PlayerPosition } from './types'

// Opciones de posición para el control segmentado del formulario.
export const POSITION_OPTIONS: ReadonlyArray<{ value: PlayerPosition; label: string }> = [
  { value: 'drive', label: 'Drive' },
  { value: 'reves', label: 'Revés' },
  { value: 'ambas', label: 'Ambas' },
]

const POSITION_VALUES: readonly string[] = POSITION_OPTIONS.map((o) => o.value)

// Teléfono: aceptamos formato libre (espacios, +, guiones) pero exigimos 7–15
// dígitos reales. Es el mismo dato que el login usará luego (últimos 4 dígitos).
const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Escribe tu teléfono')
  .refine((v) => {
    const digits = v.replace(/\D/g, '').length
    return digits >= 7 && digits <= 15
  }, 'Teléfono no válido (incluye al menos 7 dígitos)')

// Validación del formulario de inscripción. Mensajes en español (UI).
// Espejo, más estricto, de los CHECK de la migración 0014.
export const registrationSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Escribe tu nombre completo')
    .max(120, 'Nombre demasiado largo'),
  phone: phoneSchema,
  categoryCode: z.string().min(1, 'Elige una categoría'),
  position: z.string().refine((v) => POSITION_VALUES.includes(v), 'Elige tu posición de juego'),
})

export type RegistrationInput = z.infer<typeof registrationSchema>
