// Parser CSV pequeño pero correcto (RFC-4180-ish): comillas dobles con escape
// "", campos con comas/saltos de línea entre comillas, CRLF y LF, BOM inicial.
// Devuelve filas como objetos {cabecera: valor}. Sin dependencias externas.

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

function parseRecords(text: string): string[][] {
  // Quita BOM si viene de Excel.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  let i = 0

  while (i < s.length) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      record.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      record.push(field)
      records.push(record)
      field = ''
      record = []
      i++
      continue
    }
    field += c
    i++
  }
  record.push(field)
  records.push(record)
  return records
}

export function parseCsv(text: string): ParsedCsv {
  const records = parseRecords(text).filter(
    (r) => !(r.length === 1 && r[0].trim() === ''),
  )
  if (records.length === 0) return { headers: [], rows: [] }

  const headers = records[0].map((h) => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < records.length; i++) {
    const rec = records[i]
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (rec[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return { headers, rows }
}
