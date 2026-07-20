import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { useCategories } from '@/features/categories/useCategories'
import { categoryColor } from '@/features/categories/categoryColor'
import { formatRoundDate } from '@/lib/date'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { TeamCrest } from '@/components/ui/TeamCrest'
import { useCaptainTeam } from '@/features/lineups/useCaptainTeam'
import { useCaptainMatchup } from '@/features/lineups/useCaptainMatchup'
import { useMatchupById } from '@/features/lineups/useMatchupById'
import { useTeamRoster } from '@/features/lineups/useTeamRoster'
import { useEligibilityRules } from '@/features/lineups/useEligibilityRules'
import { useLineup } from '@/features/lineups/useLineup'
import { useChangeCount } from '@/features/lineups/useChangeCount'
import { useSaveLineup } from '@/features/lineups/useSaveLineup'
import {
  lineupStatusLabel,
  selectionsFromEntries,
  slotRequirements,
  lineupDeadline,
  isLineupLocked,
} from '@/features/lineups/lineupHelpers'
import { validateLineup, categoryRank, type LineupSelection } from '@/features/lineups/validateLineup'
import type { TeamPlayer } from '@/features/lineups/types'
import type { MatchCategory } from '@/lib/types'

// Formatea la fecha/hora límite (sábado 07:00) en hora de México para mostrarla.
function formatDeadline(roundDate: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(lineupDeadline(roundDate))
}

export function LineupEditorPage() {
  const { profile, role } = useAuth()

  // Modo ORGANIZADOR: llega por ruta con enfrentamiento + equipo elegidos
  // (/app/organizador/alineaciones/:teamMatchupId/:teamId) para corregir un rol
  // ya publicado de CUALQUIER equipo. Sin params = modo capitán (su propio
  // equipo y su próximo enfrentamiento), idéntico a antes.
  const params = useParams<{ teamMatchupId?: string; teamId?: string }>()
  const asOrganizer = role === 'organizer' && Boolean(params.teamMatchupId && params.teamId)

  const captainTeam = useCaptainTeam()
  const captainMatchup = useCaptainMatchup(captainTeam.data?.id, captainTeam.data?.season_id)
  const orgMatchup = useMatchupById(params.teamMatchupId, params.teamId, asOrganizer)

  // Equipo efectivo. En modo organizador se deriva del enfrentamiento cargado
  // (su season_id viaja en el round), para no consultar teams por separado.
  const teamData = asOrganizer
    ? orgMatchup.data
      ? { ...orgMatchup.data.myTeam, season_id: orgMatchup.data.seasonId }
      : undefined
    : captainTeam.data ?? undefined

  const team = {
    data: teamData,
    isLoading: asOrganizer ? orgMatchup.isLoading : captainTeam.isLoading,
    isError: asOrganizer ? orgMatchup.isError : captainTeam.isError,
    refetch: asOrganizer ? orgMatchup.refetch : captainTeam.refetch,
  }
  const matchup = asOrganizer ? orgMatchup : captainMatchup

  const roster = useTeamRoster(team.data?.id)
  const rules = useEligibilityRules()
  const categories = useCategories()
  const lineup = useLineup(matchup.data?.id, team.data?.id)
  const changes = useChangeCount(team.data?.id, team.data?.season_id)
  const save = useSaveLineup()

  const [selections, setSelections] = useState<Record<string, LineupSelection>>({})
  // Categorías donde la capitana activó la EXCEPCIÓN (elegir de la lista completa,
  // misma categoría o más débil). 0038.
  const [exceptionCats, setExceptionCats] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  // Categorías de PARTIDO de ESTE enfrentamiento (0029): las que realmente se
  // juegan, derivadas de sus matches y ordenadas por match_sort_order. NO todo el
  // catálogo (que ahora incluye ranking-only como VAR_4/FEM_3/FEM_7, que no se juegan).
  const matchCats = useMemo(() => {
    if (!matchup.data || !categories.data) return []
    const codes = new Set(matchup.data.matches.map((m) => m.category_code))
    return categories.data
      .filter((c) => codes.has(c.code))
      .sort((a, b) => (a.match_sort_order ?? a.sort_order) - (b.match_sort_order ?? b.sort_order))
  }, [matchup.data, categories.data])

  // Inicializa el estado local con lo guardado una sola vez (incluye qué categorías
  // quedaron marcadas como excepción, para no re-bloquearlas al reabrir).
  useEffect(() => {
    if (!initialized && matchCats.length && lineup.isSuccess) {
      const entries = lineup.data?.entries ?? []
      setSelections(selectionsFromEntries(entries, matchCats))
      setExceptionCats(new Set(entries.filter((e) => e.is_exception).map((e) => e.category_code)))
      setInitialized(true)
    }
  }, [initialized, matchCats, lineup.isSuccess, lineup.data])

  const validation = useMemo(() => {
    if (!matchCats.length || !rules.data || !roster.data || !team.data) return null
    return validateLineup(
      team.data.id,
      Object.values(selections),
      roster.data,
      rules.data,
      matchCats,
      exceptionCats,
    )
  }, [selections, matchCats, rules.data, roster.data, team.data, exceptionCats])

  // Excepciones REALES para persistir: categorías con excepción activa cuya
  // selección de verdad rompe la regla estricta — un jugador FUERA de su categoría
  // exacta, o REPETIDO en otra categoría. Independiente del orden. Si activaron la
  // excepción pero eligieron normal, no se marca (no sale ⚠️ en el rol).
  const realExceptionCats = useMemo(() => {
    const breaks = new Set<string>()
    if (!exceptionCats.size || !rules.data || !roster.data) return breaks
    const rosterById = new Map(roster.data.map((p) => [p.id, p]))
    // Cuántas categorías usa cada jugador (para detectar repetido sin depender del orden).
    const usedIn = new Map<string, number>()
    for (const c of matchCats) {
      const s = selections[c.code]
      for (const id of new Set([s?.player_1_id, s?.player_2_id].filter(Boolean) as string[])) {
        usedIn.set(id, (usedIn.get(id) ?? 0) + 1)
      }
    }
    for (const c of exceptionCats) {
      const s = selections[c]
      const catRules = rules.data.filter((r) => r.match_category_code === c)
      const ids = [s?.player_1_id, s?.player_2_id].filter(Boolean) as string[]
      const real = ids.some((id) => {
        const p = rosterById.get(id)
        if (!p) return false
        const fitsExact = catRules.some(
          (r) => p.gender === r.required_gender && p.category_code === r.required_player_category_code,
        )
        return !fitsExact || (usedIn.get(id) ?? 0) > 1
      })
      if (real) breaks.add(c)
    }
    return breaks
  }, [exceptionCats, selections, matchCats, rules.data, roster.data])

  // --- estados de carga / vacío ---
  if (team.isLoading) return <Loader label={asOrganizer ? 'Cargando enfrentamiento…' : 'Cargando tu equipo…'} />
  if (team.isError) return <ErrorState onRetry={() => team.refetch()} />
  if (!team.data) {
    return (
      <div>
        <PageHeader title="Alineación" />
        <EmptyState
          icon="ban"
          title={asOrganizer ? 'No se encontró el enfrentamiento' : 'Tu cuenta no está enlazada a un equipo'}
          description={
            asOrganizer
              ? 'Revisa el enlace desde “Estado de alineaciones”.'
              : 'Solo el capitán de un equipo puede armar alineaciones. Avisa al organizador si crees que es un error.'
          }
        />
      </div>
    )
  }

  if (matchup.isLoading) {
    return <Loader label={asOrganizer ? 'Cargando enfrentamiento…' : 'Buscando tu próximo enfrentamiento…'} />
  }
  if (matchup.isError) return <ErrorState onRetry={() => matchup.refetch()} />
  if (!matchup.data) {
    return (
      <div>
        <PageHeader title="Alineación" subtitle={team.data.name} />
        <EmptyState
          icon="schedule"
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
  const cats = matchCats
  // El organizador nunca está bloqueado por el candado (el servidor también lo
  // exime): puede corregir un rol antes o después de publicarlo.
  const locked = asOrganizer ? false : isLineupLocked(mu.round.round_date)
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

  function toggleException(catCode: string, enabled: boolean) {
    setSavedMsg(null)
    setExceptionCats((prev) => {
      const next = new Set(prev)
      if (enabled) next.add(catCode)
      else next.delete(catCode)
      return next
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
        exceptionCategories: realExceptionCats,
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
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span className="inline-flex items-center gap-1.5">
            <TeamCrest name={mu.myTeam.name} logoUrl={mu.myTeam.logo_url} color={mu.myTeam.color} size={20} />
            <span className="font-semibold text-slate-800">{mu.myTeam.name}</span>
          </span>
          <span className="text-xs font-medium text-slate-500">vs</span>
          <span className="inline-flex items-center gap-1.5">
            <TeamCrest name={mu.opponent.name} logoUrl={mu.opponent.logo_url} color={mu.opponent.color} size={20} />
            <span className="font-semibold text-slate-800">{mu.opponent.name}</span>
          </span>
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

      {asOrganizer ? (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-3 text-sm text-brand-200">
          Editas como organizador: el candado no aplica. Recuerda que un cambio sobre una
          alineación ya publicada cuenta contra los 5 del equipo.
        </div>
      ) : locked ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-3 text-sm text-amber-200">
          🔒 Bloqueada: pasó el límite (sábado 07:00 antes de la jornada). Solo el
          organizador puede hacer cambios.
        </div>
      ) : mu.round.round_date ? (
        <div className="rounded-xl border border-slate-200 bg-slate-100 p-3 text-sm text-slate-600">
          ⏰ Puedes enviar o editar tu alineación hasta el{' '}
          <span className="font-semibold text-slate-800">{formatDeadline(mu.round.round_date)}</span>.
          Después de esa hora se bloquea.
        </div>
      ) : null}

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
            exception={exceptionCats.has(cat.code)}
            onToggleException={toggleException}
            disabled={locked || save.isPending}
            onChange={setSlot}
          />
        ))}
      </div>

      {/* Pie: cambios, validación y acciones */}
      <section className="sticky bottom-0 space-y-3 rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            Cambios usados:{' '}
            <span className="font-semibold text-slate-900">{usedChanges}/5</span>
          </span>
          <span className="text-slate-600">
            {validation?.valid ? (
              <span className="font-medium text-emerald-300">Alineación válida</span>
            ) : (
              <span className="font-medium text-amber-600">
                {validation?.completeCategories.length ?? 0}/{cats.length} categorías listas
              </span>
            )}
          </span>
        </div>

        {save.isError && (
          <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
            {(save.error as Error).message}
          </p>
        )}
        {savedMsg && (
          <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">{savedMsg}</p>
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
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {save.isPending ? 'Guardando…' : 'Enviar alineación'}
          </button>
        </div>
        <p className="text-center text-xs text-slate-500">
          <Link to={asOrganizer ? '/app/organizador/alineaciones' : '/app/capitan'} className="underline">
            {asOrganizer ? 'Volver a estado de alineaciones' : 'Volver al panel'}
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
  exception,
  onToggleException,
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
  exception: boolean
  onToggleException: (catCode: string, enabled: boolean) => void
  disabled: boolean
  onChange: (catCode: string, idx: 0 | 1, playerId: string) => void
}) {
  const slots = slotRequirements(cat.code, rules)
  const values = [selection?.player_1_id ?? '', selection?.player_2_id ?? '']
  const [confirming, setConfirming] = useState(false)

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <Badge color={categoryColor(cat.type)}>{cat.code}</Badge>
        <span className="text-sm font-medium text-slate-800">{cat.name}</span>
        {complete && !exception && <span className="text-sm text-emerald-400">✓</span>}
        <span className="ml-auto">
          {exception ? (
            <button
              type="button"
              onClick={() => onToggleException(cat.code, false)}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 disabled:opacity-50"
            >
              ⚠️ Excepción · quitar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={disabled}
              className="text-xs font-medium text-slate-500 underline disabled:opacity-50"
            >
              Excepción
            </button>
          )}
        </span>
      </div>

      {confirming && !exception && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>
            Solo por falta de jugadores. Se abrirá la lista completa (misma categoría o más débil,
            del mismo género) y esta categoría se marcará con ⚠️ en el rol. ¿Continuar?
          </p>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onToggleException(cat.code, true)
                setConfirming(false)
              }}
              className="rounded bg-amber-500 px-2.5 py-1 font-medium text-white"
            >
              Sí, activar
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded px-2.5 py-1 text-amber-700">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
        {slots.map((slot, idx) => {
          const slotRank = categoryRank(slot.category_code)
          const candidates = roster.filter((p) => {
            if (p.gender !== slot.gender) return false
            if (!exception) return p.category_code === slot.category_code
            // Excepción: misma categoría o más débil (número mayor).
            const pr = categoryRank(p.category_code)
            return slotRank != null && pr != null && pr >= slotRank
          })
          const selectedId = values[idx]
          const selectedPlayer = selectedId ? roster.find((p) => p.id === selectedId) : undefined
          return (
            <div key={idx} className="flex items-center gap-2">
              {selectedPlayer ? (
                <Avatar name={selectedPlayer.full_name} photoUrl={selectedPlayer.photo_url} size={32} />
              ) : (
                <span className="h-8 w-8 shrink-0 rounded-full bg-slate-200 ring-1 ring-black/10" aria-hidden />
              )}
              <select
                value={selectedId}
                disabled={disabled}
                onChange={(e) => onChange(cat.code, idx as 0 | 1, e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">— Jugador {idx + 1} —</option>
                {candidates.map((p) => {
                  const usedIn = usedElsewhere.get(p.id)
                  const usedHere = selectedId === p.id
                  // Con excepción se muestra la categoría del jugador (para elegir a conciencia).
                  const catTag = exception && p.category_code !== slot.category_code ? ` · ${p.category_code}` : ''
                  return (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                      {catTag}
                      {usedIn && !usedHere ? ` · ya en ${usedIn}` : ''}
                    </option>
                  )
                })}
              </select>
            </div>
          )
        })}
      </div>

      {issues.length > 0 && (
        <ul className="space-y-1 border-t border-slate-100 bg-rose-500/15/50 px-3 py-2">
          {issues.map((i, n) => (
            <li key={n} className="text-xs text-rose-200">
              {i.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
