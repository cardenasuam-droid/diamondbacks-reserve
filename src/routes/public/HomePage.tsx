import { Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'

const QUICK_LINKS = [
  { to: '/tabla', icon: '🏆', label: 'Tabla', desc: 'Posiciones' },
  { to: '/rol', icon: '📅', label: 'Rol', desc: 'Calendario' },
  { to: '/resultados', icon: '📊', label: 'Resultados', desc: 'Marcadores' },
  { to: '/mas', icon: '⋯', label: 'Más', desc: 'Equipos, stats…' },
]

export function HomePage() {
  const { data: season } = useActiveSeason()

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 p-6 text-white shadow-md">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-14 -left-8 h-36 w-36 rounded-full bg-emerald-300/20" aria-hidden />
        <h1 className="relative text-3xl font-extrabold tracking-tight">Liga de Pádel por Equipos</h1>
        <p className="relative mt-1.5 text-sm text-emerald-50">
          {season ? (
            <>
              Temporada <span className="font-semibold">{season.name}</span>
              {season.status === 'active' && ' · en curso'}
            </>
          ) : (
            'Bienvenido. Pronto verás aquí el rol, la tabla y las estadísticas.'
          )}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {QUICK_LINKS.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <span className="text-2xl" aria-hidden>
              {q.icon}
            </span>
            <span className="font-semibold text-slate-800">{q.label}</span>
            <span className="text-xs text-slate-500">{q.desc}</span>
          </Link>
        ))}
      </section>
    </div>
  )
}
