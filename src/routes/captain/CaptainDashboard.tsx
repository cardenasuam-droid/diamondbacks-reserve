import { Link } from 'react-router-dom'
import { teamColor } from '@/lib/color'
import { formatRoundDate } from '@/lib/date'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import { useCaptainTeam } from '@/features/lineups/useCaptainTeam'
import { useCaptainMatchup } from '@/features/lineups/useCaptainMatchup'
import { useLineup } from '@/features/lineups/useLineup'
import { useChangeCount } from '@/features/lineups/useChangeCount'
import { lineupStatusLabel } from '@/features/lineups/lineupHelpers'

export function CaptainDashboard() {
  const team = useCaptainTeam()
  const matchup = useCaptainMatchup(team.data?.id, team.data?.season_id)
  const lineup = useLineup(matchup.data?.id, team.data?.id)
  const changes = useChangeCount(team.data?.id, team.data?.season_id)

  if (team.isLoading) return <Loader label="Cargando tu panel…" />
  if (team.isError) return <ErrorState onRetry={() => team.refetch()} />
  if (!team.data) {
    return (
      <div>
        <PageHeader title="Panel de capitán" />
        <EmptyState
          icon="ban"
          title="Tu cuenta no está enlazada a un equipo"
          description="Solo el capitán de un equipo puede usar este panel. Avisa al organizador si crees que es un error."
        />
      </div>
    )
  }

  const status = lineup.data?.status
  const used = changes.data ?? 0

  return (
    <div className="space-y-5">
      <PageHeader title="Panel de capitán" subtitle={team.data.name} />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5"
            style={{ backgroundColor: teamColor(team.data.color) }}
            aria-hidden
          />
          <span className="font-semibold text-slate-800">Próximo enfrentamiento</span>
        </div>

        {matchup.isLoading ? (
          <div className="p-4">
            <Loader label="Buscando enfrentamiento…" />
          </div>
        ) : matchup.isError ? (
          <div className="p-4">
            <ErrorState onRetry={() => matchup.refetch()} />
          </div>
        ) : !matchup.data ? (
          <div className="p-4 text-sm text-slate-500">
            Aún no hay rol publicado. Cuando el organizador lo publique, aparecerá aquí.
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-slate-800">
              <span className="font-semibold">{matchup.data.myTeam.name}</span>
              <span className="text-xs text-slate-500">vs</span>
              <span className="font-semibold">{matchup.data.opponent.name}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>Jornada {matchup.data.round.round_number}</span>
              {formatRoundDate(matchup.data.round.round_date) && (
                <span>{formatRoundDate(matchup.data.round.round_date)}</span>
              )}
              <span className="ml-auto">
                Alineación:{' '}
                <Badge color={!status || status === 'draft' ? 'slate' : 'emerald'}>
                  {lineupStatusLabel(status)}
                </Badge>
              </span>
            </div>
            <Link
              to="/app/capitan/alineacion"
              className="block rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
            >
              {!status || status === 'draft' ? 'Armar alineación' : 'Ver / editar alineación'}
            </Link>
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-slate-900">{used}/5</div>
          <div className="text-xs text-slate-500">Cambios usados</div>
        </div>
        <Link
          to={`/equipos/${team.data.id}`}
          className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-4 text-center shadow-sm hover:border-slate-300"
        >
          <div className="text-2xl">👥</div>
          <div className="text-xs text-slate-500">Ver mi roster</div>
        </Link>
      </section>
    </div>
  )
}
