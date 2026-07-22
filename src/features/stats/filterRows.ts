// Filtro compartido de las tablas de /estadisticas (ranking por puntos y por
// rating). Función PURA para poder probarla: las listas tienen 169-183 filas y
// el filtro es lo único que hace que un jugador se encuentre a sí mismo.

/**
 * Quita acentos y pasa a minúsculas, para que "Treviño" se encuentre escribiendo
 * "trevino". NFD separa la letra de su tilde y el rango ̀-ͯ (marcas
 * diacríticas combinantes) las borra.
 */
export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export interface FiltrableRow {
  full_name: string
  category_code: string
  team_id: string | null
}

export interface FiltroStats {
  /** Texto libre; se compara normalizado contra el nombre. */
  query?: string
  /** Código de categoría exacto, o '' / undefined para todas. */
  category?: string
  /** id de equipo, o '' / undefined para todos. */
  teamId?: string
}

/**
 * Aplica los tres filtros en AND. Un filtro vacío no filtra nada — así el estado
 * inicial (sin tocar nada) muestra la lista completa.
 *
 * La búsqueda es por PALABRAS y no por subcadena del nombre completo: escribir
 * "prado maria" encuentra a "María Fernanda Prado". Con nombres de tres y cuatro
 * palabras, exigir el orden exacto hace que la gente no se encuentre.
 */
export function filterStatsRows<T extends FiltrableRow>(rows: T[], filtro: FiltroStats): T[] {
  const terminos = normalizar(filtro.query ?? '')
    .split(/\s+/)
    .filter(Boolean)

  return rows.filter((r) => {
    if (filtro.category && r.category_code !== filtro.category) return false
    if (filtro.teamId && r.team_id !== filtro.teamId) return false
    if (terminos.length === 0) return true
    const nombre = normalizar(r.full_name)
    return terminos.every((t) => nombre.includes(t))
  })
}
