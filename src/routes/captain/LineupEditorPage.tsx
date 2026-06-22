import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { useCategories } from '@/features/categories/useCategories'
import { categoryColor } from '@/features/categories/categoryColor'
import { teamColor } from '@/lib/color'
import { formatRoundDate } from '@/lib/date'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import { useCaptainTeam } from '@/features/lineups/useCaptainTeam'
import { useCaptainMatchup } from '@/features/lineups/useCaptainMatchup'
import { useTeamRoster } from '@/features/lineups/useTeamRoster'
import { useEligibilityRules } from '@/features/lineups/useEligibilityRules'
import { useLineup } from '@/features/lineups/useLineup'
import { useChangeCount } from '@/features/lineups/useChangeCount'
import { useSaveLineup } from '@/features/lineups/useSaveLineup'
import {
  lineupStatusLabel,
  selectionsFromEntries,
  slotRequirements,
} from '@/features/lineups/lineupHelpers'
import { validateLineup, type LineupSelection } from '@/features/lineups/validateLineup'
import type { CaptainMatchup, TeamPlayer } from '@/features/lineups/types'
import type { MatchCategory } from '@/lib/types'

const ONE_HOUR = 60 * 60 * 1000

function earliestScheduled(matchup: CaptainMatchup): string | null {
  const times = matchup.matches
    .map((m) => m.scheduled_at)
    .filter((t): t is string => Boolean(t))
    .sort()
  return times[0] ?? null
}

// Candado de 1 hora del lado cliente (el trigger es el guardián real).
function isLocked(matchup: CaptainMatchup): boolean {
  const t = earliestScheduled(matchup)
  if (!t) return false
  return Date.now() > new Date(t).getTime() - ONE_HOUR
}

export function LineupEditorPage() {
  const { profile } = useAuth()
  const team = useCaptainTeam()
  const matchup = useCaptainMatchup(team.data?.id, team.data?.season_id)
  const roster = useTeamRoster(team.data?.id)
  const rules = useEligibilityRules()
  const categories = useCategories()
  const lineup = useLineup(matchup.data?.id, team.data?.id)
  const changes = useChangeCount(team.data?.id, team.data?.season_id)
  const save = useSaveLineup()

  const [selections, setSelections] = useState<Record<string, LineupSelection>>({})
  const [initialized, setInitialized] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  // Inicializa el estado local con lo guardado una sola vez.
  useEffect(() => {
    if (!initialized && categories.data && lineup.isSuccess) {
      setSelections(selectionsFromEntries(lineup.data?.entries ?? [], categories.data))
      setInitialized(true)
    }
  }, [initialized, categories.data, lineup.isSuccess, lineup.data])

  const validation = useMemo(() => {
    if (!categories.data || !rules.data || !roster.data || !team.data) return null
    return validateLineup(
      team.data.id,
      Object.values(selections),
      roster.data,
      rules.data,
      categories.data,
    )
  }, [selections, categories.data, rules.data, roster.data, team.data])

  // --- estados de carga / vacío ---
  if (team.isLoading) return <Loader label="Cargando tu equipo…" />
  if (team.isError) return <ErrorState onRetry={() => team.refetch()} />
  if (!team.data) {
    return (
      <div>
        <PageHeader title="Alineación" />
        <EmptyState
          icon="🚫"
          title="Tu cuenta no está enlazada a un equipo"
          description="Solo el capitán de un equipo puede armar alineaciones. Avisa al organizador si crees que es un error."
        />
      </div>
    )
  }

  if (matchup.isLoading) return <Loader label="Buscando tu próximo enfrentamiento…" />
  if (matchup.isError) return <ErrorState onRetry={() => matchup.refetch()} />
  if (!matchup.data) {
    return (
      <div>
        <PageHeader title="Alineación" subtitle={team.data.name} />
        <EmptyState
          icon="📅"
          title="Sin enfrentamiento publicado"
          description="Cuando el organizador publique el rol, aquí podrás armar tu alineación."
        />
      </div>
    )
  }

  if (roster.isLoading || rules.isLoading || categories.isLoading || lineup.isLoading) {
    return <Loader label="Cargando alineación…" />
  }
  if (roster.isError) return <ErrorState onRetry={() => roster.refetch()} />
  if (lineup.isError) return <ErrorState onRetry={() => lineup.refetch()} />

  const mu = matchup.data
  const cats = [...(categories.data ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const locked = isLocked(mu)
  const usedChanges = changes.data ?? 0
  const status = lineup.data?.status ?? 'draft'

  function setSlot(catCode: string, idx: 0 | 1, playerId: string) {
    setSavedMsg(null)
    setSelections((prev) => {
      const cur = prev[catCode] ?? {
        category_code: catCode,
        player_1_id: null,
        player_2_id: null,
      }
      const value = playerId || null
      const next: LineupSelection =
        idx === 0 ? { ...cur, player_1_id: value } : { ...cur, player_2_id: value }
      return { ...prev, [catCode]: next }
    })
  }

  async function handleSave(submit: boolean) {
    setSavedMsg(null)
    try {
      await save.mutateAsync({
        matchup: mu,
        teamId: team.data!.id,
        profileId: profile?.id ?? null,
        existing: lineup.data ?? null,
        categories: cats,
        selections,
        submit,
      })
      setSavedMsg(submit ? 'Alineación enviada ✅' : 'Borrador guardado ✅')
      void changes.refetch()
    } catch {
      // El error se muestra desde save.error abajo.
    }
  }

  // Jugadores usados en otras categorías (para avisar de duplicados en el select).
  const usedElsewhere = new Map<string, string>() // playerId -> nombre de categoría
  for (const c of cats) {
    const sel = selections[c.code]
    for (const id of [sel?.player_1_id, sel?.player_2_id]) {
      if (id && !usedElsewhere.has(id)) usedElsewhere.set(id, c.name)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Alineación" subtitle={team.data.name} />

      {/* Encabezado del enfrentamiento */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5"
            style={{ backgroundColor: teamColor(mu.myTeam.color) }}
            aria-hidden
          />
          <span className="font-semibold text-slate-800">{mu.myTeam.name}</span>
          <span className="text-xs font-medium text-slate-500">vs</span>
          <span className="font-semibold text-slate-800">{mu.opponent.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm text-slate-600">
          <span>
            Jornada {mu.round.round_number}
            {mu.round.name ? ` · ${mu.round.name}` : ''}
          </span>
          {formatRoundDate(mu.round.round_date) && <span>{formatRoundDate(mu.round.round_date)}</span>}
          <span className="ml-auto">
            <Badge color={status === 'draft' ? 'slate' : 'emerald'}>{lineupStatusLabel(status)}</Badge>
          </span>
        </div>
      </section>

      {locked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          🔒 Bloqueada: pasó el límite de 1 hora antes del partido. Solo el
          organizador puede hacer cambios.
        </div>
      )}

      {/* Categorías */}
      <div className="space-y-2">
        {cats.map((cat) => (
          <CategoryRow
            key={cat.code}
            cat={cat}
            roster={roster.data ?? []}
            rules={rules.data ?? []}
            selection={selections[cat.code]}
            issues={validation?.issues.filter((i) => i.category_code === cat.code) ?? []}
            complete={validation?.completeCategories.includes(cat.code) ?? false}
            usedElsewhere={usedElsewhere}
            disabled={locked || save.isPending}
            onChange={setSlot}
          />
        ))}
      </div>

      {/* Pie: cambios, validación y acciones */}
      <section className="sticky bottom-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            Cambios usados:{' '}
            <span className="font-semibold text-slate-900">{usedChanges}/5</span>
          </span>
          <span className="text-slate-600">
            {validation?.valid ? (
              <span className="font-medium text-emerald-600">Alineación válida</span>
            ) : (
              <span className="font-medium text-amber-600">
                {validation?.completeCategories.length ?? 0}/9 categorías listas
              </span>
            )}
          </span>
        </div>

        {save.isError && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {(save.error as Error).message}
          </p>
        )}
        {savedMsg && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{savedMsg}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => handleSave(false)}
            disabled={locked || save.isPending}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Guardar borrador
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={locked || save.isPending || !validation?.valid}
            className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {save.isPending ? 'Guardando…' : 'Enviar alineación'}
          </button>
        </div>
        <p className="text-center text-xs text-slate-500">
          <Link to="/app/capitan" className="underline">
            Volver al panel
          </Link>
        </p>
      </section>
    </div>
  )
}

function CategoryRow({
  cat,
  roster,
  rules,
  selection,
  issues,
  complete,
  usedElsewhere,
  disabled,
  onChange,
}: {
  cat: MatchCategory
  roster: TeamPlayer[]
  rules: import('@/features/lineups/validateLineup').EligibilityRule[]
  selection: LineupSelection | undefined
  issues: import('@/features/lineups/validateLineup').LineupIssue[]
  complete: boolean
  usedElsewhere: Map<string, string>
  disabled: boolean
  onChange: (catCode: string, idx: 0 | 1, playerId: string) => void
}) {
  const slots = slotRequirements(cat.code, rules)
  const values = [selection?.player_1_id ?? '', selection?.player_2_id ?? '']

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <Badge color={categoryColor(cat.type)}>{cat.code}</Badge>
        <span className="text-sm font-medium text-slate-800">{cat.name}</span>
        {complete && <span className="ml-auto text-sm text-emerald-500">✓</span>}
      </div>

      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
        {slots.map((slot, idx) => {
          const candidates = roster.filter(
            (p) => p.gender === slot.gender && p.category_code === slot.category_code,
          )
          const selectedId = values[idx]
          return (
            <select
              key={idx}
              value={selectedId}
              disabled={disabled}
              onChange={(e) => onChange(cat.code, idx as 0 | 1, e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">— Jugador {idx + 1} —</option>
              {candidates.map((p) => {
                const usedIn = usedElsewhere.get(p.id)
                const usedHere = selectedId === p.id
                return (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                    {usedIn && !usedHere ? ` · ya en ${usedIn}` : ''}
                  </option>
                )
              })}
            </select>
          )
        })}
      </div>

      {issues.length > 0 && (
        <ul className="space-y-1 border-t border-slate-100 bg-rose-50/50 px-3 py-2">
          {issues.map((i, n) => (
            <li key={n} className="text-xs text-rose-700">
              {i.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
