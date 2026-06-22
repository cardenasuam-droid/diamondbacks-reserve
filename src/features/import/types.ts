// Tipos compartidos del importador. Una validación devuelve las filas válidas
// (ya tipadas y resueltas a ids cuando aplica), los errores bloqueantes y las
// advertencias no bloqueantes (spec §10.4 / §10.5).

export interface RowIssue {
  /** Fila de datos 1-based (sin contar la cabecera). 0 = problema global/agregado. */
  row: number
  message: string
}

export interface ImportValidation<T> {
  valid: T[]
  errors: RowIssue[]
  warnings: RowIssue[]
}

// Booleano tolerante para columnas tipo is_captain: true/1/sí/si/x → true.
export function parseBool(v: string | undefined): boolean {
  const s = (v ?? '').trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'sí' || s === 'si' || s === 'x' || s === 'yes'
}
