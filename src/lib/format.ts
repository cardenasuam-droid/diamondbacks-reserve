// Formato de fechas y horas para la UI (es-MX).

// "18:30" → "6:30 pm". Los bloques de horario guardan etiqueta de 24 h; el
// público de la liga habla en 12 h ("juego a las 7:45").
export function pmLabel(label: string): string {
  const [h, m] = label.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return label
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`
}

// '2026-10-12' → '12 de octubre'. Ancla T00:00:00 para no correrse un día por
// zona horaria.
export function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
}

// Edad en años cumplidos a partir de 'YYYY-MM-DD'; null si la fecha no parsea.
export function ageFromBirthdate(iso: string): number | null {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const beforeBirthday =
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  if (beforeBirthday) age -= 1
  return age
}
