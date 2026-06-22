import { z } from 'zod'
import type { ImportValidation, RowIssue } from './types'

// CSV de rol (spec §11.3):
// season_name,round_number,round_date,time_block,court_number,team_a,team_b,category_code
// Cada fila es UN partido. Validaciones bloqueantes (spec §10.4): categoría y
// equipos existentes, sin choque cancha+horario en la jornada, sin partido
// duplicado, cada enfrentamiento con sus 9 categorías, 27 partidos por jornada,
// ningún equipo en dos enfrentamientos de la misma jornada.

export interface ScheduleMatchInput {
  round_number: number
  round_date: string | null
  time_block_id: string
  start_time: string
  court_id: string
  team_a_id: string
  team_b_id: string
  category_code: string
}

export interface ScheduleContext {
  seasonName: string
  teams: { id: string; name: string }[]
  categories: { code: string }[]
  timeBlocks: { id: string; label: string; start_time: string }[]
  courts: { id: string; number: number }[]
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

const rowSchema = z.object({
  season_name: z.string().trim().optional().default(''),
  round_number: z.coerce.number().int().positive(),
  round_date: z.string().trim().optional().default(''),
  time_block: z.string().trim().min(1, 'time_block es obligatorio'),
  court_number: z.coerce.number().int().positive(),
  team_a: z.string().trim().min(1, 'team_a es obligatorio'),
  team_b: z.string().trim().min(1, 'team_b es obligatorio'),
  category_code: z.string().trim().min(1, 'category_code es obligatorio'),
})

const pairKey = (a: string, b: string) => [a, b].sort().join('|')

export function validateSchedule(
  rows: Record<string, string>[],
  ctx: ScheduleContext,
): ImportValidation<ScheduleMatchInput> {
  const valid: ScheduleMatchInput[] = []
  const errors: RowIssue[] = []
  const warnings: RowIssue[] = []

  const teamByName = new Map(ctx.teams.map((t) => [t.name.toLowerCase(), t]))
  const catCodes = new Set(ctx.categories.map((c) => c.code))
  const tbByLabel = new Map(ctx.timeBlocks.map((t) => [t.label.toLowerCase(), t]))
  const courtByNumber = new Map(ctx.courts.map((c) => [c.number, c]))

  // claves de unicidad
  const slotSeen = new Map<string, number>() // round|time|court -> primera fila
  const matchSeen = new Map<string, number>() // round|pair|category -> primera fila
  // estructura por jornada para chequeos agregados
  const roundPairs = new Map<number, Set<string>>() // round -> set(pairKey)
  const roundPairCats = new Map<string, Set<string>>() // round|pair -> set(category)
  const roundTeams = new Map<number, Map<string, Set<string>>>() // round -> team -> set(pairKey)

  rows.forEach((raw, idx) => {
    const row = idx + 1
    const parsed = rowSchema.safeParse(raw)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        errors.push({ row, message: field ? `${String(field)}: ${issue.message}` : issue.message })
      }
      return
    }
    const r = parsed.data

    if (r.season_name && r.season_name.toLowerCase() !== ctx.seasonName.toLowerCase()) {
      warnings.push({
        row,
        message: `season_name "${r.season_name}" ≠ temporada activa "${ctx.seasonName}"; se importa a la activa.`,
      })
    }

    if (!catCodes.has(r.category_code)) {
      errors.push({ row, message: `Categoría inexistente: "${r.category_code}".` })
      return
    }
    const ta = teamByName.get(r.team_a.toLowerCase())
    const tb = teamByName.get(r.team_b.toLowerCase())
    if (!ta) {
      errors.push({ row, message: `Equipo inexistente: "${r.team_a}".` })
      return
    }
    if (!tb) {
      errors.push({ row, message: `Equipo inexistente: "${r.team_b}".` })
      return
    }
    if (ta.id === tb.id) {
      errors.push({ row, message: `Un equipo no puede enfrentarse a sí mismo ("${r.team_a}").` })
      return
    }
    const tb2 = tbByLabel.get(r.time_block.toLowerCase())
    if (!tb2) {
      errors.push({ row, message: `Horario inexistente: "${r.time_block}".` })
      return
    }
    const court = courtByNumber.get(r.court_number)
    if (!court) {
      errors.push({ row, message: `Cancha inexistente: nº ${r.court_number}.` })
      return
    }
    if (r.round_date && !DATE.test(r.round_date)) {
      errors.push({ row, message: `Fecha inválida: "${r.round_date}" (usa AAAA-MM-DD).` })
      return
    }

    const pair = pairKey(ta.id, tb.id)

    const slotK = `${r.round_number}|${tb2.label}|${court.number}`
    const slotFirst = slotSeen.get(slotK)
    if (slotFirst) {
      errors.push({
        row,
        message: `Choque de cancha/horario en J${r.round_number}: cancha ${court.number} a las ${tb2.label} (también en fila ${slotFirst}).`,
      })
    } else {
      slotSeen.set(slotK, row)
    }

    const matchK = `${r.round_number}|${pair}|${r.category_code}`
    const matchFirst = matchSeen.get(matchK)
    if (matchFirst) {
      errors.push({
        row,
        message: `Partido duplicado en J${r.round_number}: ${r.team_a} vs ${r.team_b} ${r.category_code} (también en fila ${matchFirst}).`,
      })
    } else {
      matchSeen.set(matchK, row)
    }

    // acumular estructura
    if (!roundPairs.has(r.round_number)) roundPairs.set(r.round_number, new Set())
    roundPairs.get(r.round_number)!.add(pair)
    const rpKey = `${r.round_number}|${pair}`
    if (!roundPairCats.has(rpKey)) roundPairCats.set(rpKey, new Set())
    roundPairCats.get(rpKey)!.add(r.category_code)
    if (!roundTeams.has(r.round_number)) roundTeams.set(r.round_number, new Map())
    const rt = roundTeams.get(r.round_number)!
    for (const id of [ta.id, tb.id]) {
      if (!rt.has(id)) rt.set(id, new Set())
      rt.get(id)!.add(pair)
    }

    valid.push({
      round_number: r.round_number,
      round_date: r.round_date || null,
      time_block_id: tb2.id,
      start_time: tb2.start_time,
      court_id: court.id,
      team_a_id: ta.id,
      team_b_id: tb.id,
      category_code: r.category_code,
    })
  })

  // --- chequeos agregados por jornada/enfrentamiento ---
  const expectedCats = ctx.categories.length // 9
  for (const [rpKey, cats] of roundPairCats) {
    if (cats.size !== expectedCats) {
      const [rn, a, b] = rpKey.split('|')
      const an = ctx.teams.find((t) => t.id === a)?.name ?? a
      const bn = ctx.teams.find((t) => t.id === b)?.name ?? b
      errors.push({
        row: 0,
        message: `J${rn} ${an} vs ${bn}: ${cats.size}/${expectedCats} categorías (debe tener las 9).`,
      })
    }
  }
  for (const [rn, pairs] of roundPairs) {
    const matchesInRound = [...roundPairCats.entries()]
      .filter(([k]) => k.startsWith(`${rn}|`))
      .reduce((sum, [, c]) => sum + c.size, 0)
    if (matchesInRound !== 27) {
      errors.push({ row: 0, message: `J${rn}: ${matchesInRound} partidos (deben ser 27).` })
    }
    if (pairs.size !== 3) {
      warnings.push({ row: 0, message: `J${rn}: ${pairs.size} enfrentamientos (lo normal son 3).` })
    }
  }
  for (const [rn, teamMap] of roundTeams) {
    for (const [teamId, ps] of teamMap) {
      if (ps.size > 1) {
        const name = ctx.teams.find((t) => t.id === teamId)?.name ?? teamId
        errors.push({ row: 0, message: `J${rn}: "${name}" aparece en ${ps.size} enfrentamientos (debe ser 1).` })
      }
    }
  }

  return { valid, errors, warnings }
}
