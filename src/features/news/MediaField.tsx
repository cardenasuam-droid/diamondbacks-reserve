import { useState } from 'react'
import { uploadMedia } from './contentMutations'
import { safeUrl } from '@/lib/url'

// Campo de archivo: permite pegar una URL o subir un archivo al bucket 'media'.
// Al subir, rellena la URL automáticamente.
export function MediaField({
  label,
  value,
  onChange,
  accept,
  folder,
}: {
  label: string
  value: string
  onChange: (url: string) => void
  accept: string
  folder: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setErr(null)
    try {
      // Deriva el tipo permitido del accept: "image/*" solo imágenes; si no, admite PDF.
      const kind = accept.trim().startsWith('image') ? 'image' : 'any'
      onChange(await uploadMedia(file, folder, kind))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… o sube un archivo"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <label className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          {busy ? 'Subiendo…' : 'Subir'}
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={busy}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      {safeUrl(value) && (
        <a href={safeUrl(value)} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-300 underline">
          Ver archivo
        </a>
      )}
    </div>
  )
}
