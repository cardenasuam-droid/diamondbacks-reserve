import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { getLeaguePref } from '@/lib/leaguePref'
import { Loader } from '@/components/ui/Loader'
import { HomeGate } from './HomeGate'

// '/' con conciencia de plataforma (F4-lite): primero se resuelve LA LIGA y
// luego el destino dentro de ella.
//   · liga recordada ≠ reserve → su portada (/femenil, …)
//   · liga recordada = reserve → comportamiento de siempre (HomeGate:
//     dashboard con sesión, Home pública sin ella)
//   · sin preferencia → selector de ligas, CON o SIN sesión (decisión del
//     organizador 2026-09-17: al iniciar la app se elige liga; como la
//     elección se recuerda, cada persona lo ve UNA vez por dispositivo)
export function LeagueGate() {
  const { loading } = useAuth()
  if (loading) return <Loader label="Cargando…" />

  const stored = getLeaguePref()
  if (stored && stored !== 'reserve') return <Navigate to={`/${stored}`} replace />
  if (stored === 'reserve') return <HomeGate />
  return <Navigate to="/ligas" replace />
}
