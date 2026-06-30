import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { RegistrationInput } from './schema'

export interface SubmitVars extends RegistrationInput {
  // Honeypot: campo oculto que los humanos no ven. Si llega relleno, es un bot.
  website?: string
}

function friendly(msg: string): string {
  // Tabla aún no aplicada (migración 0014 sin db push). PostgREST devuelve
  // PGRST205 "Could not find the table ... in the schema cache".
  if (/does not exist|schema cache|could not find the table|pgrst205/i.test(msg)) {
    return 'El registro aún no está habilitado. Avisa al organizador.'
  }
  if (/row-level security/i.test(msg)) return 'No se pudo enviar tu inscripción. Inténtalo más tarde.'
  if (/check constraint|violates check/i.test(msg)) return 'Revisa tus datos: algún campo no es válido.'
  if (/foreign key|category|violates/i.test(msg)) return 'La categoría elegida no es válida.'
  return 'No se pudo enviar tu inscripción. Inténtalo de nuevo.'
}

// Inserta una inscripción en la bandeja pública (status 'pending' por defecto).
// No encadena .select(): anon no puede leer la tabla (RLS), solo escribir.
export function useSubmitRegistration(seasonId: string | null | undefined) {
  return useMutation({
    mutationFn: async (vars: SubmitVars) => {
      // Bot detectado por el honeypot → fingimos éxito sin escribir nada.
      if (vars.website && vars.website.trim() !== '') return
      const { error } = await supabase.from('player_registrations').insert({
        season_id: seasonId ?? null,
        full_name: vars.fullName.trim(),
        phone: vars.phone.trim(),
        requested_category_code: vars.categoryCode,
        position: vars.position,
        shirt_size: vars.shirtSize,
      })
      if (error) throw new Error(friendly(error.message))
    },
  })
}
