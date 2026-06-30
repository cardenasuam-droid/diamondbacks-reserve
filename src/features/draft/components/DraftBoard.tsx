import { useState } from 'react'
import { useCategories } from '@/features/categories/useCategories'
import { Icon } from '@/components/ui/Icon'
import { Avatar } from '@/components/ui/Avatar'
import { TeamCrest } from '@/components/ui/TeamCrest'
import type { PublicPlayer, Team } from '@/lib/types'
import type { DraftPick } from '../types'

interface BoardProps {
  board: DraftPick[]
  teamsById: Map<string, Team>
  playersById: Map<string, PublicPlayer>
  currentPickNumber: number | null
  currentCategory: string | null
}

// Board del draft, agrupado por categoría (en el orden del draft). Cada categoría
// es una sección plegable; la categoría en curso se abre por defecto. Mobile-first.
export function DraftBoard({ board, teamsById, playersById, currentPickNumber, currentCategory }: BoardProps) {
  const cats = useCategories()
  const nameOf = (code: string) => cats.data?.find((c) => c.code === code)?.name ?? code

  const groups: { code: string; picks: DraftPick[] }[] = []
  for (const p of board) {
    let g = groups.find((x) => x.code === p.category_code)
    if (!g) {
      g = { code: p.category_code, picks: [] }
      groups.push(g)
    }
    g.picks.push(p)
  }

  if (groups.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500 shadow-md">
        El board se genera cuando el organizador inicia el draft.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <BoardSection
          key={g.code}
          name={nameOf(g.code)}
          picks={g.picks}
          teamsById={teamsById}
          playersById={playersById}
          currentPickNumber={currentPickNumber}
          defaultOpen={g.code === currentCategory}
        />
      ))}
    </div>
  )
}

function BoardSection({
  name,
  picks,
  teamsById,
  playersById,
  currentPickNumber,
  defaultOpen,
}: {
  name: string
  picks: DraftPick[]
  teamsById: Map<string, Team>
  playersById: Map<string, PublicPlayer>
  currentPickNumber: number | null
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const done = picks.filter((p) => p.player_id).length

  return (
    <div className="overflow-hidden rounded-2xl bg-slate-50 shadow-md">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="flex-1 font-heading text-sm text-slate-900">{name}</span>
        <span className="text-xs text-slate-500">
          {done}/{picks.length}
        </span>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} className="text-slate-500" />
      </button>
      {open && (
        <ul className="divide-y divide-slate-200 px-2 pb-2">
          {picks.map((p) => {
            const team = teamsById.get(p.team_id)
            const player = p.player_id ? playersById.get(p.player_id) : null
            const isCurrent = p.pick_number === currentPickNumber
            return (
              <li
                key={p.id}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-2 ${
                  isCurrent ? 'neu-inset' : ''
                }`}
              >
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-slate-500">
                  {p.pick_number}
                </span>
                <TeamCrest name={team?.name ?? '—'} logoUrl={team?.logo_url} color={team?.color} size={20} />
                <span className="w-16 shrink-0 truncate text-xs text-slate-600">{team?.name ?? '—'}</span>
                <span className="flex flex-1 items-center gap-1.5 truncate text-sm font-medium text-slate-900">
                  {player ? (
                    <>
                      <Avatar name={player.full_name} photoUrl={player.photo_url} color={team?.color} size={22} />
                      <span className="truncate">{player.full_name}</span>
                    </>
                  ) : isCurrent ? (
                    <span className="text-gold-300">Eligiendo…</span>
                  ) : (
                    <span className="text-slate-500">Por elegir</span>
                  )}
                </span>
                {p.was_auto && (
                  <span className="shrink-0 rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] text-slate-600">
                    auto
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
