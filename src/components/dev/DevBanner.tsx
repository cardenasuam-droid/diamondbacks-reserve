import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { roleLabel } from '@/features/auth/roles'
import { setDevRole } from '@/features/auth/devRole'

// Barra de aviso visible cuando la consola /dev está forzando un rol. Recuerda
// que solo cambia la interfaz; los datos siguen protegidos por RLS.
export function DevBanner() {
  const { devRole } = useAuth()
  if (!devRole) return null
  return (
    <div className="flex items-center justify-center gap-3 bg-gold-400 px-3 py-1 text-center text-xs font-medium text-stone-900">
      <span>
        Modo dev — viendo como <strong>{roleLabel(devRole)}</strong>
      </span>
      <button onClick={() => setDevRole(null)} className="underline">
        salir
      </button>
      <Link to="/dev" className="underline">
        /dev
      </Link>
    </div>
  )
}
