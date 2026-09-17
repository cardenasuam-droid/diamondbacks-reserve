// Token de "Mi inscripción" (0057) recordado por dispositivo y por edición.
// Es la credencial del enlace mágico: quien lo tiene puede ver el estado de
// esa inscripción y adjuntar comprobantes. Conveniencia local; el enlace
// copiable es el respaldo si se cambia de teléfono.

const KEY = 'dbx.reg.v1.'

export function getRegToken(seasonId: string): string | null {
  try {
    return localStorage.getItem(KEY + seasonId)
  } catch {
    return null
  }
}

export function saveRegToken(seasonId: string, token: string): void {
  try {
    localStorage.setItem(KEY + seasonId, token)
  } catch {
    // sin storage: el enlace copiable sigue funcionando
  }
}
