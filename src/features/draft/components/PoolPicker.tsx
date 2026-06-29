import { useMemo, useState } from 'react'
import { useMakePick } from '../mutations'
import type { PublicPlayer } from '@/lib/types'

// Lista del pool de la categoría actual con botón Elegir. La usan la capitana (en
// su turno) y el organizador (puede elegir por el equipo en turno). Tras elegir,
// la lista se actualiza por Realtime (el jugador deja el pool).
export function PoolPicker({
  draftId,
  seasonId,
  categoryCode,
  categoryName,
  pool,
  title = 'Elige tu pick',
}: {
  draftId: string
  seasonId: string
  categoryCode: string
  categoryName: string
  pool: PublicPlayer[]
  title?: string
}) {
  const makePick = useMakePick()
  const [query, setQuery] = useState('')

  const available = useMemo(() => {
    const list = pool
      .filter((p) => p.category_code === categoryCode)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'))
    const q = query.trim().toLowerCase()
    return q ? list.filter((p) => p.full_name.toLowerCase().includes(q)) : list
  }, [pool, categoryCode, query])

  return (
    <section className="rounded-3xl bg-slate-50 p-4 shadow-md">
      <p className="font-heading text-sm text-slate-900">
        {title} · {categoryName}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{available.length} disponibles</p>

      {makePick.isError && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {(makePick.error as Error).message}
        </p>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar jugadora…"
        className="mt-3 w-full rounded-xl px-3 py-2.5 text-base text-slate-900"
      />

      <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto">
        {available.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-xl px-1">
            <span className="flex-1 truncate text-sm font-medium text-slate-800">{p.full_name}</span>
            <button
              onClick={() => makePick.mutate({ draftId, seasonId, playerId: p.id })}
              disabled={makePick.isPending}
              className="shrink-0 rounded-lg bg-gold-300 px-3 py-1.5 text-sm font-semibold text-[#1a1405] shadow-sm disabled:opacity-50"
            >
              Elegir
            </button>
          </li>
        ))}
        {available.length === 0 && (
          <li className="px-2 py-3 text-sm text-slate-500">Sin jugadoras disponibles.</li>
        )}
      </ul>
    </section>
  )
}
