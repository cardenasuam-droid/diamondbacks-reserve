import { Link, useParams } from 'react-router-dom'
import { useLeagueSeason, useSeasonPaidCount } from '@/features/leagues/useLeagues'
import { useSeasonRegistrations } from '@/features/registration/useRegistrations'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'

// Panel INDEPENDIENTE por liga (pedido del organizador, 2026-09-17): cada
// liga tiene el suyo. Este es el hub de una liga americano (la femenil):
// números de su inscripción y accesos a su bandeja (con la pestaña ya
// preseleccionada) y a sus jornadas. El panel de Reserve sigue siendo
// /app/organizador; "Panel del organizador" en el cascarón de una liga
// apunta aquí.
export function OrganizerLeaguePanelPage() {
  const { leagueSlug } = useParams<{ leagueSlug: string }>()
  const seasonQ = useLeagueSeason(leagueSlug)
  const season = seasonQ.data
  const regs = useSeasonRegistrations(season?.id)
  const paid = useSeasonPaidCount(season?.max_players != null ? season.id : undefined)

  if (seasonQ.isLoading) return <Loader label="Cargando…" />
  if (!season || season.league.kind !== 'americano') {
    return (
      <div>
        <PageHeader title="Panel de liga" />
        <EmptyState
          icon="organizer"
          title="Liga no encontrada"
          description="Esta sección administra ligas de formato americano."
        />
      </div>
    )
  }

  // Con la consulta fallida los números se muestran como '—', nunca como 0:
  // un cero falso haría creer que la cola está vacía (hallazgo de Codex).
  const all = regs.data
  const pending = all ? all.filter((r) => r.status === 'pending').length : null
  const approved = all ? all.filter((r) => r.status === 'approved').length : null
  const slug = season.league.slug

  const cards = [
    {
      to: `/app/organizador/inscripciones?liga=${slug}`,
      icon: '📨',
      title: 'Inscripciones',
      desc:
        pending != null && pending > 0
          ? `${pending} por revisar · inscritas actuales y pagos`
          : 'Pendientes, inscritas actuales y pagos',
    },
    {
      to: `/app/organizador/liga/${slug}/jornadas`,
      icon: '🎾',
      title: 'Jornadas y resultados',
      desc: 'Publicar jornadas, juegos de 4 y captura de marcadores',
    },
    {
      to: `/${slug}`,
      icon: '👀',
      title: 'Ver sitio público',
      desc: 'La liga como la ven las jugadoras',
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title={`Panel · ${season.league.name}`} subtitle={season.name} />

      <section className="grid grid-cols-3 gap-3">
        <Stat value={pending ?? '—'} label="Pendientes" />
        <Stat value={approved ?? '—'} label="Inscritas" />
        <Stat
          value={
            season.max_players != null
              ? `${paid.data ?? '—'}/${season.max_players}`
              : (paid.data ?? '—')
          }
          label="Pagadas"
        />
      </section>

      {regs.isError && (
        <ErrorState
          description="No pudimos cargar los números de inscripción."
          onRetry={() => void regs.refetch()}
        />
      )}

      <section className="space-y-2">
        {cards.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-sm hover:border-slate-300"
          >
            <span className="text-2xl" aria-hidden>
              {s.icon}
            </span>
            <span className="flex-1">
              <span className="block font-medium text-slate-800">{s.title}</span>
              <span className="block text-xs text-slate-500">{s.desc}</span>
            </span>
            <span className="text-slate-300" aria-hidden>
              ›
            </span>
          </Link>
        ))}
      </section>
    </div>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-center shadow-sm">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
