import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/lib/types'

export interface AppNotification {
  id: string
  title: string
  body: string | null
  target_role: UserRole | null
  target_team_id: string | null
  target_user_id: string | null
  channel: string
  status: string
  created_at: string
}

const COLUMNS =
  'id, title, body, target_role, target_team_id, target_user_id, channel, status, created_at'

// Avisos visibles para el usuario actual (RLS los filtra por rol/equipo/usuario).
async function fetchMyNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AppNotification[]
}

export function useMyNotifications() {
  return useQuery({ queryKey: ['notifications', 'mine'], queryFn: fetchMyNotifications })
}

// --- "No leídos" sin tabla extra: marca de tiempo en localStorage + evento ---
const LAST_SEEN_KEY = 'avisos:lastSeen'
const SEEN_EVENT = 'avisos-seen'

function getLastSeen(): string {
  try {
    return localStorage.getItem(LAST_SEEN_KEY) ?? '1970-01-01T00:00:00.000Z'
  } catch {
    return '1970-01-01T00:00:00.000Z'
  }
}

export function markAvisosSeen() {
  try {
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SEEN_EVENT))
}

export function useUnreadAvisos(): number {
  const { data } = useMyNotifications()
  const [lastSeen, setLastSeen] = useState(getLastSeen)
  useEffect(() => {
    const handler = () => setLastSeen(getLastSeen())
    window.addEventListener(SEEN_EVENT, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(SEEN_EVENT, handler)
      window.removeEventListener('storage', handler)
    }
  }, [])
  return (data ?? []).filter((n) => n.created_at > lastSeen).length
}

export interface CreateNotificationVars {
  title: string
  body: string
  target_role: UserRole | null
  target_team_id: string | null
}

export function useCreateNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: CreateNotificationVars) => {
      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase.from('notifications').insert({
        title: v.title.trim(),
        body: v.body.trim() || null,
        target_role: v.target_role,
        target_team_id: v.target_team_id,
        channel: 'in_app',
        status: 'sent',
        created_by: auth.user?.id ?? null,
        sent_at: new Date().toISOString(),
      })
      if (error) {
        throw new Error(
          /row-level security/i.test(error.message)
            ? 'No tienes permiso para enviar avisos.'
            : error.message,
        )
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

// Enlace para compartir un aviso por WhatsApp (spec §16.2).
export function whatsappShareUrl(title: string, body: string | null): string {
  const text = body ? `${title}\n\n${body}` : title
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
