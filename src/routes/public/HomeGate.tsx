import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { Loader } from '@/components/ui/Loader'
import { HomePage } from './HomePage'

// Portada de Reserve (/inicio; '/' es el selector de ligas). Para quien tiene
// sesión es el DASHBOARD (decisión de la organizadora, 2026-07-20): al entrar
// a Reserve aterriza en sus partidos y estadísticas, no en el hero de
// presentación. El visitante anónimo ve la Home pública.
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
