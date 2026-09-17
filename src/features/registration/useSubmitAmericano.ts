import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { uploadReceipt } from './receiptUpload'
import type { AmericanoRegistrationInput } from './schemaAmericano'

export interface SubmitAmericanoVars extends AmericanoRegistrationInput {
  receiptFile?: File | null
  /** Comprobante del torneo de Peak Padel (descuento $250, 0056). */
  discountFile?: File | null
  // Honeypot (mismo truco que useSubmitRegistration).
  website?: string
}

function friendly(msg: string): string {
  if (/does not exist|schema cache|could not find the table|pgrst205/i.test(msg)) {
    return 'El registro aún no está habilitado. Avisa a la organizadora.'
  }
  if (/row-level security/i.test(msg)) return 'No se pudo enviar tu inscripción. Inténtalo más tarde.'
  if (/check constraint|violates check/i.test(msg)) return 'Revisa tus datos: algún campo no es válido.'
  return 'No se pudo enviar tu inscripción. Inténtalo de nuevo.'
}

// Inscripción a una liga americano: sube comprobantes (si hay) al bucket
// privado 'receipts' y luego inserta en la bandeja con un TOKEN generado aquí
// (0057) — la credencial de "Mi inscripción". Devuelve el token para que la
// página lo guarde y muestre el enlace. Si el INSERT fallara después de
// subir, el archivo queda huérfano: costo aceptado (0050).
export function useSubmitAmericanoRegistration(seasonId: string | null | undefined) {
  return useMutation({
    mutationFn: async (vars: SubmitAmericanoVars): Promise<string | null> => {
      if (vars.website && vars.website.trim() !== '') return null

      const accessToken = crypto.randomUUID()
      const receiptPath = vars.receiptFile ? await uploadReceipt(vars.receiptFile) : null
      const discountPath = vars.discountFile ? await uploadReceipt(vars.discountFile) : null

      const { error } = await supabase.from('player_registrations').insert({
        season_id: seasonId ?? null,
        full_name: vars.fullName.trim(),
        phone: vars.phone.trim(),
        // Sin categoría ni talla (0058): el comité asigna la categoría al aprobar.
        position: vars.position,
        birthdate: vars.birthdate,
        blocked_time_labels: vars.blockedSlots.length > 0 ? vars.blockedSlots : null,
        comment: vars.comment ?? null,
        receipt_path: receiptPath,
        discount_receipt_path: discountPath,
        access_token: accessToken,
      })
      if (error) throw new Error(friendly(error.message))
      return accessToken
    },
  })
}
