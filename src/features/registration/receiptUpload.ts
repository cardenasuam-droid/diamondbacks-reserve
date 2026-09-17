import { supabase } from '@/lib/supabase'

// Subida de un comprobante al bucket privado 'receipts' (0050). Compartida
// por el formulario (al enviar) y por "Mi inscripción" (adjunto tardío).

function fileExt(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'bin'
}

export async function uploadReceipt(file: File): Promise<string> {
  const path = `registrations/${crypto.randomUUID()}.${fileExt(file.name)}`
  const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: false })
  if (error) {
    throw new Error('No pudimos subir tu comprobante. Inténtalo de nuevo o envíalo después a la organizadora.')
  }
  return path
}
