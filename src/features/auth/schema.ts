import { z } from 'zod'

// Validación de los formularios de acceso. Mensajes en español.
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Escribe tu correo')
  .email('Correo no válido')

export const passwordSchema = z
  .string()
  .min(6, 'La contraseña debe tener al menos 6 caracteres')

// Últimos 4 dígitos del teléfono (verificación del primer registro).
export const phoneLast4Schema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, 'Escribe los últimos 4 dígitos de tu teléfono')

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}
