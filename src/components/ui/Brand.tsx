import { useState } from 'react'

// Marca de la liga. Usa el logo real en /logo.png (escudo Diamondbacks);
// mientras no exista el archivo, cae a un monograma premium esmeralda+oro.
// Para activar el logo: guarda la imagen como  public/logo.png
export function Brand({ compact = false }: { compact?: boolean }) {
  const [logoOk, setLogoOk] = useState(true)

  return (
    <span className="flex items-center gap-2">
      {logoOk ? (
        <img
          src="/logo.png"
          alt="Logo de la liga"
          onError={() => setLogoOk(false)}
          className="h-9 w-9 rounded-lg object-contain ring-1 ring-gold-500/30"
        />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-stone-900 font-heading text-xs tracking-wider text-gold-400 ring-1 ring-gold-500/40">
          DR
        </span>
      )}
      {!compact && (
        <span className="font-heading text-sm tracking-wide text-stone-900">
          Liga de Pádel
        </span>
      )}
    </span>
  )
}
