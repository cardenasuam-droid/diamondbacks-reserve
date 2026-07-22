import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './styles/index.css'

// Actualización de la PWA. Tres mecanismos que se complementan, porque cada uno
// cubre un hueco que los otros dejan:
//
//   1. Sondeo cada 60 s mientras la app está abierta y visible.
//   2. Comprobación INMEDIATA al volver a la app (visibilitychange). Es el caso
//      real dominante: la app vive minimizada en el móvil, el navegador
//      estrangula los temporizadores en segundo plano y el sondeo del punto 1 no
//      corre. Sin esto, alguien que abre la app el sábado seguía viendo la
//      versión de la semana pasada.
//   3. Recarga cuando falla la carga de un chunk (`vite:preloadError`): tras un
//      despliegue, una pestaña vieja pide un asset con hash antiguo que ya no
//      existe. Recargar trae el index.html nuevo con los hashes correctos.

let registrationSW: ServiceWorkerRegistration | undefined

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    registrationSW = registration

    setInterval(() => {
      // Sondear con la pestaña oculta es gastar batería para nada: al volver a
      // primer plano se comprueba igualmente (mecanismo 2).
      if (document.visibilityState === 'visible') void registration.update()
    }, 60_000)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update()
    })
  },
})

/**
 * Botón "Actualizar" del menú: fuerza la búsqueda de una versión nueva y recarga.
 *
 * Antes llamaba a `updateSW(true)` y recargaba a los 300 ms fijos. En modo
 * `autoUpdate` esa llamada NO fuerza el relevo del service worker, así que la
 * recarga ocurría sobre la versión vieja y el botón no hacía nada visible.
 *
 * Ahora: se pide la comprobación al registro y se espera a que el SW nuevo tome
 * el control (`controllerchange`) para recargar. Si no hay versión nueva ese
 * evento no llega nunca, por eso el temporizador de respaldo recarga igual — así
 * el botón siempre hace algo, aunque solo sea refrescar los datos.
 */
window.updateApp = () => {
  let yaRecargado = false
  const recargar = () => {
    if (yaRecargado) return
    yaRecargado = true
    window.location.reload()
  }

  navigator.serviceWorker?.addEventListener('controllerchange', recargar, { once: true })

  void (async () => {
    try {
      await registrationSW?.update()
      // skipWaiting va activado en la config de workbox, así que un SW nuevo
      // toma el control solo; esto es por si el registro quedó en 'waiting'.
      registrationSW?.waiting?.postMessage({ type: 'SKIP_WAITING' })
      await updateSW(true)
    } catch {
      // Da igual por qué falló: el respaldo de abajo recarga de todos modos.
    }
  })()

  setTimeout(recargar, 1500)
}

// Un chunk que no carga tras un despliegue no es un error del usuario: es la
// pestaña vieja pidiendo un archivo que ya no existe. Se recarga UNA vez
// (sessionStorage evita el bucle si el fallo fuera de red y no de versión).
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('recarga-por-chunk') === '1') return
  sessionStorage.setItem('recarga-por-chunk', '1')
  window.location.reload()
})
window.addEventListener('load', () => sessionStorage.removeItem('recarga-por-chunk'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
