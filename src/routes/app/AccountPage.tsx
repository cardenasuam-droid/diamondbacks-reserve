import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { roleLabel } from '@/features/auth/roles'
import { isPlayerAuthEmail, isSyntheticEmail } from '@/features/auth/playerAuth'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { useSetMyPhoto } from '@/features/teams/playerMutations'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'
import { Loader } from '@/components/ui/Loader'

// Página de cuenta (landing tras login). Confirma sesión, rol y enlace a player.
export function AccountPage() {
  const { user, profile, profileLoading, role } = useAuth()

  if (profileLoading) return <Loader label="Cargando tu cuenta…" />

  const linked = Boolean(profile?.player_id)

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-stone-50 p-5 shadow-sm">
        <h1 className="font-heading text-xl">Hola{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
        <dl className="mt-4 grid grid-cols-3 gap-y-2 text-sm">
          {!isSyntheticEmail(user?.email) && (
            <>
              <dt className="col-span-1 text-slate-500">Correo</dt>
              <dd className="col-span-2 font-medium">{user?.email}</dd>
            </>
          )}
          <dt className="col-span-1 text-slate-500">Rol</dt>
          <dd className="col-span-2 font-medium">{roleLabel(role)}</dd>
          <dt className="col-span-1 text-slate-500">Ficha de jugador</dt>
          <dd className="col-span-2 font-medium">{linked ? 'Enlazada ✓' : 'Sin enlazar'}</dd>
        </dl>
      </section>

      {linked && profile?.player_id && (
        <PhotoSection playerId={profile.player_id} name={profile.full_name ?? 'Jugador'} />
      )}

      {isPlayerAuthEmail(user?.email) && !linked && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Tu cuenta entró pero no está enlazada a una ficha de jugador. Avisa al organizador.
        </section>
      )}

      {(role === 'captain' || role === 'organizer') && (
        <Link
          to="/app/capitan"
          className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-stone-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Icon name="captain" size={20} />
          </span>
          <span className="flex-1">
            <span className="block font-medium text-slate-800">Panel de capitán</span>
            <span className="block text-xs text-slate-500">Arma y envía la alineación de tu equipo</span>
          </span>
          <Icon name="chevron-right" size={18} className="text-slate-300" />
        </Link>
      )}
    </div>
  )
}

function PhotoSection({ playerId, name }: { playerId: string; name: string }) {
  const season = useActiveSeason()
  const players = usePublicPlayers(season.data?.id)
  const me = players.data?.find((p) => p.id === playerId)
  const setPhoto = useSetMyPhoto()
  const [preview, setPreview] = useState<string | null>(null)
  const photo = preview ?? me?.photo_url ?? null

  async function onFile(file: File | undefined) {
    if (!file) return
    const url = await setPhoto.mutateAsync(file)
    setPreview(url)
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-stone-50 p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Tu foto</h2>
      <p className="mt-1 text-xs text-slate-500">
        Aparecerá en el roster de tu equipo y en tu perfil de jugador.
      </p>
      <div className="mt-4 flex items-center gap-4">
        <Avatar name={name} photoUrl={photo} size={64} />
        <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          {setPhoto.isPending ? 'Subiendo…' : photo ? 'Cambiar foto' : 'Subir foto'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={setPhoto.isPending}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      </div>
      {setPhoto.isError && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {(setPhoto.error as Error).message}
        </p>
      )}
    </section>
  )
}
