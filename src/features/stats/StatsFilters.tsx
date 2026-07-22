import { Icon } from '@/components/ui/Icon'
import type { MatchCategory, Team } from '@/lib/types'

// Barra de filtros compartida por las tablas de /estadisticas. Sin ella, las
// listas son de 169-183 filas y un jugador no puede encontrarse a sí mismo.
//
// Los <select> nativos son deliberados: en móvil abren la rueda del sistema, que
// es más rápida y accesible que cualquier desplegable propio.
export function StatsFilters({
  query,
  onQuery,
  category,
  onCategory,
  teamId,
  onTeam,
  categories,
  teams,
  total,
  shown,
}: {
  query: string
  onQuery: (v: string) => void
  category: string
  onCategory: (v: string) => void
  teamId: string
  onTeam: (v: string) => void
  categories: MatchCategory[]
  teams: Team[]
  total: number
  shown: number
}) {
  const filtrando = query.trim() !== '' || category !== '' || teamId !== ''

  return (
    <div className="mb-3 space-y-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon name="search" size={18} />
        </span>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar jugador…"
          aria-label="Buscar jugador"
          className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-3 text-base text-slate-900 outline-none focus:border-sky-400"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) => onCategory(e.target.value)}
          aria-label="Filtrar por categoría"
          className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-800"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={teamId}
          onChange={(e) => onTeam(e.target.value)}
          aria-label="Filtrar por equipo"
          className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-800"
        >
          <option value="">Todos los equipos</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {filtrando && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>
            Mostrando <strong className="text-slate-700">{shown}</strong> de {total}
          </span>
          <button
            onClick={() => {
              onQuery('')
              onCategory('')
              onTeam('')
            }}
            className="font-medium text-sky-400 hover:underline"
          >
            Quitar filtros
          </button>
        </div>
      )}
    </div>
  )
}
