import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { Loader } from '@/components/ui/Loader'
import { HomePage } from './HomePage'

// La pantalla de inicio es el DASHBOARD para quien tiene sesión (decisión de la
// organizadora, 2026-07-20): un jugador que abre la app —la PWA arranca en '/'—
// aterriza en sus partidos y sus estadísticas, no en el hero de presentación.
// El visitante anónimo sigue viendo la Home pública.
//
// Mientras la sesión se restaura del almacenamiento se muestra el Loader: sin
// él, el jugador vería la Home pública un instante y luego el salto al
// dashboard en cada apertura de la app.
export function HomeGate() {
  const { session, loading } = useAuth()
  if (loading) return <Loader label="Cargando…" />
  if (session) return <Navigate to="/app" replace />
  return <HomePage />
}
