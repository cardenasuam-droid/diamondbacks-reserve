import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import type { UserRole } from '@/lib/types'
import { Loader } from '@/components/ui/Loader'

/** Exige sesión iniciada. Si no, redirige a /login recordando el destino. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loader />
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Exige sesión + uno de los roles dados. Espera a que el perfil cargue. */
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { session, loading, profileLoading, role } = useAuth()
  const location = useLocation()

  if (loading || (session && profileLoading)) return <Loader />
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!role || !roles.includes(role)) {
    return <Navigate to="/app" replace />
  }
  return <Outlet />
}
