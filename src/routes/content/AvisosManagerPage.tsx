import { useState } from 'react'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import {
  useMyNotifications,
  useCreateNotification,
  whatsappShareUrl,
} from '@/features/notifications/useNotifications'
import { formatDate } from '@/lib/date'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import type { UserRole } from '@/lib/types'

type Audience = 'all' | 'captains' | 'team'

export function AvisosManagerPage() {
  const season = useActiveSeason()
  const teams = useTeams(season.data?.id)
  const list = useMyNotifications()
  const create = useCreateNotification()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [teamId, setTeamId] = useState('')
  const [done, setDone] = useState(false)

  async function send() {
    setDone(false)
    const target_role: UserRole | null = audience === 'captains' ? 'captain' : null
    const target_team_id = audience === 'team' ? teamId || null : null
    await create.mutateAsync({ title, body, target_role, target_team_id })
    setDone(true)
    setTitle('')
    setBody('')
  }

  const canSend = Boolean(title.trim()) && !(audience === 'team' && !teamId) && !create.isPending

  return (
    <div className="space-y-4">
      <PageHeader title="Avisos" subtitle="Enviar comunicados internos" />

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título del aviso"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-medium"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Mensaje…"
          rows={4}
          className="w-full rounded-lg border border-slate-300 p-3 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as Audience)}
            className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            <option value="captains">Capitanes</option>
            <option value="team">Un equipo</option>
          </select>
          {audience === 'team' && (
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
            >
              <option value="">— Elige equipo —</option>
              {(teams.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {create.isError && (
          <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
            {(create.error as Error).message}
          </p>
        )}
        {done && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✅ Aviso enviado.</p>
        )}

        <button
          onClick={send}
          disabled={!canSend}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {create.isPending ? 'Enviando…' : 'Enviar aviso'}
        </button>
      </section>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">Enviados</h2>
        {list.isLoading ? (
          <Loader label="Cargando…" />
        ) : (
          <ul className="space-y-2">
            {(list.data ?? []).map((n) => (
              <li key={n.id} className="rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-medium text-slate-800">{n.title}</span>
                  <Badge color="slate">
                    {n.target_team_id ? 'Equipo' : n.target_role ? 'Capitanes' : 'Todos'}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{formatDate(n.created_at)}</span>
                  <a
                    href={whatsappShareUrl(n.title, n.body)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    WhatsApp ↗
                  </a>
                </div>
              </li>
            ))}
            {(list.data ?? []).length === 0 && (
              <li className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm text-slate-500">
                Aún no has enviado avisos.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
