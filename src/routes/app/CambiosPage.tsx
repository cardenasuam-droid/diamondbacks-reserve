import { useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/context'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { useRounds } from '@/features/schedule/useRounds'
import { useCaptainTeam } from '@/features/lineups/useCaptainTeam'
import { useEligibilityRules } from '@/features/lineups/useEligibilityRules'
import {
  useTeamSwaps,
  useSeasonEntries,
  useRegisterSwap,
  swapCountByTeam,
  type TeamSwap,
} from '@/features/lineups/useSwapsDobleteos'
import { countDobleteos, LIMITE_DOBLETEOS, type DobleteoEvent } from '@/features/lineups/dobleteos'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { TeamCrest } from '@/components/ui/TeamCrest'
import type { PublicPlayer, Team } from '@/lib/types'

const LIMITE_SWAPS = 4

// Swaps y dobleteos por equipo (regla 2026-08-24): 4 swaps y 3 dobleteos por
// temporada. Transparencia total: capitanas y organizadores ven los conteos de
// TODOS los equipos. Los swaps se REGISTRAN (cambian la alineación publicada y
// se cuentan); los dobleteos se DERIVAN de las alineaciones publicadas, con sus
// dos excepciones (3a Fem / 4a Var, y jugar categoría superior).
export function CambiosPage() {
  const { role } = useAuth()
  const season = useActiveSeason()
  const seasonId = season.data?.id
  const teams = useTeams(seasonId)
  const players = usePublicPlayers(seasonId)
  const swaps = useTeamSwaps(seasonId)
  const entries = useSeasonEntries(seasonId)
  const rules = useEligibilityRules()
  const captainTeam = useCaptainTeam()

  const playersById = useMemo(
    () => new Map((players.data ?? []).map((p) => [p.id, p])),
    [players.data],
  )

  const dobleteos = useMemo(() => {
    if (!entries.data || !rules.data) return null
    return countDobleteos(
      entries.data,
      new Map(
        (players.data ?? []).map((p) => [
          p.id,
          { id: p.id, category_code: p.category_code, gender: p.gender },
        ]),
      ),
      rules.data,
    )
  }, [entries.data, rules.data, players.data])

  if (season.isLoading || teams.isLoading || swaps.isLoading || entries.isLoading) {
    return <Loader label="Cargando cambios…" />
  }
  if (swaps.isError) return <ErrorState onRetry={() => swaps.refetch()} />
  if (entries.isError) return <ErrorState onRetry={() => entries.refetch()} />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Swaps y dobleteos" />
        <EmptyState icon="lineup" title="No hay temporada activa" />
      </div>
    )
  }

  const swapsPorEquipo = swapCountByTeam(swaps.data ?? [])
  const puedeRegistrar = role === 'organizer' || (role === 'captain' && Boolean(captainTeam.data))

  return (
    <div className="space-y-4">
      <PageHeader title="Swaps y dobleteos" subtitle={season.data.name} />

      <p className="text-xs text-slate-500">
        Cada equipo tiene <strong className="text-slate-700">{LIMITE_SWAPS} swaps</strong> (cambiar a
        un jugador ya alineado, antes del juego) y{' '}
        <strong className="text-slate-700">{LIMITE_DOBLETEOS} dobleteos</strong> (un jugador repite
        juego en la jornada) por temporada. No cuentan los dobleteos de 3a Femenil / 4a Varonil ni
        los de quien dobletea jugando una categoría superior a la suya.
      </p>

      {puedeRegistrar && (
        <RegistrarSwap
          seasonId={season.data.id}
          esOrganizador={role === 'organizer'}
          equipoPropio={captainTeam.data ?? null}
          teams={teams.data ?? []}
          entries={entriesData(entries.data ?? [])}
          playersById={playersById}
        />
      )}

      <div className="space-y-3">
        {(teams.data ?? []).map((t) => (
          <TeamCard
            key={t.id}
            team={t}
            swapsUsados={swapsPorEquipo.get(t.id) ?? 0}
            swapsDetalle={(swaps.data ?? []).filter((s) => s.team_id === t.id)}
            dobleteos={(dobleteos?.events ?? []).filter((d) => d.team_id === t.id)}
            dobleteosContados={dobleteos?.countByTeam.get(t.id) ?? 0}
            playersById={playersById}
          />
        ))}
      </div>
    </div>
  )
}

// Índice (equipo|jornada) → entradas, para el formulario.
function entriesData(entries: import('@/features/lineups/dobleteos').SeasonEntry[]) {
  return entries
}

function TeamCard({
  team,
  swapsUsados,
  swapsDetalle,
  dobleteos,
  dobleteosContados,
  playersById,
}: {
  team: Team
  swapsUsados: number
  swapsDetalle: TeamSwap[]
  dobleteos: DobleteoEvent[]
  dobleteosContados: number
  playersById: Map<string, PublicPlayer>
}) {
  const nombre = (id: string | null) => (id ? playersById.get(id)?.full_name ?? '—' : '—')
  const swapsExcedidos = swapsUsados > LIMITE_SWAPS
  const doblesExcedidos = dobleteosContados > LIMITE_DOBLETEOS

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <TeamCrest name={team.name} logoUrl={team.logo_url} color={team.color} size={24} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{team.name}</span>
        <Badge color={swapsExcedidos ? 'rose' : 'emerald'}>
          Swaps {swapsUsados}/{LIMITE_SWAPS}
        </Badge>
        <Badge color={doblesExcedidos ? 'rose' : 'blue'}>
          Dobleteos {dobleteosContados}/{LIMITE_DOBLETEOS}
        </Badge>
      </div>

      {(swapsDetalle.length > 0 || dobleteos.length > 0) && (
        <div className="space-y-1.5 px-3 py-2.5">
          {swapsDetalle.map((s) => (
            <p key={`${s.id}-${s.player_in_id}`} className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">J{s.round_number}</span>
              {s.category_code ? ` · ${s.category_code}` : ''} —{' '}
              <span className="font-medium text-slate-800">{nombre(s.player_in_id)}</span> entró por{' '}
              {nombre(s.player_out_id)}
            </p>
          ))}
          {dobleteos.map((d, i) => (
            <p key={i} className={`text-xs ${d.exempt ? 'text-slate-400' : 'text-slate-600'}`}>
              <span className={`font-semibold ${d.exempt ? '' : 'text-slate-700'}`}>J{d.round_number}</span>
              {` · ${d.category_code} — dobleteo de `}
              <span className={d.exempt ? '' : 'font-medium text-slate-800'}>{nombre(d.player_id)}</span>
              {d.exempt && (
                <span>
                  {' '}
                  (no cuenta: {d.reason === 'fem3_var4' ? '3a Fem / 4a Var' : 'jugó categoría superior'})
                </span>
              )}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}

function RegistrarSwap({
  seasonId,
  esOrganizador,
  equipoPropio,
  teams,
  entries,
  playersById,
}: {
  seasonId: string
  esOrganizador: boolean
  equipoPropio: { id: string; name: string } | null
  teams: Team[]
  entries: import('@/features/lineups/dobleteos').SeasonEntry[]
  playersById: Map<string, PublicPlayer>
}) {
  const rounds = useRounds(seasonId)
  const registrar = useRegisterSwap()
  const [abierto, setAbierto] = useState(false)
  const [teamId, setTeamId] = useState(equipoPropio?.id ?? '')
  const [roundNumber, setRoundNumber] = useState<number | ''>('')
  const [out, setOut] = useState('')
  const [inId, setInId] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  const equipo = esOrganizador ? teamId : equipoPropio?.id ?? ''

  // Jornadas con alineaciones publicadas (solo ahí existe el swap).
  const jornadas = useMemo(
    () => [...new Set(entries.map((e) => e.round_number))].sort((a, b) => a - b),
    [entries],
  )
  const jornadaActiva = roundNumber === '' ? jornadas[jornadas.length - 1] : roundNumber
  const roundId = rounds.data?.find((r) => r.round_number === jornadaActiva)?.id

  // Alineados de ese equipo en esa jornada (candidatos a SALIR).
  const alineados = useMemo(() => {
    const ids = new Set<string>()
    for (const e of entries) {
      if (e.team_id !== equipo || e.round_number !== jornadaActiva) continue
      if (e.player_1_id) ids.add(e.player_1_id)
      if (e.player_2_id) ids.add(e.player_2_id)
    }
    return [...ids]
      .map((id) => playersById.get(id))
      .filter((p): p is PublicPlayer => Boolean(p))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'))
  }, [entries, equipo, jornadaActiva, playersById])

  // Si el que sale está en varias categorías esa jornada, hay que elegir cuál.
  const categoriasDelOut = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            e.team_id === equipo &&
            e.round_number === jornadaActiva &&
            (e.player_1_id === out || e.player_2_id === out),
        )
        .map((e) => e.category_code),
    [entries, equipo, jornadaActiva, out],
  )
  const [categoria, setCategoria] = useState('')

  // Candidatos a ENTRAR: roster del equipo, mismo género que el que sale.
  const outPlayer = out ? playersById.get(out) : undefined
  const candidatos = useMemo(() => {
    if (!outPlayer) return []
    return [...playersById.values()]
      .filter((p) => p.team_id === equipo && p.gender === outPlayer.gender && p.id !== out)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'))
  }, [playersById, equipo, outPlayer, out])

  const listo = Boolean(equipo && roundId && out && inId && (categoriasDelOut.length <= 1 || categoria))

  async function enviar() {
    if (!roundId) return
    try {
      await registrar.mutateAsync({
        roundId,
        playerOut: out,
        playerIn: inId,
        teamId: esOrganizador ? equipo : null,
        categoryCode: categoriasDelOut.length > 1 ? categoria : null,
        seasonId,
      })
      setOut('')
      setInId('')
      setCategoria('')
      setConfirmando(false)
    } catch {
      // el error se muestra desde registrar.error
      setConfirmando(false)
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full rounded-2xl border border-slate-200/80 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
      >
        Registrar swap →
      </button>
    )
  }

  const select = 'min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-800'

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-100 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">Registrar swap</h2>
        <button onClick={() => setAbierto(false)} className="text-xs text-slate-500 hover:underline">
          Cerrar
        </button>
      </div>

      {esOrganizador && (
        <select value={teamId} onChange={(e) => { setTeamId(e.target.value); setOut(''); setInId('') }} aria-label="Equipo" className={select}>
          <option value="">— Equipo —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}

      <select
        value={jornadaActiva ?? ''}
        onChange={(e) => { setRoundNumber(Number(e.target.value)); setOut(''); setInId('') }}
        aria-label="Jornada"
        className={select}
      >
        {jornadas.map((j) => (
          <option key={j} value={j}>Jornada {j}</option>
        ))}
      </select>

      <select value={out} onChange={(e) => { setOut(e.target.value); setInId(''); setCategoria('') }} aria-label="Sale" className={select}>
        <option value="">— ¿Quién sale? —</option>
        {alineados.map((p) => (
          <option key={p.id} value={p.id}>{p.full_name}</option>
        ))}
      </select>

      {categoriasDelOut.length > 1 && (
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría" className={select}>
          <option value="">— ¿De qué categoría sale? (está en varias) —</option>
          {categoriasDelOut.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}

      <select value={inId} onChange={(e) => setInId(e.target.value)} aria-label="Entra" className={select} disabled={!out}>
        <option value="">— ¿Quién entra? —</option>
        {candidatos.map((p) => (
          <option key={p.id} value={p.id}>{p.full_name} · {p.category_code}</option>
        ))}
      </select>

      {registrar.isError && (
        <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
          {(registrar.error as Error).message}
        </p>
      )}
      {registrar.isSuccess && registrar.data && (
        <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">
          Swap registrado: el equipo lleva {registrar.data.swaps_usados} de {registrar.data.limite}.
        </p>
      )}

      {confirmando ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-xs text-slate-600">
            Se cambia la alineación publicada y se usa 1 de los {LIMITE_SWAPS} swaps del equipo. ¿Seguro?
          </span>
          <button
            onClick={enviar}
            disabled={registrar.isPending}
            className="min-h-[44px] rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {registrar.isPending ? 'Registrando…' : 'Sí, registrar'}
          </button>
          <button onClick={() => setConfirmando(false)} className="px-2 text-xs text-slate-500 hover:underline">
            No
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmando(true)}
          disabled={!listo || registrar.isPending}
          className="min-h-[44px] w-full rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Registrar swap
        </button>
      )}
    </section>
  )
}
