import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { roleLabel } from '@/features/auth/roles'
import { isPlayerAuthEmail, isSyntheticEmail } from '@/features/auth/playerAuth'
import { Loader } from '@/components/ui/Loader'

// Página de cuenta (landing tras login). Confirma sesión, rol y enlace a player.
// Los accesos a paneles (capitán/organizador) se añadirán en sus módulos.
export function AccountPage() {
  const { user, profile, profileLoading, role } = useAuth()

  if (profileLoading) return <Loader label="Cargando tu cuenta…" />

  const linked = Boolean(profile?.player_id)

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold">Hola{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
        <dl className="mt-4 grid grid-cols-3 gap-y-2 text-sm">
          {!isSyntheticEmail(user?.email) && (
            <>
              <dt className="col-span-1 text-slate-500">Correo</dt>
              <dd className="col-span-2 font-medium">{user?.email}</dd>
            </>
          )}
          <dt className="col-span-1 text-slate-500">Rol</dt>
          <dd className="col-span-2 font-medium">{roleLabel(role)}</dd>
          <dt className="col-span-1 text-slate-500">Ficha de jugador</dt>
          <dd className="col-span-2 font-medium">
            {linked ? 'Enlazada ✅' : 'Sin enlazar'}
          </dd>
        </dl>
      </section>

      {isPlayerAuthEmail(user?.email) && !linked && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Tu cuenta entró pero no está enlazada a una ficha de jugador. Avisa al
          organizador.
        </section>
      )}

      {(role === 'captain' || role === 'organizer') && (
        <Link
          to="/app/capitan"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
        >
          <span className="text-2xl" aria-hidden>
            📋
          </span>
          <span className="flex-1">
            <span className="block font-medium text-slate-800">Panel de capitán</span>
            <span className="block text-xs text-slate-500">
              Arma y envía la alineación de tu equipo
            </span>
          </span>
          <span className="text-slate-300" aria-hidden>
            ›
          </span>
        </Link>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        <p className="font-medium text-slate-800">Próximamente</p>
        <p className="mt-1">
          Aquí verás tu dashboard: tu rol del día, tus estadísticas y, si eres
          organizador, los paneles de gestión.
        </p>
      </section>
    </div>
  )
}
