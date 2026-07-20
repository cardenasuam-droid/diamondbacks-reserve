// Formatea una fecha 'YYYY-MM-DD' a texto en español, sin desfase de zona
// horaria (se ancla al mediodía local).
const fmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

export function formatRoundDate(date: string | null | undefined): string | null {
  if (!date) return null
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return fmt.format(d)
}

// Fecha de HOY como 'YYYY-MM-DD' en la zona de la liga (America/Mexico_City), no
// en UTC. Importa de noche: a las 21:00 en Cd. Juárez, new Date().toISOString()
// ya cayó en el día UTC siguiente, y comparar round_date contra eso movería la
// jornada un día (el rol saltaría a la siguiente el mismo día de juego). 'en-CA'
// produce el formato 'YYYY-MM-DD'.
const isoDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function todayISO(): string {
  return isoDate.format(new Date())
}

// Formatea un timestamp ISO completo (p. ej. created_at) a fecha en español.
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return fmt.format(d)
}
