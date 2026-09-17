import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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
  if (/foreign key|category|violates/i.test(msg)) return 'La categoría elegida no es válida.'
  return 'No se pudo enviar tu inscripción. Inténtalo de nuevo.'
}

// Extensión segura del nombre de archivo (el bucket ya limita MIME y tamaño).
function fileExt(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'bin'
}

// Inscripción a una liga americano: sube el comprobante (si hay) al bucket
// privado 'receipts' y luego inserta en la bandeja. Si el INSERT fallara
// después de subir, el archivo queda huérfano: costo aceptado (0050); el
// organizador puede purgar.
export function useSubmitAmericanoRegistration(seasonId: string | null | undefined) {
  return useMutation({
    mutationFn: async (vars: SubmitAmericanoVars) => {
      if (vars.website && vars.website.trim() !== '') return

      async function uploadReceipt(file: File): Promise<string> {
        const path = `registrations/${crypto.randomUUID()}.${fileExt(file.name)}`
        const { error: upErr } = await supabase.storage
          .from('receipts')
          .upload(path, file, { upsert: false })
        if (upErr) {
          throw new Error('No pudimos subir tu comprobante. Inténtalo de nuevo o envíalo después a la organizadora.')
        }
        return path
      }

      const receiptPath = vars.receiptFile ? await uploadReceipt(vars.receiptFile) : null
      const discountPath = vars.discountFile ? await uploadReceipt(vars.discountFile) : null

      const { error } = await supabase.from('player_registrations').insert({
        season_id: seasonId ?? null,
        full_name: vars.fullName.trim(),
        phone: vars.phone.trim(),
        requested_category_code: vars.categoryCode,
        position: vars.position,
        shirt_size: vars.shirtSize,
        birthdate: vars.birthdate,
        blocked_time_labels: vars.blockedSlots.length > 0 ? vars.blockedSlots : null,
        comment: vars.comment ?? null,
        receipt_path: receiptPath,
        discount_receipt_path: discountPath,
      })
      if (error) throw new Error(friendly(error.message))
    },
  })
}
