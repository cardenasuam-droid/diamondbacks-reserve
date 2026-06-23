import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="space-y-3 text-center">
      <p className="text-5xl font-black text-slate-300">404</p>
      <h1 className="text-lg font-semibold">Página no encontrada</h1>
      <Link to="/" className="inline-block text-sm font-medium text-sky-300 underline">
        Volver al inicio
      </Link>
    </div>
  )
}
