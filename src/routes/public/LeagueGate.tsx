import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { getLeaguePref } from '@/lib/leaguePref'
import { Loader } from '@/components/ui/Loader'
import { HomeGate } from './HomeGate'

// '/' con conciencia de plataforma (F4-lite): primero se resuelve LA LIGA y
// luego el destino dentro de ella.
//   · liga recordada ≠ reserve → su portada (/femenil, …)
//   · liga recordada = reserve, o sesión iniciada sin preferencia (hoy toda
//     sesión es de Reserve) → comportamiento de siempre (HomeGate: dashboard
//     con sesión, Home pública sin ella)
//   · visitante nuevo sin preferencia → selector de ligas
export function LeagueGate() {
  const { session, loading } = useAuth()
  if (loading) return <Loader label="Cargando…" />

  const stored = getLeaguePref()
  if (stored && stored !== 'reserve') return <Navigate to={`/${stored}`} replace />
  if (stored === 'reserve' || session) return <HomeGate />
  return <Navigate to="/ligas" replace />
}
