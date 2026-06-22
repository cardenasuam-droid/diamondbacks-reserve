import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'
import { AuthContext, type AuthContextValue } from './context'

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[auth] No se pudo cargar el perfil:', error.message)
    return null
  }
  return (data as Profile | null) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const currentUserId = useRef<string | null>(null)

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    setProfile(await fetchProfile(user.id))
    setProfileLoading(false)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      const s = data.session
      setSession(s)
      currentUserId.current = s?.user.id ?? null
      await loadProfile(s?.user ?? null)
      if (active) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return
      setSession(s)
      const newId = s?.user.id ?? null
      // Recargar perfil solo si cambió el usuario (no en cada refresh de token).
      if (newId !== currentUserId.current) {
        currentUserId.current = newId
        // Diferido: evita el deadlock de llamar a Supabase dentro del callback.
        setTimeout(() => {
          if (active) void loadProfile(s?.user ?? null)
        }, 0)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user ?? null)
  }, [loadProfile, session])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileLoading,
      role: profile?.role ?? null,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, profileLoading, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
