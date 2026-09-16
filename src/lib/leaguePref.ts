// Liga recordada en ESTE dispositivo (localStorage): el gate de '/' la usa
// para llevar directo a tu liga y no preguntar cada vez. Conveniencia por
// navegador, jamás fuente de verdad (la identidad multi-liga llega con
// persons, F3). Lecturas/escrituras con try/catch: en modo privado o con
// storage bloqueado la app debe funcionar igual (solo pregunta de nuevo).

const KEY = 'dbx.league.v1'

export function getLeaguePref(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setLeaguePref(slug: string): void {
  try {
    localStorage.setItem(KEY, slug)
  } catch {
    // sin storage: la elección vale solo para esta navegación
  }
}

export function clearLeaguePref(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nada que limpiar
  }
}
