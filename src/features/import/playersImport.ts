import { z } from 'zod'
import type { CategoryType, Gender } from '@/lib/types'
import { genderForCategoryType } from '@/features/categories/eligibility'
import { parseBool, type ImportValidation, type RowIssue } from './types'

// CSV de jugadores (spec §11.2):
// full_name,email,phone,team_name,gender,category_code,is_captain
// Reglas: género consistente con la categoría, categoría de RANKING (no mixta),
// equipo existente, email único; ≤25 por equipo y ≥1 capitán como advertencias.

export interface PlayerInput {
  full_name: string
  email: string | null
  phone: string | null
  team_id: string
  gender: Gender
  category_code: string
  is_captain: boolean
}

export interface PlayersContext {
  teams: { id: string; name: string }[]
  categories: { code: string; type: CategoryType }[]
  existingEmails?: string[]
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_PER_TEAM = 25

const rowSchema = z.object({
  full_name: z.string().trim().min(1, 'full_name es obligatorio'),
  email: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  team_name: z.string().trim().min(1, 'team_name es obligatorio'),
  gender: z.enum(['male', 'female']),
  category_code: z.string().trim().min(1, 'category_code es obligatorio'),
  is_captain: z.string().optional().default(''),
})

export function validatePlayers(
  rows: Record<string, string>[],
  ctx: PlayersContext,
): ImportValidation<PlayerInput> {
  const valid: PlayerInput[] = []
  const errors: RowIssue[] = []
  const warnings: RowIssue[] = []

  const teamByName = new Map(ctx.teams.map((t) => [t.name.toLowerCase(), t]))
  const typeByCode = new Map(ctx.categories.map((c) => [c.code, c.type]))
  const seenEmail = new Set<string>()
  const existingEmail = new Set((ctx.existingEmails ?? []).map((e) => e.toLowerCase()))
  const perTeamCount = new Map<string, number>()
  const captainByTeam = new Map<string, number>() // team_id -> nº capitanes en el archivo

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

    const team = teamByName.get(r.team_name.toLowerCase())
    if (!team) {
      errors.push({ row, message: `Equipo inexistente: "${r.team_name}".` })
      return
    }

    const catType = typeByCode.get(r.category_code)
    if (!catType) {
      errors.push({ row, message: `Categoría inexistente: "${r.category_code}".` })
      return
    }
    const expectedGender = genderForCategoryType(catType)
    if (expectedGender === null) {
      errors.push({
        row,
        message: `"${r.category_code}" es mixta; un jugador debe tener categoría de ranking (VAR_*/FEM_*).`,
      })
      return
    }
    if (r.gender !== expectedGender) {
      errors.push({
        row,
        message: `Género (${r.gender}) inconsistente con la categoría ${r.category_code}.`,
      })
      return
    }

    if (r.email) {
      if (!EMAIL.test(r.email)) {
        errors.push({ row, message: `Email inválido: "${r.email}".` })
        return
      }
      const key = r.email.toLowerCase()
      if (seenEmail.has(key)) {
        errors.push({ row, message: `Email duplicado en el archivo: "${r.email}".` })
        return
      }
      seenEmail.add(key)
      if (existingEmail.has(key)) {
        warnings.push({ row, message: `El email "${r.email}" ya existe; se omitirá al importar.` })
        return
      }
    }

    const isCaptain = parseBool(r.is_captain)
    if (isCaptain) {
      const c = (captainByTeam.get(team.id) ?? 0) + 1
      captainByTeam.set(team.id, c)
      if (c > 1) {
        errors.push({ row, message: `"${r.team_name}" ya tiene un capitán en el archivo (máx. 1).` })
        return
      }
    }

    perTeamCount.set(team.id, (perTeamCount.get(team.id) ?? 0) + 1)

    valid.push({
      full_name: r.full_name,
      email: r.email || null,
      phone: r.phone || null,
      team_id: team.id,
      gender: r.gender,
      category_code: r.category_code,
      is_captain: isCaptain,
    })
  })

  // Advertencias agregadas por equipo.
  for (const [teamId, count] of perTeamCount) {
    const name = ctx.teams.find((t) => t.id === teamId)?.name ?? teamId
    if (count > MAX_PER_TEAM) {
      warnings.push({ row: 0, message: `"${name}" tiene ${count} jugadores (recomendado ≤ ${MAX_PER_TEAM}).` })
    }
    if (!captainByTeam.get(teamId)) {
      warnings.push({ row: 0, message: `"${name}" no tiene capitán marcado en el archivo.` })
    }
  }

  return { valid, errors, warnings }
}
