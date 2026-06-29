import { Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { useRounds } from '@/features/schedule/useRounds'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Loader } from '@/components/ui/Loader'

const SECTIONS = [
  {
    to: '/app/organizador/inscripciones',
    icon: '📨',
    title: 'Inscripciones',
    desc: 'Revisar y aprobar jugadores nuevos',
  },
  {
    to: '/app/organizador/equipos',
    icon: '👥',
    title: 'Equipos y jugadores',
    desc: 'Crear y editar equipos y rosters',
  },
  {
    to: '/app/organizador/alineaciones',
    icon: '✅',
    title: 'Estado de alineaciones',
    desc: 'Quién ya envió su alineación por jornada',
  },
  {
    to: '/app/organizador/resultados',
    icon: '📝',
    title: 'Resultados',
    desc: 'Validar reportes y capturar marcadores',
  },
  {
    to: '/app/organizador/importar',
    icon: '📥',
    title: 'Importar CSV',
    desc: 'Cargar equipos, jugadores y rol',
  },
]

export function OrganizerDashboard() {
  const season = useActiveSeason()
  const teams = useTeams(season.data?.id)
  const rounds = useRounds(season.data?.id)

  if (season.isLoading) return <Loader label="Cargando…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Panel organizador" />
        <EmptyState icon="organizer" title="No hay temporada activa" description="Crea o activa una temporada para empezar." />
      </div>
    )
  }

  const published = (rounds.data ?? []).filter((r) => r.status === 'published').length

  return (
    <div className="space-y-5">
      <PageHeader title="Panel organizador" subtitle={season.data.name} />

      <section className="grid grid-cols-3 gap-3">
        <Stat value={teams.data?.length ?? '—'} label="Equipos" />
        <Stat value={rounds.data?.length ?? '—'} label="Jornadas" />
        <Stat value={published} label="Publicadas" />
      </section>

      <section className="space-y-2">
        {SECTIONS.map((s) => (
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

      <section className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm text-slate-600 shadow-sm">
        <p className="font-medium text-slate-800">Próximamente</p>
        <p className="mt-1">Avisos/notificaciones internas llegarán en su módulo.</p>
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
