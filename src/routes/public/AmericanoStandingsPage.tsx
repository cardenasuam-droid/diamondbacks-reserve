import { useMemo, useState } from 'react'
import { useLeagueSeason, useSeasonCategories } from '@/features/leagues/useLeagues'
import { useIndStandings } from '@/features/americano/useAmericano'
import { LeagueShell } from './LeagueShell'
import { Loader } from '@/components/ui/Loader'
import { EmptyState } from '@/components/ui/EmptyState'

// Tabla individual pública de una liga americano (/femenil/tabla), por
// categoría. Los datos vienen DERIVADOS de la vista ind_standings (0051):
// 3/1/0, walkover 12-0, penalizaciones restadas, desempates de la 5a edición.
export function AmericanoStandingsPage({ slug }: { slug: string }) {
  const seasonQ = useLeagueSeason(slug)
  const season = seasonQ.data
  const categories = useSeasonCategories(season?.id)
  const standings = useIndStandings(season?.id)
  const [category, setCategory] = useState<string | null>(null)

  const cats = useMemo(
    () => (categories.data ?? []).filter((c) => c.is_ranking && c.is_active),
    [categories.data]
  )
  const selected = category ?? cats[0]?.code ?? null
  const rows = useMemo(
    () => (standings.data ?? []).filter((r) => r.category_code === selected),
    [standings.data, selected]
  )
  const anyPenalty = rows.some((r) => r.penalty_points > 0)

  if (seasonQ.isLoading) {
    return (
      <div data-league={slug} className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-md px-4 pt-16">
          <Loader label="Cargando…" />
        </div>
      </div>
    )
  }

  return (
    <LeagueShell
      slug={slug}
      leagueName={season?.league.name ?? 'Liga'}
      seasonName={season?.name}
      active="tabla"
    >
      {cats.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cats.map((c) => {
            const active = selected === c.code
            return (
              <button
                key={c.code}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c.code)}
                className={
                  active
                    ? 'neu-pressed shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-brand-300'
                    : 'neu-raised shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-slate-700'
                }
              >
                {c.code.replace('FEM_', '') + 'a'}
              </button>
            )
          })}
        </div>
      )}

      {standings.isLoading ? (
        <Loader label="Cargando tabla…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="standings"
          title="Tabla en construcción"
          description="Aparecerá en cuanto haya jugadoras aprobadas en esta categoría."
        />
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl bg-slate-100 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2.5 pl-3 pr-1 font-medium">#</th>
                <th className="px-1 py-2.5 font-medium">Jugadora</th>
                <th className="px-1 py-2.5 text-center font-medium">PJ</th>
                <th className="px-1 py-2.5 text-center font-medium">G</th>
                <th className="px-1 py-2.5 text-center font-medium">DifS</th>
                <th className="px-1 py-2.5 text-center font-medium">DifJ</th>
                <th className="py-2.5 pl-1 pr-3 text-right font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.player_id}
                  className={
                    i === 0
                      ? 'border-b border-slate-200/60 bg-brand-500/10'
                      : 'border-b border-slate-200/60 last:border-b-0'
                  }
                >
                  <td className="py-2.5 pl-3 pr-1 tabular-nums text-slate-500">{i + 1}</td>
                  <td className="max-w-0 truncate px-1 py-2.5 font-medium text-slate-800">
                    {r.full_name}
                    {r.penalty_points > 0 && <span className="text-brand-300"> *</span>}
                  </td>
                  <td className="px-1 py-2.5 text-center tabular-nums text-slate-600">{r.played}</td>
                  <td className="px-1 py-2.5 text-center tabular-nums text-slate-600">{r.won}</td>
                  <td className="px-1 py-2.5 text-center tabular-nums text-slate-600">
                    {r.set_diff > 0 ? `+${r.set_diff}` : r.set_diff}
                  </td>
                  <td className="px-1 py-2.5 text-center tabular-nums text-slate-600">
                    {r.game_diff > 0 ? `+${r.game_diff}` : r.game_diff}
                  </td>
                  <td className="py-2.5 pl-1 pr-3 text-right font-heading tabular-nums text-slate-900">
                    {r.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {anyPenalty && (
        <p className="mt-2 text-xs text-slate-500">* Con puntos restados por el comité.</p>
      )}
    </LeagueShell>
  )
}
