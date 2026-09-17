import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { uploadReceipt } from './receiptUpload'
import type { RegistrationStatus } from './types'

// "Mi inscripción" (0057): estado por token + adjuntar comprobantes después.

export interface RegistrationStatusRow {
  full_name: string
  /** null si la edición no pregunta categoría (0058). */
  requested_category_code: string | null
  status: RegistrationStatus
  season_id: string
  created_at: string
  has_receipt: boolean
  has_discount_receipt: boolean
  payment_verified: boolean
}

export function useRegistrationStatus(token: string | null) {
  return useQuery({
    queryKey: ['registration-status', token],
    queryFn: async (): Promise<RegistrationStatusRow | null> => {
      const { data, error } = await supabase.rpc('registration_status', { p_token: token! })
      if (error) throw error
      const row = (Array.isArray(data) ? data[0] : data) as RegistrationStatusRow | undefined
      return row ?? null
    },
    enabled: Boolean(token),
  })
}

// Sube el archivo y lo enlaza a la inscripción del token. El servidor valida
// (token real, no rechazada, pago aún sin verificar); sus mensajes ya vienen
// en español y se muestran tal cual.
export function useAttachReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { token: string; kind: 'payment' | 'discount'; file: File }) => {
      const path = await uploadReceipt(v.file)
      const { error } = await supabase.rpc('attach_registration_receipt', {
        p_token: v.token,
        p_kind: v.kind,
        p_path: path,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['registration-status', v.token] })
    },
  })
}
