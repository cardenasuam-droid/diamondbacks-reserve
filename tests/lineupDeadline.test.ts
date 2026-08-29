import { isPastDeadline, formatDeadline } from '@/features/lineups/lineupHelpers'

// El límite ya NO se calcula en el cliente: lo devuelve el servidor por RPC
// (lineup_deadline, la misma función que usan los triggers). Aquí se prueba lo
// único que queda del lado de la app: comparar ese instante contra ahora y
// escribirlo en pantalla.
//
// Las cadenas de abajo son respuestas REALES del RPC, copiadas verbatim, para
// que el test falle si cambia el formato con el que llega la fecha.
const RPC_J6 = '2026-08-27T14:00:00+00:00' // jornada 6, viernes 28-ago (excepción)
const RPC_J7 = '2026-08-30T14:00:00+00:00' // jornada 7, lunes 31-ago (excepción)
const RPC_J8 = '2026-09-05T13:00:00+00:00' // jornada 8, lunes 7-sep (regla general)

describe('formatDeadline', () => {
  it('escribe la fecha que devolvió el servidor, en hora de México', () => {
    expect(formatDeadline(new Date(RPC_J7))).toBe('domingo, 30 de agosto, 08:00 a.m.')
    expect(formatDeadline(new Date(RPC_J6))).toBe('jueves, 27 de agosto, 08:00 a.m.')
  })

  it('una jornada sin excepción se sigue leyendo como sábado 07:00', () => {
    expect(formatDeadline(new Date(RPC_J8))).toBe('sábado, 5 de septiembre, 07:00 a.m.')
  })
})

describe('isPastDeadline', () => {
  it('false antes del límite, true en el instante exacto y después', () => {
    const dl = new Date(RPC_J8)
    expect(isPastDeadline(dl, dl.getTime() - 1000)).toBe(false)
    expect(isPastDeadline(dl, dl.getTime())).toBe(true)
    expect(isPastDeadline(dl, dl.getTime() + 1000)).toBe(true)
  })

  it('sin fecha no bloquea: manda el trigger del servidor, no la UI', () => {
    // Cubre "aún cargando" y "jornada sin fecha".
    expect(isPastDeadline(null)).toBe(false)
    expect(isPastDeadline(undefined)).toBe(false)
  })

  // REGRESIÓN del bug que motivó el cambio: la fórmula local decía que la J7
  // cerraba el sábado 29 a las 07:00 México y la app bloqueaba la carga ese
  // mismo día, cuando el servidor la tenía abierta hasta el domingo 30.
  it('la jornada 7 sigue ABIERTA el sábado 29, que era cuando la UI la bloqueaba', () => {
    const sabado29 = Date.parse('2026-08-29T13:00:00Z') // sáb 29-ago 07:00 México
    expect(isPastDeadline(new Date(RPC_J7), sabado29)).toBe(false)
    // Y sigue abierta hasta el domingo: cierra en el instante que dice el servidor.
    expect(isPastDeadline(new Date(RPC_J7), Date.parse('2026-08-30T13:59:59Z'))).toBe(false)
    expect(isPastDeadline(new Date(RPC_J7), Date.parse('2026-08-30T14:00:00Z'))).toBe(true)
  })
})
