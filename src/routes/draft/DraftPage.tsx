import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/context'
import { useCaptainTeam } from '@/features/lineups/useCaptainTeam'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useCategories } from '@/features/categories/useCategories'
import { useDraftView } from '@/features/draft/useDraftView'
import { useAutoPick } from '@/features/draft/mutations'
import { remainingMs } from '@/features/draft/clock'
import { DraftBoard } from '@/features/draft/components/DraftBoard'
import { PoolPicker } from '@/features/draft/components/PoolPicker'
import { DraftHero } from '@/features/draft/components/DraftHero'
import { Brand } from '@/components/ui/Brand'
import { Icon } from '@/components/ui/Icon'
import { Loader } from '@/components/ui/Loader'

// Página PÚBLICA + participante del draft (aislada, como /registro). Cualquiera ve
// el board en vivo; una capitana logueada ve los controles de elegir en su turno.
export function DraftPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const season = useActiveSeason()

  // Volver: esta pantalla es una ruta aislada (sin nav inferior). Regresa en el
  // historial si venimos de dentro de la app; si se abrió directo (enlace/PWA), al inicio.
  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }
  const view = useDraftView(season.data?.id)
  const captain = useCaptainTeam()
  const myTeamId = captain.data?.id ?? null

  const cats = useCategories()
  const catName = (code: string | null) =>
    (code && cats.data?.find((c) => c.code === code)?.name) || code || ''

  const draft = view.draft
  const current = view.current
  const myTurn =
    draft?.status === 'active' && current != null && myTeamId != null && current.team_id === myTeamId

  // Fallback de auto-pick (solo logueados): si el reloj venció hace >4s y el
  // anfitrión no avanzó, cualquier cliente logueado lo dispara (RPC idempotente).
  useAutoPickFallback(view.draftId, season.data?.id, draft?.status ?? null, draft?.pick_deadline ?? null, Boolean(session))

  return (
    <div className="min-h-full">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-12 pt-safe lg:max-w-4xl">
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={goBack}
              aria-label="Volver"
              className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-100"
            >
              <Icon name="chevron-left" size={22} />
            </button>
            <Brand />
          </div>
          <span className="text-xs font-medium tracking-wide text-slate-500">Draft en vivo</span>
        </header>

        <main className="rise flex-1 space-y-4">
          {season.isLoading || view.isLoading ? (
            <Loader label="Cargando draft…" />
          ) : !draft ? (
            <Empty title="El draft aún no ha comenzado" desc="Cuando el organizador lo inicie, aquí verás los picks en vivo." />
          ) : (
            <>
              <DraftHero
                previous={view.previous}
                current={current}
                status={draft.status}
                deadline={draft.pick_deadline}
                pickSeconds={draft.pick_seconds}
                myTurn={myTurn}
                teamsById={view.teamsById}
                playersById={view.playersById}
                categoryName={catName}
              />

              {myTurn && current && view.draftId && season.data && (
                <PoolPicker
                  draftId={view.draftId}
                  seasonId={season.data.id}
                  categoryCode={current.category_code}
                  categoryName={catName(current.category_code)}
                  pool={view.pool}
                />
              )}

              {!session && draft.status === 'active' && (
                <p className="rounded-2xl bg-slate-50 p-3 text-center text-sm text-slate-500 shadow-md">
                  ¿Eres capitana?{' '}
                  <Link to="/login" className="font-medium text-brand-300 underline">
                    Inicia sesión
                  </Link>{' '}
                  para elegir en tu turno.
                </p>
              )}

              <DraftBoard
                board={view.board}
                teamsById={view.teamsById}
                playersById={view.playersById}
                currentPickNumber={current?.pick_number ?? null}
                currentCategory={current?.category_code ?? null}
              />
            </>
          )}
        </main>

        <footer className="pt-6 text-center text-xs text-slate-600">Diamondbacks Reserve · Team League</footer>
      </div>
    </div>
  )
}

function Empty({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-6 text-center shadow-md">
      <span className="neu-raised mx-auto flex h-14 w-14 items-center justify-center rounded-full text-gold-300">
        <Icon name="standings" size={26} />
      </span>
      <p className="mt-3 font-heading text-lg text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </div>
  )
}

// Fallback de auto-pick: cualquier cliente logueado dispara el RPC (idempotente)
// si el reloj venció hace >4s, por si el organizador cerró su pantalla anfitriona.
function useAutoPickFallback(
  draftId: string | undefined,
  seasonId: string | undefined,
  status: string | null,
  deadline: string | null,
  enabled: boolean,
) {
  const autoPick = useAutoPick()
  const firedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!enabled || !draftId || !seasonId || status !== 'active' || !deadline) return
    const id = setInterval(() => {
      if (remainingMs(deadline, Date.now()) > 0) return
      // 4s de gracia tras el vencimiento + no repetir para el mismo deadline.
      if (Date.now() - new Date(deadline).getTime() < 4000) return
      if (firedFor.current === deadline) return
      firedFor.current = deadline
      autoPick.mutate({ draftId, seasonId })
    }, 1000)
    return () => clearInterval(id)
  }, [enabled, draftId, seasonId, status, deadline, autoPick])
}
