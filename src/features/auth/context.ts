import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile, UserRole } from '@/lib/types'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  /** Ficha de cuenta (rol, enlace a player). null si aún no carga o no existe. */
  profile: Profile | null
  /** Carga inicial de la sesión + perfil. */
  loading: boolean
  /** true mientras se (re)lee el perfil tras un cambio de sesión. */
  profileLoading: boolean
  /** Rol efectivo (incluye override de vista dev); null sin sesión/perfil. */
  role: UserRole | null
  /** Rol forzado por la consola /dev (solo UI), o null. */
  devRole: UserRole | null
  signOut: () => Promise<void>
  /** Vuelve a leer el perfil desde la BD (p. ej. tras enlazar la cuenta). */
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
