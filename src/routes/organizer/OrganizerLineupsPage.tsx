import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useRounds } from '@/features/schedule/useRounds'
import { RoundSelector } from '@/features/schedule/RoundSelector'
import { useRoundLineups } from '@/features/lineups/useRoundLineups'
import { useFinalizeRound } from '@/features/lineups/useFinalizeRound'
import { useLineupDeadline } from '@/features/lineups/useLineupDeadline'
import { lineupStatusLabel, formatDeadline } from '@/features/lineups/lineupHelpers'
import { TeamCrest } from '@/components/ui/TeamCrest'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import type { TeamLite } from '@/features/schedule/types'
import type { RoundLineupStatus } from '@/features/lineups/useRoundLineups'

export function OrganizerLineupsPage() {
  const { role } = useAuth()
  const canEdit = role === 'organizer' // el viewer solo lee; editar fallaría en RLS
  const season = useActiveSeason()
  const rounds = useRounds(season.data?.id)
  const [roundId, setRoundId] = useState<string | undefined>()
  const selected = roundId ?? rounds.data?.[0]?.id
  const lineups = useRoundLineups(selected)
  // La hora de cierre sale del servidor (misma función que usan los triggers),
  // nunca de una frase fija: las jornadas con excepción no cierran en sábado.
  const selectedRound = rounds.data?.find((r) => r.id === selected)
  const deadlineQuery = useLineupDeadline(selectedRound?.round_date)
  const finalize = useFinalizeRound()
  const [confirm, setConfirm] = useState(false)

  // Al cambiar de jornada, reinicia el estado del cierre.
  const anyPublished = lineups.data?.some((mu) => mu.lineups.some((l) => l.locked_at)) ?? false

  function doFinalize() {
    if (!selected || !season.data) return
    finalize.mutate(
      { roundId: selected, seasonId: season.data.id },
      { onSettled: () => setConfirm(false) },
    )
  }

  if (season.isLoading || rounds.isLoading) return <Loader label="Cargando…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Estado de alineaciones" />
        <EmptyState icon="lineups-status" title="No hay temporada activa" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Estado de alineaciones" subtitle={season.data.name} />

      {rounds.data && rounds.data.length > 0 ? (
        <RoundSelector rounds={rounds.data} selectedId={selected} onSelect={setRoundId} />
      ) : (
        <EmptyState icon="schedule" title="No hay jornadas" />
      )}

      {selected && (
        <section className="my-4 rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">
                {anyPublished ? 'Jornada publicada' : 'Cerrar y publicar jornada'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Genera alineación aleatoria para los equipos que no la enviaron y publica todas
                (visibles para todos).
                {deadlineQuery.data
                  ? ` Hazlo al cerrar el plazo de esta jornada: ${formatDeadline(deadlineQuery.data)}`
                  : ''}
              </p>
            </div>
            {anyPublished && <Badge color="emerald">Publicada</Badge>}
          </div>

          {finalize.isError && (
            <p className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
              {(finalize.error as Error).message}
            </p>
          )}
          {finalize.isSuccess && (
            <p className="mt-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">
              Listo: {finalize.data.autoTeams} alineación(es) generada(s)
              {finalize.data.partialTeams > 0
                ? ` (${finalize.data.partialTeams} incompleta(s) por roster corto)`
                : ''}
              , {finalize.data.published} publicada(s).
            </p>
          )}

          <div className="mt-3">
            {confirm ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 text-sm text-slate-600">
                  Autogenera y publica las alineaciones de esta jornada. ¿Continuar?
                </span>
                <button
                  onClick={doFinalize}
                  disabled={finalize.isPending}
                  className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {finalize.isPending ? 'Cerrando…' : 'Sí, cerrar y publicar'}
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  className="rounded-lg px-3 py-2 text-sm text-slate-500"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirm(true)}
                disabled={finalize.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {anyPublished ? 'Volver a cerrar / publicar' : 'Cerrar y publicar jornada'}
              </button>
            )}
          </div>
        </section>
      )}

      {lineups.isLoading ? (
        <Loader label="Cargando alineaciones…" />
      ) : lineups.isError ? (
        <ErrorState onRetry={() => lineups.refetch()} />
      ) : !lineups.data || lineups.data.length === 0 ? (
        <EmptyState icon="lineups-status" title="Sin enfrentamientos en esta jornada" />
      ) : (
        <div className="space-y-2">
          {lineups.data.map((mu) => (
            <div
              key={mu.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm"
            >
              <TeamRow team={mu.team_a} lineups={mu.lineups} matchupId={mu.id} canEdit={canEdit} />
              <div className="border-t border-slate-100" />
              <TeamRow team={mu.team_b} lineups={mu.lineups} matchupId={mu.id} canEdit={canEdit} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TeamRow({
  team,
  lineups,
  matchupId,
  canEdit,
}: {
  team: TeamLite | null
  lineups: RoundLineupStatus[]
  matchupId: string
  canEdit: boolean
}) {
  const lineup = lineups.find((l) => l.team_id === team?.id)
  const status = lineup?.status
  const published = Boolean(lineup?.locked_at)
  const done = Boolean(status && status !== 'draft')

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      {team ? (
        <TeamCrest name={team.name} logoUrl={team.logo_url} color={team.color} size={24} />
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-md bg-slate-200 ring-1 ring-black/10" aria-hidden />
      )}
      <span className="flex-1 truncate font-medium text-slate-800">{team?.name ?? '—'}</span>
      <Badge color={published ? 'blue' : done ? 'emerald' : status === 'draft' ? 'amber' : 'slate'}>
        {published ? 'Publicada' : lineupStatusLabel(status)}
      </Badge>
      {canEdit && team && (
        <Link
          to={`/app/organizador/alineaciones/${matchupId}/editar/${team.id}`}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-sky-600 hover:bg-slate-50"
        >
          Editar
        </Link>
      )}
    </div>
  )
}
