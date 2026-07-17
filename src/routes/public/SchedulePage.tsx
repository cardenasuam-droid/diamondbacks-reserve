import { useEffect, useState } from 'react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useRounds } from '@/features/schedule/useRounds'
import { useRoundMatches } from '@/features/schedule/useRoundMatches'
import { usePublicPlayers } from '@/features/teams/usePublicPlayers'
import { usePublishedLineups, publishedKey, type PublishedPair } from '@/features/lineups/usePublishedLineups'
import { groupByMatchup } from '@/features/schedule/groupByMatchup'
import { RoundSelector } from '@/features/schedule/RoundSelector'
import { MatchupHeader } from '@/features/schedule/MatchupHeader'
import { categoryColor } from '@/features/categories/categoryColor'
import { formatRoundDate } from '@/lib/date'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Loader } from '@/components/ui/Loader'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'

export function SchedulePage() {
  const season = useActiveSeason()
  const rounds = useRounds(season.data?.id)
  const [roundId, setRoundId] = useState<string>()

  // Por defecto, la última jornada disponible.
  useEffect(() => {
    if (!roundId && rounds.data && rounds.data.length > 0) {
      setRoundId(rounds.data[rounds.data.length - 1].id)
    }
  }, [rounds.data, roundId])

  const matches = useRoundMatches(roundId)
  const published = usePublishedLineups(roundId)
  const players = usePublicPlayers(season.data?.id)
  const nameById = useMemo(
    () => new Map((players.data ?? []).map((p) => [p.id, p.full_name])),
    [players.data],
  )
  const nameOf = (id: string | null) => (id ? nameById.get(id) ?? '—' : '—')

  if (season.isLoading) return <Loader label="Cargando temporada…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Rol de juegos" />
        <EmptyState icon="schedule" title="Aún no hay rol" description="El calendario aparecerá cuando el organizador publique las jornadas." />
      </div>
    )
  }

  const selectedRound = rounds.data?.find((r) => r.id === roundId)
  const groups = groupByMatchup(matches.data ?? [])

  return (
    <div>
      <PageHeader title="Rol de juegos" subtitle={season.data.name} />

      {rounds.isLoading ? (
        <Loader label="Cargando jornadas…" />
      ) : !rounds.data || rounds.data.length === 0 ? (
        <EmptyState icon="schedule" title="Sin jornadas publicadas" />
      ) : (
        <>
          <RoundSelector rounds={rounds.data} selectedId={roundId} onSelect={setRoundId} />
          {selectedRound?.round_date && (
            <p className="mb-3 text-sm text-slate-500">{formatRoundDate(selectedRound.round_date)}</p>
          )}

          {matches.isLoading ? (
            <Loader label="Cargando partidos…" />
          ) : matches.isError ? (
            <ErrorState onRetry={() => matches.refetch()} />
          ) : groups.length === 0 ? (
            <EmptyState icon="schedule" title="Esta jornada no tiene partidos" />
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.matchupId} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
                  <MatchupHeader teamA={g.teamA} teamB={g.teamB} />
                  <ul className="divide-y divide-slate-100">
                    {g.matches.map((m) => {
                      const pairA = g.teamA
                        ? published.data?.get(publishedKey(g.matchupId, g.teamA.id, m.category_code))
                        : undefined
                      const pairB = g.teamB
                        ? published.data?.get(publishedKey(g.matchupId, g.teamB.id, m.category_code))
                        : undefined
                      return (
                        <li key={m.id} className="relative transition hover:bg-slate-50">
                          {/* Tarjeta clickeable → pantalla del partido. Es un link de FONDO
                              (absolute) para que los nombres de jugadores puedan ser sus
                              propios links encima (z-[2]) sin anidar anchors. La categoría
                              va UNA vez (el badge); el espacio liberado es para el roster. */}
                          <Link
                            to={`/partidos/${m.id}`}
                            aria-label={`Ver partido ${m.category?.name ?? m.category_code}`}
                            className="absolute inset-0 z-[1]"
                          />
                          <div className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Badge color={categoryColor(m.category?.type)}>{m.category_code}</Badge>
                              <span className="ml-auto shrink-0 text-right text-xs text-slate-500">
                                {m.time_block?.label} · {m.court?.name}
                              </span>
                              <Icon name="chevron-right" size={14} className="shrink-0 text-slate-400" />
                            </div>
                            {/* Roster publicado: cada pareja del lado de SU equipo (A
                                izquierda, B derecha, como el encabezado), separadas por vs.
                                Solo cuando al menos un lado tiene jugadores reales. */}
                            {(hasPlayers(pairA) || hasPlayers(pairB)) && (
                              <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
                                <PairNames pair={pairA} nameOf={nameOf} align="left" />
                                <span className="text-[10px] font-medium text-slate-400">vs</span>
                                <PairNames pair={pairB} nameOf={nameOf} align="right" />
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ¿La pareja publicada tiene al menos un jugador real asignado?
function hasPlayers(pair: PublishedPair | undefined): boolean {
  return Boolean(pair && (pair.player_1_id || pair.player_2_id))
}

// Los dos nombres de una pareja publicada, apilados y alineados hacia el lado de
// su equipo. Cada nombre es un LINK a la ficha del jugador. ⚠️ = la pareja se armó
// con una excepción a la regla; vive FUERA del texto que trunca para no perderse.
function PairNames({
  pair,
  nameOf,
  align,
}: {
  pair: PublishedPair | undefined
  nameOf: (id: string | null) => string
  align: 'left' | 'right'
}) {
  const right = align === 'right'
  if (!hasPlayers(pair)) {
    return <p className={`text-xs text-slate-400 ${right ? 'text-right' : ''}`}>Por definir</p>
  }
  const p = pair as PublishedPair
  return (
    <div className={`min-w-0 text-xs ${right ? 'text-right' : ''}`}>
      <p className={`flex items-center gap-1 ${right ? 'justify-end' : ''}`}>
        {p.is_exception && !right && (
          <span className="shrink-0" title="Excepción a la regla">
            ⚠️
          </span>
        )}
        <PlayerName id={p.player_1_id} nameOf={nameOf} />
        {p.is_exception && right && (
          <span className="shrink-0" title="Excepción a la regla">
            ⚠️
          </span>
        )}
      </p>
      <PlayerName id={p.player_2_id} nameOf={nameOf} />
    </div>
  )
}

// Nombre de un jugador dentro de la tarjeta del rol: link a su ficha cuando hay id
// (z-[2] para ganarle al link de fondo de la tarjeta); texto plano si el hueco no
// tiene jugador asignado.
function PlayerName({ id, nameOf }: { id: string | null; nameOf: (id: string | null) => string }) {
  if (!id) return <span className="block min-w-0 truncate text-slate-500">{nameOf(id)}</span>
  return (
    <Link
      to={`/jugadores/${id}`}
      className="relative z-[2] block min-w-0 truncate text-slate-600 underline decoration-transparent hover:decoration-inherit"
    >
      {nameOf(id)}
    </Link>
  )
}
