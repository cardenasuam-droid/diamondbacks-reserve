import { TeamCrest } from '@/components/ui/TeamCrest'
import { Avatar } from '@/components/ui/Avatar'
import { PickClock } from './PickClock'
import type { PublicPlayer, Team } from '@/lib/types'
import type { DraftPick, DraftStatus } from '../types'

// Doble visibilidad del draft, pensada para PROYECTAR en una pantalla grande:
// a la izquierda el PICK ANTERIOR (equipo + jugador elegido), a la derecha EL
// RELOJ con el equipo en turno + cuenta regresiva. Logos y nombres grandes.
// El contenedor de la página se ensancha en pantallas grandes (lg) para que luzca.
export function DraftHero({
  previous,
  current,
  status,
  deadline,
  pickSeconds,
  myTurn,
  teamsById,
  playersById,
  categoryName,
}: {
  previous: DraftPick | null
  current: DraftPick | null
  status: DraftStatus
  deadline: string | null
  pickSeconds: number
  myTurn: boolean
  teamsById: Map<string, Team>
  playersById: Map<string, PublicPlayer>
  categoryName: (code: string) => string
}) {
  const prevTeam = previous ? teamsById.get(previous.team_id) : null
  const prevPlayer = previous?.player_id ? playersById.get(previous.player_id) : null
  const curTeam = current ? teamsById.get(current.team_id) : null

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* ---------- PICK ANTERIOR ---------- */}
      <section className="flex flex-col items-center rounded-3xl bg-slate-50 p-5 text-center shadow-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Pick anterior
        </p>
        {previous && prevTeam ? (
          <>
            <div className="mt-3">
              <TeamCrest
                name={prevTeam.name}
                logoUrl={prevTeam.logo_url}
                color={prevTeam.color}
                size={72}
                glow
              />
            </div>
            <p className="mt-2 font-heading text-lg text-slate-900">{prevTeam.name}</p>
            <div className="mt-3 flex items-center gap-2">
              <Avatar
                name={prevPlayer?.full_name ?? '—'}
                photoUrl={prevPlayer?.photo_url}
                color={prevTeam.color}
                size={40}
              />
              <span className="font-heading text-base text-slate-900">
                {prevPlayer?.full_name ?? '—'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {categoryName(previous.category_code)} · Pick {previous.pick_number}
              {previous.was_auto ? ' · auto' : ''}
            </p>
          </>
        ) : (
          <p className="mt-6 mb-2 text-sm text-slate-500">Aún no hay picks</p>
        )}
      </section>

      {/* ---------- EN EL RELOJ (pick actual) ---------- */}
      <section
        className={`flex flex-col items-center rounded-3xl bg-slate-50 p-5 text-center shadow-md ${
          myTurn ? 'ring-2 ring-gold-300' : ''
        }`}
      >
        {status === 'finished' ? (
          <p className="my-8 font-heading text-2xl text-slate-900">Draft finalizado 🎉</p>
        ) : status === 'setup' || !current || !curTeam ? (
          <p className="my-8 text-sm text-slate-500">Esperando a que el organizador inicie…</p>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-300">
              En el reloj
            </p>
            <div className="mt-3">
              <TeamCrest
                name={curTeam.name}
                logoUrl={curTeam.logo_url}
                color={curTeam.color}
                size={88}
                glow
              />
            </div>
            <p className="mt-2 font-heading text-xl text-slate-900">{curTeam.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {categoryName(current.category_code)} · Pick {current.pick_number}
            </p>
            <div className="mt-3 w-full max-w-[220px]">
              <PickClock deadline={deadline} status={status} pickSeconds={pickSeconds} />
            </div>
            {myTurn && (
              <p className="mt-3 font-heading text-sm text-gold-300">¡Es tu turno! Elige abajo.</p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
