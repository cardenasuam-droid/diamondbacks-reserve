import { useMemo, useState } from 'react'
import { parseCsv } from './parseCsv'
import type { ImportValidation } from './types'

interface CsvImporterProps<T> {
  /** Texto de ayuda con las columnas esperadas (también sirve de ejemplo). */
  sample: string
  validate: (rows: Record<string, string>[]) => ImportValidation<T>
  onImport: (valid: T[]) => Promise<{ inserted: number }>
}

// Importador genérico: pegar o subir CSV → previsualizar con errores/advertencias
// → importar (bloqueado si hay errores). La validación es la función pura por tipo.
export function CsvImporter<T>({ sample, validate, onImport }: CsvImporterProps<T>) {
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const result = useMemo(() => {
    if (!text.trim()) return null
    const { rows } = parseCsv(text)
    return { count: rows.length, ...validate(rows) }
  }, [text, validate])

  function reset() {
    setDone(null)
    setError(null)
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setText(await file.text())
    reset()
  }

  async function handleImport() {
    if (!result) return
    setImporting(true)
    reset()
    try {
      const { inserted } = await onImport(result.valid)
      setDone(`✅ Importados ${inserted} registros.`)
      setText('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const canImport = Boolean(result && result.errors.length === 0 && result.valid.length > 0 && !importing)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Subir archivo…
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
        <button
          onClick={() => {
            setText(sample)
            reset()
          }}
          className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cargar ejemplo
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          reset()
        }}
        placeholder={sample}
        rows={8}
        spellCheck={false}
        className="w-full rounded-lg border border-slate-300 bg-slate-100 p-3 font-mono text-xs text-slate-800"
      />

      {result && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
              {result.count} filas leídas
            </span>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-300">
              {result.valid.length} válidas
            </span>
            {result.errors.length > 0 && (
              <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-200">
                {result.errors.length} errores
              </span>
            )}
            {result.warnings.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
                {result.warnings.length} avisos
              </span>
            )}
          </div>

          {result.errors.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-rose-500/15 p-3 text-xs text-rose-200">
              {result.errors.slice(0, 100).map((e, i) => (
                <li key={i}>
                  {e.row > 0 ? `Fila ${e.row}: ` : ''}
                  {e.message}
                </li>
              ))}
            </ul>
          )}
          {result.warnings.length > 0 && (
            <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg bg-amber-500/15 p-3 text-xs text-amber-700">
              {result.warnings.slice(0, 50).map((w, i) => (
                <li key={i}>
                  {w.row > 0 ? `Fila ${w.row}: ` : ''}
                  {w.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
      {done && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">{done}</p>}

      <button
        onClick={handleImport}
        disabled={!canImport}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {importing
          ? 'Importando…'
          : result
            ? `Importar ${result.valid.length} registros`
            : 'Importar'}
      </button>
      {result && result.errors.length > 0 && (
        <p className="text-center text-xs text-slate-500">
          Corrige los errores para poder importar.
        </p>
      )}
    </div>
  )
}
