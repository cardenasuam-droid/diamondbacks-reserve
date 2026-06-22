import { z } from 'zod'
import type { ImportValidation, RowIssue } from './types'

// CSV de equipos (spec §11.1): team_name,color,logo_url,captain_email
// captain_email es informativo: el capitán se marca en el CSV de jugadores
// (players.is_captain, CLAUDE.md §3.2); aquí solo se valida su formato.

export interface TeamInput {
  team_name: string
  color: string | null
  logo_url: string | null
}

const HEX = /^#[0-9a-fA-F]{6}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const rowSchema = z.object({
  team_name: z.string().trim().min(1, 'team_name es obligatorio'),
  color: z.string().trim().optional().default(''),
  logo_url: z.string().trim().optional().default(''),
  captain_email: z.string().trim().optional().default(''),
})

export function validateTeams(
  rows: Record<string, string>[],
  existingNames: string[] = [],
): ImportValidation<TeamInput> {
  const valid: TeamInput[] = []
  const errors: RowIssue[] = []
  const warnings: RowIssue[] = []
  const seen = new Set<string>()
  const existing = new Set(existingNames.map((n) => n.toLowerCase()))

  rows.forEach((raw, idx) => {
    const row = idx + 1
    const parsed = rowSchema.safeParse(raw)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ row, message: issue.message })
      }
      return
    }
    const r = parsed.data

    if (r.color && !HEX.test(r.color)) {
      errors.push({ row, message: `Color inválido "${r.color}" (usa formato #RRGGBB).` })
      return
    }
    if (r.captain_email && !EMAIL.test(r.captain_email)) {
      errors.push({ row, message: `captain_email inválido: "${r.captain_email}".` })
      return
    }

    const key = r.team_name.toLowerCase()
    if (seen.has(key)) {
      errors.push({ row, message: `Equipo duplicado en el archivo: "${r.team_name}".` })
      return
    }
    seen.add(key)
    if (existing.has(key)) {
      warnings.push({ row, message: `El equipo "${r.team_name}" ya existe; se omitirá al importar.` })
      return
    }

    valid.push({
      team_name: r.team_name,
      color: r.color || null,
      logo_url: r.logo_url || null,
    })
  })

  return { valid, errors, warnings }
}
