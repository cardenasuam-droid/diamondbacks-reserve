// Formatea una fecha 'YYYY-MM-DD' a texto en español, sin desfase de zona
// horaria (se ancla al mediodía local).
const fmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

export function formatRoundDate(date: string | null | undefined): string | null {
  if (!date) return null
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return fmt.format(d)
}

// Formatea un timestamp ISO completo (p. ej. created_at) a fecha en español.
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return fmt.format(d)
}
