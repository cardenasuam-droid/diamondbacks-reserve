// Reloj del pick. El deadline (drafts.pick_deadline) es la verdad compartida:
// cada cliente calcula el tiempo restante contra su reloj local. Puro y testeable.

export function remainingMs(deadline: string | null, nowMs: number): number {
  if (!deadline) return 0
  return Math.max(0, new Date(deadline).getTime() - nowMs)
}

export function remainingSeconds(deadline: string | null, nowMs: number): number {
  return Math.ceil(remainingMs(deadline, nowMs) / 1000)
}
