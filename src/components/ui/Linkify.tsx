// Convierte las URLs de un texto plano en enlaces reales. Para textos que
// viven en la base (p. ej. seasons.payment_instructions) y se editan sin
// deploy.
export function Linkify({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sky-300 underline"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}
