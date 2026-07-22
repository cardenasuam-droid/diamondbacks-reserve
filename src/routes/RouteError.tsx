import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'

// Pantalla de error de ruta. Sin esto, un throw en cualquier render mostraba la
// pantalla por defecto de react-router: en inglés, con el stack a la vista y sin
// ninguna salida — en la cancha, eso es un callejón sin salida.
//
// Ofrece las dos salidas que de verdad arreglan algo:
//   · Reintentar: recarga. Sirve para un fallo transitorio de red.
//   · Actualizar la app: fuerza el service worker nuevo (window.updateApp de
//     main.tsx). Es lo que arregla el caso "mi app se quedó en una versión vieja".
export function RouteError() {
  const error = useRouteError()

  // Un 404 del router no es un fallo: es una URL que no existe.
  const esNoEncontrado = isRouteErrorResponse(error) && error.status === 404

  const detalle =
    error instanceof Error
      ? error.message
      : isRouteErrorResponse(error)
        ? `${error.status} ${error.statusText}`
        : null

  // Un chunk que no carga casi siempre significa "tu app es de antes del último
  // despliegue", así que la salida buena es actualizar, no reintentar.
  const pareceVersionVieja =
    typeof detalle === 'string' &&
    /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(detalle)

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
        <Icon name={esNoEncontrado ? 'search' : 'ban'} size={26} />
      </span>

      <h1 className="mt-4 font-heading text-xl text-slate-900">
        {esNoEncontrado ? 'Esta página no existe' : 'Algo se rompió'}
      </h1>

      <p className="mt-2 text-sm text-slate-600">
        {esNoEncontrado
          ? 'Puede que el enlace esté mal o que la página haya cambiado de sitio.'
          : pareceVersionVieja
            ? 'Tu app se quedó en una versión anterior. Actualízala y listo.'
            : 'Fue un fallo de la app, no algo que hicieras mal. Puedes reintentar o actualizar.'}
      </p>

      {!esNoEncontrado && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Reintentar
          </button>
          <button
            onClick={() => window.updateApp?.()}
            className="min-h-[44px] rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Actualizar la app
          </button>
        </div>
      )}

      <p className="mt-6 text-sm">
        <Link to="/" className="text-sky-400 underline">
          Volver al inicio
        </Link>
      </p>

      {/* El detalle técnico va plegado: útil para reportar por WhatsApp, sin
          asustar a quien solo quería ver el rol. */}
      {detalle && !esNoEncontrado && (
        <details className="mt-6 text-left">
          <summary className="cursor-pointer text-xs text-slate-500">Detalle técnico</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-100 p-3 text-[11px] text-slate-600">
            {detalle}
          </pre>
        </details>
      )}
    </div>
  )
}
